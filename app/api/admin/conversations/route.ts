import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      anonymousUser: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  return NextResponse.json({
    conversations: conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt.toISOString(),
      lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
      adminUnread: conversation.adminUnread,
      anonymousToken: conversation.anonymousUser.anonymousToken,
      preview: conversation.messages[0]?.content ?? ''
    }))
  });
}
