import { PrismaClient } from '@prisma/client'

declare global {
  // 개발 중 핫 리로드 시 중복 인스턴스 방지
  // @ts-ignore
  var prisma: PrismaClient | undefined
}

const client = global.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  global.prisma = client
}

// **named export만** 제공합니다.
export const prisma = client