import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify task ownership
  const task = await prisma.task.findFirst({ where: { id: params.id, userId: session.user.id } })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { steps } = body as { steps: { id?: string; title: string; order: number; completed?: boolean }[] }

  // Replace all steps: delete existing, create new
  await prisma.taskStep.deleteMany({ where: { taskId: params.id } })

  if (steps?.length) {
    await prisma.taskStep.createMany({
      data: steps.map((s) => ({
        taskId: params.id,
        title: s.title.trim(),
        order: s.order,
        completed: s.completed ?? false,
      })),
    })
  }

  const updated = await prisma.task.findFirst({
    where: { id: params.id },
    include: { steps: { orderBy: { order: 'asc' } } },
  })

  return NextResponse.json(updated)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  // Toggle a single step's completed state
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const task = await prisma.task.findFirst({ where: { id: params.id, userId: session.user.id } })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { stepId, completed } = body

  const step = await prisma.taskStep.update({
    where: { id: stepId },
    data: { completed },
  })

  return NextResponse.json(step)
}
