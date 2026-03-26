import { ReactNode } from 'react';
import { cn } from './ui/utils';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function GlassCard({ children, className, hover = false, onClick }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-[1.75rem] border border-border/50 bg-card/74 shadow-[0_22px_70px_-28px_rgba(15,23,42,0.36)] backdrop-blur-xl',
        hover && 'transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_24px_80px_-28px_rgba(34,197,94,0.28)]',
        className
      )}
    >
      {children}
    </div>
  );
}
