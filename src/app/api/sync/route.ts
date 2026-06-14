import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { runFullSync } from '@/lib/syncEngine';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const updatedCount = await runFullSync(userId);
    return NextResponse.json({
      success: true,
      message: `Sync completed. ${updatedCount} updates synchronized across integrations.`,
      updatedCount,
    });
  } catch (error: any) {
    console.error('Error during manual sync:', error);
    return NextResponse.json(
      { error: error.message || 'Sync failed. Please verify your integration credentials in settings.' },
      { status: 500 }
    );
  }
}
