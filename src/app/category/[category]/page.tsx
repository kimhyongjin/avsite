import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import VideoCard from '@/components/VideoCard'

interface Props {
  params: Promise<{ category: string }>
  searchParams: Promise<{ page?: string }>
}

export default async function CategoryPage({
  params,
  searchParams,
}: Props) {
  // ① params, searchParams 해제
  const { category } = await params
  const slug = decodeURIComponent(category)           // URL 슬러그
  const { page = '1' } = await searchParams

  // ② slug → DB에 저장된 category 컬럼명 매핑
  const slugToDbCategory: Record<string,string> = {
    latest  : 'H 최신야동',
    korean  : '한국야동',
    japanese: '일본야동',
    chinese : '일본야동',   // “중국야동”은 “일본야동”으로 합치기
    american: '서양야동',
    shorts  : '쇼츠야동',
    anime   : '애니야동',
  }
  const dbCategory = slugToDbCategory[slug] ?? slug

  // ③ slug → 화면에 보여줄 라벨 매핑
  const slugToDisplay: Record<string,string> = {
    latest : '최신야동',
    shorts : '쇼츠야동',
    anime  : '애니야동',
  }
  const displayCategory = slugToDisplay[slug] ?? dbCategory

  // ④ 페이징 계산
  const pageNumber = Math.max(1, parseInt(page, 10))
  const limit = 12
  const skip = (pageNumber - 1) * limit

  // ⑤ DB에서 video 목록과 총 개수 조회
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
      {/* ⑥ 화면에 표시할 카테고리 타이틀 */}
      <h1 className="text-3xl font-bold mb-6 capitalize">
        {displayCategory}
      </h1>

      {videos.length === 0 ? (
        <p className="text-center text-gray-500">
          이 카테고리에 등록된 영상이 없습니다.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>

          <nav className="flex justify-center items-center space-x-4">
            <Link
              href={`/category/${encodeURIComponent(slug)}?page=${pageNumber - 1}`}
            >
              <button
                disabled={pageNumber <= 1}
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
              >
                Prev
              </button>
            </Link>
            <span className="text-gray-700">
              {pageNumber} / {pages}
            </span>
            <Link
              href={`/category/${encodeURIComponent(slug)}?page=${pageNumber + 1}`}
            >
              <button
                disabled={pageNumber >= pages}
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
              >
                Next
              </button>
            </Link>
          </nav>
        </>
      )}
    </main>
  )
}