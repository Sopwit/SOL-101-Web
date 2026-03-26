import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Inbox, RefreshCw, Sparkles } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { Button } from './ui/button';
import { cn } from './ui/utils';

interface ModuleStateCardProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  tone?: 'default' | 'warning' | 'error';
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const toneStyles = {
  default: 'border-border/50 bg-card/74',
  warning: 'border-amber-500/25 bg-amber-500/6',
  error: 'border-rose-500/25 bg-rose-500/6',
} as const;

export function ModuleStateCard({
  title,
  description,
  icon: Icon = Inbox,
  tone = 'default',
  actionLabel,
  onAction,
  className,
}: ModuleStateCardProps) {
  return (
    <GlassCard className={cn('p-8 text-center md:p-10', toneStyles[tone], className)}>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] border border-current/10 bg-black/10 text-foreground/80">
          <Icon className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black tracking-[0.06em]">{title}</h3>
          <p className="text-sm leading-7 text-muted-foreground md:text-base">{description}</p>
        </div>
        {actionLabel && onAction ? (
          <Button variant="outline" className="gap-2" onClick={onAction}>
            <RefreshCw className="h-4 w-4" />
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </GlassCard>
  );
}

export function LoadingStateCard({ title = 'Yukleniyor', description = 'Icerik getiriliyor, bu panel kisa sure icinde hazir olacak.' }: Pick<ModuleStateCardProps, 'title' | 'description'>) {
  return <ModuleStateCard title={title} description={description} icon={Sparkles} />;
}

export function EmptyStateCard({ title, description, actionLabel, onAction, icon = Inbox, className }: ModuleStateCardProps) {
  return (
    <ModuleStateCard
      title={title}
      description={description}
      actionLabel={actionLabel}
      onAction={onAction}
      icon={icon}
      className={className}
    />
  );
}

export function MaintenanceStateCard({ title, description, onAction }: { title: string; description: string; onAction?: () => void }) {
  return (
    <ModuleStateCard
      title={title}
      description={description}
      icon={AlertTriangle}
      tone="warning"
      actionLabel={onAction ? 'Yeniden dene' : undefined}
      onAction={onAction}
    />
  );
}
