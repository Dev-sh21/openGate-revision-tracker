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
  const filter = searchParams.get('filter'); // 'today' | 'overdue' | 'upcoming' | 'all'

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let whereClause: any = {
      topic: { userId },
    };

    if (filter === 'today') {
      whereClause = {
        topic: { userId },
        status: 'PENDING',
        scheduledDate: { gte: todayStart, lte: todayEnd },
      };
    } else if (filter === 'overdue') {
      whereClause = {
        topic: { userId },
        status: 'PENDING',
        scheduledDate: { lt: todayStart },
      };
    } else if (filter === 'upcoming') {
      whereClause = {
        topic: { userId },
        status: 'PENDING',
        scheduledDate: { gt: todayEnd },
      };
    } else {
      whereClause = { topic: { userId } };
    }

    const revisions = await prisma.revisionSchedule.findMany({
      where: whereClause,
      include: {
        topic: {
          include: { subject: true },
        },
      },
      orderBy: { scheduledDate: 'asc' },
    });

    return NextResponse.json(revisions);
  } catch (error) {
    console.error('Error fetching revisions:', error);
    return NextResponse.json({ error: 'Failed to fetch revisions' }, { status: 500 });
  }
}
