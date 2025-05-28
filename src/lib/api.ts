export interface Video {
  id: number;
  title: string;
  thumbnailUrl: string;
  views: number;
  category: string;
}

export interface ApiResponse {
  videos: {
    id: number;
    title: string;
    thumbnailUrl: string;
    category: string;
    viewCount: number;      // DB/API가 실제로 쓰는 필드명
  }[];
  pagination: {
    total: number;
    page: number;
    pages: number;
  };
}

/**
 * /api/videos 엔드포인트에서 데이터를 가져와
 * VideoGrid/VideoCard 컴포넌트가 기대하는 형태로 매핑해서 반환합니다.
 */
export async function fetchVideos(
  page: number,
  limit: number
): Promise<{ videos: Video[]; pagination: { total: number; page: number; pages: number } }> {
  const res = await fetch(`/api/videos?page=${page}&limit=${limit}`);
  const json: ApiResponse = await res.json();

  const videos: Video[] = json.videos.map((item) => ({
    id: item.id,
    title: item.title,
    thumbnailUrl: item.thumbnailUrl,
    category: item.category,
    views: item.viewCount,
  }));

  return {
    videos,
    pagination: json.pagination,
  };
}