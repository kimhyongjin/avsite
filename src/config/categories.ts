export interface Category {
  /** 화면에 표시할 라벨 */
  label: string
  /** URL 경로 (scrape 시에도 사용) */
  path: string
}

/**
 * yasyadong.cc 기준 카테고리 순서에 맞춰 정의합니다.
 * '전체'는 빈 문자열로 매핑해서 루트(`/`)로 이동하도록 할 수도 있고,
 * 별도 페이지(`/category/all`)를 두셔도 됩니다.
 */
export const categories: Category[] = [
  { label: '전체',   path: ''           },  // /category/ 이거나 /videos
  { label: '최신야동', path: 'latest' },
  { label: 'BJ', path: 'latest' },
  { label: '한국야동', path: 'korean'       },
  { label: '일본야동', path: 'japanese'       },
  { label: '서양야동', path: 'american'       },
  { label: '쇼츠야동', path: 'shorts' },
  { label: '애니야동', path: 'anime' },
]