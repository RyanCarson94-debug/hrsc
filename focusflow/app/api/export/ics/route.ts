import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateICS } from '@/lib/ics'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const blocks = await prisma.scheduledBlock.findMany({
    where: {
      userId: session.user.id,
      ...(from && to ? { date: { gte: from, lte: to } } : {}),
    },
    include: { task: true },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  })

  const icsContent = generateICS(blocks)

  return new NextResponse(icsContent, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="focusflow-schedule.ics"',
    },
  })
}
