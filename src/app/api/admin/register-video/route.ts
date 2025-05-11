export const runtime = 'nodejs'
export const config  = { api: { bodyParser: false } }

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { title, videoKey, thumbKey, category } = (await req.json()) as {
      title: string
      videoKey: string
      thumbKey: string
      category: string
    }

    const bucket       = process.env.S3_BUCKET!
    const region       = process.env.AWS_REGION!
    const videoUrl     = `https://${bucket}.s3.${region}.amazonaws.com/${videoKey}`
    const thumbnailUrl = `https://${bucket}.s3.${region}.amazonaws.com/${thumbKey}`

    const video = await prisma.video.create({
      data: {
        title,
        category,
        videoUrl,
        thumbnailUrl,
      },
    })

    return NextResponse.json(video)
  } catch (err: any) {
    console.error('REGISTER-VIDEO ERROR ▶', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
