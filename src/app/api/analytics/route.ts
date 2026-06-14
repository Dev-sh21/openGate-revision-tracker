import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Topics studied this month
    const topicsThisMonth = await prisma.topic.count({
      where: {
        userId,
        studyDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    // Total topics
    const totalTopics = await prisma.topic.count({ where: { userId } });

    // Mastered topics
    const masteredTopics = await prisma.topic.count({
      where: { userId, status: 'MASTERED' },
    });

    // Completed revisions this month
    const completedThisMonth = await prisma.revisionSchedule.count({
      where: {
        topic: { userId },
        status: 'COMPLETED',
        completedDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    // Total completed revisions
    const totalCompleted = await prisma.revisionSchedule.count({
      where: {
        topic: { userId },
        status: 'COMPLETED',
      },
    });

    // Total possible revisions (each topic has 4)
    const totalPossible = totalTopics * 4;
    const completionRate = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

    // Subject-wise breakdown
    const subjects = await prisma.subject.findMany({
      where: { userId },
      include: {
        _count: { select: { topics: true } },
        topics: {
          include: {
            revisions: {
              where: { status: 'COMPLETED' },
            },
          },
        },
      },
    });

    const subjectStats = subjects.map((s) => ({
      name: s.name,
      topics: s._count.topics,
      completedRevisions: s.topics.reduce((acc, t) => acc + t.revisions.length, 0),
    }));

    // Compute streak from completion history
    const completionHistory = await prisma.completionHistory.findMany({
      where: { topic: { userId } },
      select: { completedAt: true },
      orderBy: { completedAt: 'desc' },
    });

    const completionDates = new Set(
      completionHistory.map((h) => h.completedAt.toISOString().split('T')[0])
    );

    let streak = 0;
    const checkDate = new Date();
    const todayStr = checkDate.toISOString().split('T')[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

    if (completionDates.has(todayStr) || completionDates.has(yesterdayStr)) {
      let cursor = new Date();
      if (!completionDates.has(todayStr)) cursor.setDate(cursor.getDate() - 1);
      while (true) {
        const dateStr = cursor.toISOString().split('T')[0];
        if (completionDates.has(dateStr)) {
          streak++;
          cursor.setDate(cursor.getDate() - 1);
        } else break;
      }
    }

    // Last 7-day daily study consistency
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const startDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const endDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      const count = await prisma.topic.count({
        where: { userId, studyDate: { gte: startDay, lte: endDay } },
      });
      last7Days.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        studied: count,
      });
    }

    return NextResponse.json({
      topicsThisMonth,
      totalTopics,
      masteredTopics,
      completedThisMonth,
      totalCompleted,
      completionRate,
      streak,
      subjectStats,
      last7Days,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
