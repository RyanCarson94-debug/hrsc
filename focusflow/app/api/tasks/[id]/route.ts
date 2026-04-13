import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
async function getTask(id: string, userId: string) {
  return prisma.task.findFirst({
    where: { id, userId },
    include: { steps: { orderBy: { order: 'asc' } } },
  })
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const task = await getTask(params.id, session.user.id)
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(task)
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await getTask(params.id, session.user.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { title, description, bucket, effort, durationMins, status, scheduledAt } = body

  // If moving away from NOW, increment resistance
  const movingFromNow = existing.bucket === 'NOW' && bucket && bucket !== 'NOW'

  // Enforce max 3 in NOW
  if (bucket === 'NOW' && existing.bucket !== 'NOW') {
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

  const task = await prisma.task.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(bucket !== undefined && { bucket }),
      ...(effort !== undefined && { effort }),
      ...(durationMins !== undefined && { durationMins }),
      ...(status !== undefined && { status }),
      ...(scheduledAt !== undefined && { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }),
      ...(movingFromNow && { resistanceCount: { increment: 1 } }),
    },
    include: { steps: { orderBy: { order: 'asc' } } },
  })

  return NextResponse.json(task)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await getTask(params.id, session.user.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.task.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
