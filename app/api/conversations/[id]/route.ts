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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const anonymousToken = getAnonymousTokenFromCookies(request.headers.get('cookie'));
  const { id } = await params;

  if (!anonymousToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.anonymousUser.findUnique({
    where: { anonymousToken: anonymousToken }
  });

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      anonymousUser: true,
      messages: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!conversation || !user || conversation.anonymousUserId !== user.id) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  }

  return NextResponse.json({
    id: conversation.id,
    title: conversation.title,
    messages: conversation.messages.map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      sender: message.sender,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      read: message.read
    }))
  });
}
