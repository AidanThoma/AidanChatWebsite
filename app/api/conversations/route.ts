import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function truncateTitle(value: string) {
  return value.trim().slice(0, 60) || 'New conversation';
}

function getAnonymousTokenFromCookies(cookieHeader: string | null) {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('anonymous_token='));

  if (!match) return null;
  return decodeURIComponent(match.split('=')[1]);
}

export async function GET(request: Request) {
  const anonymousToken = getAnonymousTokenFromCookies(request.headers.get('cookie'));

  if (!anonymousToken) {
    return NextResponse.json({ conversations: [] }, { status: 200 });
  }

  const user = await prisma.anonymousUser.findUnique({
    where: { anonymousToken: anonymousToken },
    include: {
      conversations: {
        orderBy: { updatedAt: 'desc' },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      }
    }
  });

  const conversations = (user?.conversations ?? []).map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    updatedAt: conversation.updatedAt.toISOString(),
    lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
    adminUnread: conversation.adminUnread,
    preview: conversation.messages[0]?.content ?? null
  }));

  return NextResponse.json({ conversations });
}

export async function POST(request: Request) {
  const anonymousToken = getAnonymousTokenFromCookies(request.headers.get('cookie'));

  if (!anonymousToken) {
    return NextResponse.json({ error: 'Anonymous user not found.' }, { status: 401 });
  }

  const user = await prisma.anonymousUser.findUnique({ where: { anonymousToken: anonymousToken } });

  if (!user) {
    return NextResponse.json({ error: 'Anonymous user not found.' }, { status: 401 });
  }

  const body = await request.json();
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : truncateTitle(content);

  if (!content) {
    return NextResponse.json({ error: 'Message content is required.' }, { status: 400 });
  }

  const conversation = await prisma.conversation.create({
    data: {
      anonymousUserId: user.id,
      title,
      lastMessageAt: new Date(),
      adminUnread: true,
      messages: {
        create: [{
          sender: 'USER',
          content,
          read: false
        }]
      }
    },
    include: {
      messages: true
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
      message: conversation.messages[0],
      conversation: {
        id: conversation.id,
        title: conversation.title,
        updatedAt: conversation.updatedAt.toISOString(),
        lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
        adminUnread: conversation.adminUnread
      }
    });
  }

  return NextResponse.json({
    conversationId: conversation.id,
    message: conversation.messages[0],
    conversation: {
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt.toISOString(),
      lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
      adminUnread: conversation.adminUnread
    }
  });
}
