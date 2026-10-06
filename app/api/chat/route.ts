import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function getAnonymousTokenFromCookies(cookieHeader: string | null) {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('anonymous_token='));

  if (!match) return null;
  return decodeURIComponent(match.split('=')[1]);
}

function truncateTitle(value: string) {
  return value.trim().slice(0, 60) || 'New conversation';
}

export async function POST(request: Request) {
  const anonymousToken = getAnonymousTokenFromCookies(request.headers.get('cookie'));

  if (!anonymousToken) {
    return NextResponse.json({ error: 'Anonymous user is required.' }, { status: 401 });
  }

  const user = await prisma.anonymousUser.findUnique({ where: { anonymousToken: anonymousToken } });

  if (!user) {
    return NextResponse.json({ error: 'Anonymous user is required.' }, { status: 401 });
  }

  const body = await request.json();
  const content = typeof body.content === 'string' ? body.content.trim() : '';

  if (!content) {
    return NextResponse.json({ error: 'Message content is required.' }, { status: 400 });
  }

  let conversation;

  if (body.conversationId) {
    conversation = await prisma.conversation.findUnique({
      where: { id: body.conversationId },
      include: { anonymousUser: true }
    });

    if (!conversation || conversation.anonymousUserId !== user.id) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }
  } else {
    conversation = await prisma.conversation.create({
      data: {
        anonymousUserId: user.id,
        title: truncateTitle(content),
        lastMessageAt: new Date(),
        adminUnread: true
      }
    });
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      sender: 'USER',
      content,
      read: false
    }
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      updatedAt: new Date(),
      lastMessageAt: new Date(),
      adminUnread: true,
      title: conversation.title || truncateTitle(content)
    }
  });

  type SocketServer = {
    to: (room: string) => {
      emit: (event: string, payload: unknown) => void;
    };
  };

  const io = (globalThis as typeof globalThis & { io?: SocketServer }).io;
  if (io) {
    io.to('admin-room').emit('conversation:update', {
      conversationId: conversation.id,
      message,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        updatedAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        adminUnread: true
      }
    });
  }

  return NextResponse.json({
    conversationId: conversation.id,
    message: {
      id: message.id,
      conversationId: message.conversationId,
      sender: message.sender,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      read: message.read
    }
  });
}
