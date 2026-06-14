import { Client } from '@notionhq/client';
import { prisma } from '@/lib/db';

export async function getNotionClient(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notionAccessToken: true },
  });

  if (!user || !user.notionAccessToken) {
    return null;
  }

  return new Client({
    auth: user.notionAccessToken,
  });
}
