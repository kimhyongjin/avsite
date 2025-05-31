export const dynamic = 'force-dynamic'
export const revalidate = 0

import React from 'react'
import Link from 'next/link'
import VideoCard from '@/components/VideoCard'
import { prisma } from '@/lib/prisma'

interface Props {
  params: { category: string }
  searchParams?: { page?: string }
}

export default async function CategoryPage({
  params,
  searchParams,
}: Props) {
  const { category } = await params
  const slug = decodeURIComponent(category)
  const { page = '1' } = (await searchParams) ?? {}

  const slugToDbCategory: Record<string,string> = {
    latest  : '최신야동',
    korean  : '한국야동',
    japanese: '일본야동',
    chinese : '일본야동',
    american: '서양야동',
    '서양야동': '미국야동',
    shorts  : '쇼츠야동',
    anime   : '애니야동',
  }
  const dbCategory = slugToDbCategory[slug] ?? slug

  const slugToDisplay: Record<string,string> = {
    latest : '최신야동',
    shorts : '쇼츠야동',
    anime  : '애니야동',
  }
  const displayCategory = slugToDisplay[slug] ?? dbCategory

  const pageNumber = Math.max(1, parseInt(page, 10))
  const limit = 40        // ← 한 페이지당 40개
  const skip = (pageNumber - 1) * limit

  const [videos, total] = await Promise.all([
    prisma.video.findMany({
      where: { category: dbCategory },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, thumbnailUrl: true, category: true },
    }),
    prisma.video.count({ where: { category: dbCategory } }),
  ])

  const pages = Math.ceil(total / limit)

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 capitalize">
        {displayCategory}
      </h1>

      {videos.length === 0 ? (
        <p className="text-center text-gray-500">
          이 카테고리에 등록된 영상이 없습니다.
        </p>
      ) : (
        <>
          {/* 4열 그리드 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map((v: { id: number; title: string; thumbnailUrl: string; category: string }) => (
       <VideoCard key={v.id} video={v} />
        ))}
          </div>

          <nav className="flex justify-center items-center space-x-2 mt-8">
            <Link href={`/category/${encodeURIComponent(slug)}?page=${pageNumber - 1}`}>
              <button
                disabled={pageNumber <= 1}
                className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
              >
                이전
              </button>
            </Link>

            {Array.from({ length: Math.min(10, pages) }, (_, i) => {
              const p = i + 1
              return (
                <Link key={p} href={`/category/${encodeURIComponent(slug)}?page=${p}`}>
                  <button
                    className={`px-3 py-1 rounded ${
                      p === pageNumber
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {p}
                  </button>
                </Link>
              )
            })}

            <Link href={`/category/${encodeURIComponent(slug)}?page=${pageNumber + 1}`}>
              <button
                disabled={pageNumber >= pages}
                className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
              >
                다음
              </button>
            </Link>
          </nav>

          {/* ── 하단 안내 문구 ── */}
          <div className="mt-6 px-4 text-xs leading-relaxed text-gray-600 space-y-2">
            <p>
              AV코리아는 고화질 야동, 한국야동, 일본야동, 동양야동, 중국야동, 서양야동, 성인방송 및 전 세계 야동을 무료로 실시간 감상 할 수 있습니다.
              AV코리아(YAKO.NET)는 100% 무료 야동 서비스 사이트 입니다.
              매일 1000~2000개의 야동이 업로드됩니다. (게이 및 쉬멜은 필터링 되며 야동 검색시 이용가능합니다.)
            </p>
            <p>
              All models appearing on this website are 18 years or older. Indian desi xxx hindi sex xnxx.
              18 U.S.C. 2257 and 2257A Record-Keeping Requirements Compliance Statement
            </p>
            <p>
              YAKO4.NET is rated with RTA label. Parents, you can easily block access to this site. Please read this page for more informations.
            </p>
            <p>
              AV코리아(AVYADONGKOREA) - the best free porn videos on internet, 100% free.
            </p>
          </div>
        </>
      )}
    </main>
  )
}