import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error) {
    return NextResponse.redirect(new URL(`/settings?error=Notion OAuth error: ${error}`, appUrl));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/settings?error=No authorization code provided from Notion', appUrl));
  }

  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/settings?error=Notion credentials not configured in .env', appUrl));
  }

  try {
    const redirectUri = `${appUrl}/api/auth/notion/callback`;
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return NextResponse.redirect(
        new URL(`/settings?error=Notion Token Exchange Failed: ${tokenData.message || tokenData.error}`, appUrl)
      );
    }

    const notionAccessToken = tokenData.access_token;
    // If the integration created a database via template duplication, it returns duplicated_template_id
    const notionDatabaseId = tokenData.duplicated_template_id || null;

    await prisma.user.update({
      where: { id: userId },
      data: {
        notionAccessToken,
        notionDatabaseId: notionDatabaseId || undefined,
      },
    });

    return NextResponse.redirect(new URL('/settings?success=notion', appUrl));
  } catch (err: any) {
    console.error('Error during Notion token exchange:', err);
    return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(err.message || 'Unknown error')}`, appUrl));
  }
}
