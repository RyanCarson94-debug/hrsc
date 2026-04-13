import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const focusSession = await prisma.focusSession.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!focusSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { status, stepsCompleted, durationMins } = body

  const isEnding = status === 'COMPLETED' || status === 'ABANDONED'

  const updated = await prisma.focusSession.update({
    where: { id: params.id },
    data: {
      status,
      ...(isEnding && { endedAt: new Date() }),
      ...(durationMins !== undefined && { durationMins }),
      ...(stepsCompleted !== undefined && { stepsCompleted }),
    },
  })

  // If completed, update task status if all steps are done
  if (status === 'COMPLETED') {
    const task = await prisma.task.findUnique({
      where: { id: focusSession.taskId },
      include: { steps: true },
    })
    if (task) {
      const allDone = task.steps.length === 0 || task.steps.every((s) => s.completed)
      if (allDone) {
        await prisma.task.update({
          where: { id: task.id },
          data: { status: 'COMPLETED' },
        })
      }
    }
  }

  return NextResponse.json(updated)
}
