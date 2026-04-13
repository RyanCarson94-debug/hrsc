import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const bucket = searchParams.get('bucket')
  const effort = searchParams.get('effort')
  const status = searchParams.get('status') ?? 'ACTIVE'

  const tasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      ...(bucket ? { bucket } : {}),
      ...(effort ? { effort } : {}),
      status,
    },
    include: { steps: { orderBy: { order: 'asc' } } },
    orderBy: [{ bucket: 'asc' }, { createdAt: 'asc' }],
  })

  return NextResponse.json(tasks)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, description, bucket, effort, durationMins, scheduledAt, steps } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  // Enforce max 3 tasks in NOW bucket
  if (bucket === 'NOW') {
    const nowCount = await prisma.task.count({
      where: { userId: session.user.id, bucket: 'NOW', status: 'ACTIVE' },
    })
    if (nowCount >= 3) {
      return NextResponse.json(
        { error: 'You already have 3 tasks in Now. Move one to Soon or Later first.' },
        { status: 422 },
      )
    }
  }

  const task = await prisma.task.create({
    data: {
      userId: session.user.id,
      title: title.trim(),
      description: description?.trim() || null,
      bucket: bucket || 'SOON',
      effort: effort || 'MEDIUM',
      durationMins: durationMins || 25,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      steps: steps?.length
        ? {
            create: steps.map((s: { title: string }, i: number) => ({
              title: s.title.trim(),
              order: i,
            })),
          }
        : undefined,
    },
    include: { steps: { orderBy: { order: 'asc' } } },
  })

  return NextResponse.json(task, { status: 201 })
}
