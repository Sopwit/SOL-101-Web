import type { ReactNode } from 'react';
import { cn } from './ui/utils';

interface PageShellProps {
  hero: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PageShell({ hero, children, className }: PageShellProps) {
  return (
    <div className="pb-24 md:pb-28">
      {hero}
      <div className={cn('container mx-auto px-4 md:px-6', className)}>
        <div className="space-y-8 md:space-y-12 xl:space-y-14">{children}</div>
      </div>
    </div>
  );
}
