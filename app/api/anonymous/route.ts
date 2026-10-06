import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
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

export async function GET(request: Request) {
  const token = getAnonymousTokenFromCookies(request.headers.get('cookie')) ?? uuidv4();

  const user = await prisma.anonymousUser.upsert({
    where: { anonymousToken: token },
    update: { lastSeenAt: new Date() },
    create: { anonymousToken: token }
  });

  const response = NextResponse.json({ anonymousToken: user.anonymousToken });

  response.cookies.set('anonymous_token', user.anonymousToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production'
  });

  return response;
}
