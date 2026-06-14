import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/db';
import {
  syncTopicToGoogleCalendar,
  syncTopicToGoogleSheets,
  syncTopicToNotion,
} from '@/lib/syncEngine';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const topics = await prisma.topic.findMany({
      where: { userId },
      include: {
        subject: true,
        revisions: {
          orderBy: { revisionNumber: 'asc' },
        },
      },
      orderBy: { studyDate: 'desc' },
    });

    return NextResponse.json(topics);
  } catch (error) {
    console.error('Error fetching topics:', error);
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const { name, subjectId, studyDate } = await req.json();

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Topic name is required' }, { status: 400 });
    }

    if (!subjectId) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }

    // Verify subject exists and belongs to user
    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, userId },
    });

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    const studyDay = studyDate ? new Date(studyDate) : new Date();
    // Normalize studyDay time to midnight UTC for clean comparison
    studyDay.setHours(0, 0, 0, 0);

    const revisionIntervals = [1, 2, 4, 8];

    // Create topic and revision schedules inside a transaction
    const topic = await prisma.$transaction(async (tx) => {
      const newTopic = await tx.topic.create({
        data: {
          name: name.trim(),
          subjectId,
          userId,
          studyDate: studyDay,
          stage: 0,
          status: 'PENDING',
        },
      });

      // Calculate scheduled dates
      const revisions = revisionIntervals.map((days, index) => {
        const scheduledDate = new Date(studyDay);
        scheduledDate.setDate(scheduledDate.getDate() + days);
        return {
          topicId: newTopic.id,
          revisionNumber: index + 1,
          scheduledDate,
          status: 'PENDING' as const,
        };
      });

      await tx.revisionSchedule.createMany({
        data: revisions,
      });

      return newTopic;
    });

    // Run outbound syncs to Google Calendar, Notion, and Google Sheets in background
    // (We run them and let them execute asynchronously without blocking the response)
    Promise.resolve().then(async () => {
      await syncTopicToGoogleSheets(userId, topic.id);
      await syncTopicToNotion(userId, topic.id);
      await syncTopicToGoogleCalendar(userId, topic.id);
    });

    return NextResponse.json(topic, { status: 201 });
  } catch (error) {
    console.error('Error creating topic:', error);
    return NextResponse.json({ error: 'Failed to create topic' }, { status: 500 });
  }
}
