import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        timezone: true,
        reminderOffsetMinutes: true,
        emailRemindersEnabled: true,
        browserRemindersEnabled: true,
        dailyReminderTime: true,
        notionAccessToken: true,
        notionDatabaseId: true,
        googleSheetsId: true,
        accounts: {
          select: {
            provider: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const integrations = {
      google: user.accounts.some((a) => a.provider === 'google'),
      notion: !!user.notionAccessToken,
      sheets: !!user.googleSheetsId,
    };

    return NextResponse.json({
      settings: {
        timezone: user.timezone,
        reminderOffsetMinutes: user.reminderOffsetMinutes,
        emailRemindersEnabled: user.emailRemindersEnabled,
        browserRemindersEnabled: user.browserRemindersEnabled,
        dailyReminderTime: user.dailyReminderTime,
        notionDatabaseId: user.notionDatabaseId,
      },
      integrations,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const data = await req.json();

    const updateData: any = {};

    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.reminderOffsetMinutes !== undefined) {
      updateData.reminderOffsetMinutes = parseInt(data.reminderOffsetMinutes, 10);
    }
    if (data.emailRemindersEnabled !== undefined) {
      updateData.emailRemindersEnabled = !!data.emailRemindersEnabled;
    }
    if (data.browserRemindersEnabled !== undefined) {
      updateData.browserRemindersEnabled = !!data.browserRemindersEnabled;
    }
    if (data.dailyReminderTime !== undefined) {
      updateData.dailyReminderTime = data.dailyReminderTime;
    }

    // Direct Developer token connections
    if (data.notionAccessToken !== undefined && data.notionAccessToken.trim() !== '') {
      updateData.notionAccessToken = data.notionAccessToken.trim();
    }
    if (data.notionDatabaseId !== undefined) {
      updateData.notionDatabaseId = data.notionDatabaseId.trim() || null;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return NextResponse.json({
      message: 'Settings updated successfully',
      settings: {
        timezone: updatedUser.timezone,
        reminderOffsetMinutes: updatedUser.reminderOffsetMinutes,
        emailRemindersEnabled: updatedUser.emailRemindersEnabled,
        browserRemindersEnabled: updatedUser.browserRemindersEnabled,
        dailyReminderTime: updatedUser.dailyReminderTime,
        notionDatabaseId: updatedUser.notionDatabaseId,
      },
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
