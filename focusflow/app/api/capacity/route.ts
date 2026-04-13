import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') ?? new Date().toISOString().split('T')[0]
  const to = searchParams.get('to') ?? from

  const blocks = await prisma.scheduledBlock.findMany({
    where: {
      userId: session.user.id,
      date: { gte: from, lte: to },
    },
    include: { task: true },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  })

  return NextResponse.json(blocks)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, date, startTime, endTime, taskId } = body

  if (!title?.trim() || !date || !startTime || !endTime) {
    return NextResponse.json({ error: 'title, date, startTime, endTime are required' }, { status: 400 })
  }

  const block = await prisma.scheduledBlock.create({
    data: {
      userId: session.user.id,
      title: title.trim(),
      date,
      startTime,
      endTime,
      taskId: taskId || null,
    },
    include: { task: true },
  })

  return NextResponse.json(block, { status: 201 })
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const block = await prisma.scheduledBlock.findFirst({ where: { id, userId: session.user.id } })
  if (!block) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.scheduledBlock.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
