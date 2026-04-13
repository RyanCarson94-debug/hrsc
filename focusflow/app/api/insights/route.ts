import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { computeInsights } from '@/lib/insights'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessions = await prisma.focusSession.findMany({
    where: { userId: session.user.id },
    include: { task: true },
    orderBy: { startedAt: 'desc' },
    take: 100,
  })

  const insights = computeInsights(sessions)
  return NextResponse.json(insights)
}
