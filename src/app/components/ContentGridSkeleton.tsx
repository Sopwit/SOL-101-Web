import { GlassCard } from './GlassCard';
import { Skeleton } from './ui/skeleton';

interface ContentGridSkeletonProps {
  count?: number;
  cardClassName?: string;
  imageClassName?: string;
  contentLines?: number;
}

export function ContentGridSkeleton({
  count = 4,
  cardClassName = 'overflow-hidden',
  imageClassName = 'aspect-[4/3]',
  contentLines = 3,
}: ContentGridSkeletonProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <GlassCard key={`content-skeleton-${index}`} className={cardClassName}>
          <Skeleton className={imageClassName} />
          <div className="space-y-4 p-5">
            <Skeleton className="h-5 w-2/3" />
            {Array.from({ length: contentLines }, (_line, lineIndex) => (
              <Skeleton key={`content-line-${index}-${lineIndex}`} className={`h-4 ${lineIndex === contentLines - 1 ? 'w-1/2' : 'w-full'}`} />
            ))}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
