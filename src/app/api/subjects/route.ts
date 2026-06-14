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
    const subjects = await prisma.subject.findMany({
      where: { userId },
      include: {
        _count: {
          select: { topics: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(subjects);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    return NextResponse.json({ error: 'Failed to fetch subjects' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const { name } = await req.json();

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Subject name is required' }, { status: 400 });
    }

    const cleanName = name.trim();

    // Check if subject already exists for this user
    const existingSubject = await prisma.subject.findFirst({
      where: {
        name: { equals: cleanName, mode: 'insensitive' },
        userId,
      },
    });

    if (existingSubject) {
      return NextResponse.json({ error: 'Subject already exists' }, { status: 400 });
    }

    const subject = await prisma.subject.create({
      data: {
        name: cleanName,
        userId,
      },
    });

    return NextResponse.json(subject, { status: 201 });
  } catch (error) {
    console.error('Error creating subject:', error);
    return NextResponse.json({ error: 'Failed to create subject' }, { status: 500 });
  }
}
