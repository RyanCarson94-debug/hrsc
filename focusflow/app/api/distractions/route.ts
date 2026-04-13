import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { sessionId, content } = body

  if (!sessionId || !content?.trim()) {
    return NextResponse.json({ error: 'sessionId and content are required' }, { status: 400 })
  }

  const focusSession = await prisma.focusSession.findFirst({
    where: { id: sessionId, userId: session.user.id },
  })
  if (!focusSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const note = await prisma.distractionNote.create({
    data: {
      sessionId,
      userId: session.user.id,
      content: content.trim(),
    },
  })

  return NextResponse.json(note, { status: 201 })
}
