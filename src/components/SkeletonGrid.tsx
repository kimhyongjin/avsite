interface SkeletonGridProps {
  count?: number;
}

export default function SkeletonGrid({ count = 6 }: SkeletonGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card">
          <div className="skeleton card-image" />
          <div className="card-content">
            <div className="skeleton h-5 w-3/4 mb-2" />
            <div className="skeleton h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
