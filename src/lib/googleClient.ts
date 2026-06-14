import { prisma } from '@/lib/db';
import { google } from 'googleapis';

export async function getGoogleClient(userId: string) {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: 'google',
    },
  });

  if (!account) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || 'placeholder',
    process.env.GOOGLE_CLIENT_SECRET || 'placeholder',
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback/google`
  );

  oauth2Client.setCredentials({
    access_token: account.access_token || undefined,
    refresh_token: account.refresh_token || undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });

  // Automatically handle token refresh events from googleapis client
  oauth2Client.on('tokens', async (tokens) => {
    const updateData: any = {};
    if (tokens.access_token) updateData.access_token = tokens.access_token;
    if (tokens.expiry_date) updateData.expires_at = Math.floor(tokens.expiry_date / 1000);
    if (tokens.refresh_token) updateData.refresh_token = tokens.refresh_token;

    if (Object.keys(updateData).length > 0) {
      try {
        await prisma.account.update({
          where: { id: account.id },
          data: updateData,
        });
      } catch (err) {
        console.error('Error updating refreshed Google tokens in database:', err);
      }
    }
  });

  return oauth2Client;
}
