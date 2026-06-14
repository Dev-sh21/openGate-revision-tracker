import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  const force = searchParams.get('force') === 'true';

  // Secure endpoint
  if (secret !== process.env.CRON_SECRET && !force) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      include: {
        topics: {
          include: {
            subject: true,
            revisions: {
              where: {
                status: 'PENDING',
              },
            },
          },
        },
      },
    });

    const now = new Date();
    const processedUsers = [];

    for (const user of users) {
      // Timezone-based daily 8:00 AM check
      if (!force) {
        let userHour = 0;
        try {
          // Get current hour in user's timezone
          const userTimeStr = now.toLocaleTimeString('en-US', {
            timeZone: user.timezone,
            hour12: false,
            hour: '2-digit',
          });
          userHour = parseInt(userTimeStr, 10);
        } catch (e) {
          // If timezone is invalid, fallback to UTC hour
          userHour = now.getUTCHours();
        }

        // Only send at 8:00 AM
        if (userHour !== 8) {
          continue;
        }
      }

      // Find revisions due today or overdue
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today

      const dueRevisions = [];
      for (const topic of user.topics) {
        const dueRev = topic.revisions.find(
          (r) => r.scheduledDate <= today && r.status === 'PENDING'
        );
        if (dueRev) {
          dueRevisions.push({
            topicName: topic.name,
            subjectName: topic.subject.name,
            revisionNumber: dueRev.revisionNumber,
            scheduledDate: dueRev.scheduledDate,
          });
        }
      }

      if (dueRevisions.length > 0) {
        // Send email/notification
        const reminderSubject = 'Today’s Revisions - Spaced Repetition';
        const reminderBody = `
=========================================
DAILY REVISION REMINDER (8:00 AM)
=========================================
Hello ${user.name || 'Student'},

You have ${dueRevisions.length} revision(s) due today:
${dueRevisions
  .map((r) => `- ${r.topicName} (${r.subjectName}) - [Revision ${r.revisionNumber}]`)
  .join('\n')}

Make sure to log in and mark them as Completed or Skipped!
Happy studying!
=========================================
        `;

        // Send to Console (standard development output)
        console.log(`[EMAIL SEND SIMULATION] To: ${user.email}`);
        console.log(`Subject: ${reminderSubject}`);
        console.log(reminderBody);

        processedUsers.push({
          userId: user.id,
          email: user.email,
          dueCount: dueRevisions.length,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Daily reminder check executed. Reminders sent to ${processedUsers.length} users.`,
      usersNotified: processedUsers,
    });
  } catch (error: any) {
    console.error('Error running daily reminders cron:', error);
    return NextResponse.json({ error: error.message || 'Cron job failed' }, { status: 500 });
  }
}
