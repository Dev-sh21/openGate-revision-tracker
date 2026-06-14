import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/db';
import {
  syncTopicToGoogleCalendar,
  syncTopicToGoogleSheets,
  syncTopicToNotion,
} from '@/lib/syncEngine';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const revisionId = params.id;

  try {
    const { action } = await req.json(); // 'complete' or 'skip'

    if (action !== 'complete' && action !== 'skip') {
      return NextResponse.json({ error: "Invalid action. Must be 'complete' or 'skip'." }, { status: 400 });
    }

    // Find the revision schedule
    const revision = await prisma.revisionSchedule.findUnique({
      where: { id: revisionId },
      include: {
        topic: true,
      },
    });

    if (!revision || revision.topic.userId !== userId) {
      return NextResponse.json({ error: 'Revision not found' }, { status: 404 });
    }

    const topicId = revision.topicId;
    const revNum = revision.revisionNumber;
    const status = action === 'complete' ? 'COMPLETED' : 'SKIPPED';

    await prisma.$transaction(async (tx) => {
      // 1. Update the revision status
      await tx.revisionSchedule.update({
        where: { id: revisionId },
        data: {
          status,
          completedDate: action === 'complete' ? new Date() : null,
        },
      });

      // 2. Log in completion history
      await tx.completionHistory.create({
        data: {
          topicId,
          revisionNumber: revNum,
          status,
          completedAt: new Date(),
        },
      });

      // 3. Update the Topic's current stage and overall status
      let nextStage = revNum; // Since they finished revision `revNum`, their stage is now `revNum`
      let topicStatus = 'COMPLETED';

      if (revNum === 4) {
        nextStage = 5; // Mastered
        topicStatus = 'MASTERED';
      }

      await tx.topic.update({
        where: { id: topicId },
        data: {
          stage: nextStage,
          status: topicStatus as any,
        },
      });
    });

    // Run outbound syncs to Google Calendar, Notion, and Google Sheets in background
    Promise.resolve().then(async () => {
      await syncTopicToGoogleSheets(userId, topicId);
      await syncTopicToNotion(userId, topicId);
      await syncTopicToGoogleCalendar(userId, topicId);
    });

    return NextResponse.json({ success: true, message: `Revision marked as ${action}d.` });
  } catch (error) {
    console.error('Error updating revision schedule:', error);
    return NextResponse.json({ error: 'Failed to update revision' }, { status: 500 });
  }
}
