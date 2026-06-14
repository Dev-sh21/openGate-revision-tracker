import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  }

  const clientId = process.env.NOTION_CLIENT_ID;
  const redirectUri = encodeURIComponent(
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/notion/callback`
  );

  if (!clientId) {
    // Return to settings with error
    return NextResponse.redirect(
      new URL('/settings?error=Notion client ID not configured in .env', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    );
  }

  const notionAuthUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${redirectUri}`;

  return NextResponse.redirect(notionAuthUrl);
}
