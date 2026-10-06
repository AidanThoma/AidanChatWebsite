import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      anonymousUser: true,
      messages: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  }

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      title: conversation.title,
      anonymousToken: conversation.anonymousUser.anonymousToken,
      adminUnread: conversation.adminUnread
    },
    messages: conversation.messages.map((message) => ({
      id: message.id,
      content: message.content,
      sender: message.sender,
      createdAt: message.createdAt.toISOString()
    }))
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const content = typeof body.content === 'string' ? body.content.trim() : '';

  if (!content) {
    return NextResponse.json({ error: 'Reply content is required.' }, { status: 400 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      anonymousUser: true,
      messages: true
    }
  });

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      sender: 'ADMIN',
      content,
      read: false
    }
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      updatedAt: new Date(),
      lastMessageAt: new Date(),
      adminUnread: false,
      title: conversation.title
    }
  });

  await prisma.message.updateMany({
    where: {
      conversationId: conversation.id,
      sender: 'USER'
    },
    data: {
      read: true
    }
  });

  type SocketServer = {
    to: (room: string) => {
      emit: (event: string, payload: unknown) => void;
    };
  };

  const io = (globalThis as typeof globalThis & { io?: SocketServer }).io;
  if (io) {
    io.to(`conversation:${conversation.id}`).emit('conversation:update', {
      conversationId: conversation.id,
      message,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        updatedAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        adminUnread: false
      }
    });
    io.to(`user:${conversation.anonymousUser.anonymousToken}`).emit('conversation:update', {
      conversationId: conversation.id,
      message,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        updatedAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        adminUnread: false
      }
    });
  }

  return NextResponse.json({
    message: {
      id: message.id,
      content: message.content,
      sender: message.sender,
      createdAt: message.createdAt.toISOString()
    }
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    select: {
      id: true,
      anonymousUser: { select: { anonymousToken: true } }
    }
  });

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  }

  await prisma.conversation.delete({ where: { id } });

  type SocketServer = {
    to: (room: string) => {
      emit: (event: string, payload: unknown) => void;
    };
  };
  const io = (globalThis as typeof globalThis & { io?: SocketServer }).io;
  const payload = { conversationId: id };
  io?.to('admin-room').emit('conversation:deleted', payload);
  io?.to(`user:${conversation.anonymousUser.anonymousToken}`).emit('conversation:deleted', payload);

  return NextResponse.json({ success: true });
}
