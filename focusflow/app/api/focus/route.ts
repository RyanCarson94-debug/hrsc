import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { taskId } = body

  if (!taskId) return NextResponse.json({ error: 'taskId is required' }, { status: 400 })

  const task = await prisma.task.findFirst({ where: { id: taskId, userId: session.user.id } })
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  // Abandon any currently active sessions for this user
  await prisma.focusSession.updateMany({
    where: { userId: session.user.id, status: 'ACTIVE' },
    data: { status: 'ABANDONED', endedAt: new Date() },
  })

  const focusSession = await prisma.focusSession.create({
    data: {
      userId: session.user.id,
      taskId,
      status: 'ACTIVE',
    },
    include: { task: { include: { steps: { orderBy: { order: 'asc' } } } } },
  })

  return NextResponse.json(focusSession, { status: 201 })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const active = await prisma.focusSession.findFirst({
    where: { userId: session.user.id, status: 'ACTIVE' },
    include: { task: { include: { steps: { orderBy: { order: 'asc' } } } } },
  })

  return NextResponse.json(active)
}
