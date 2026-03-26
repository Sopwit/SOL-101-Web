import { AlertTriangle, CheckCircle2, Database, ImageOff, RefreshCw, ServerCrash, Wallet } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { Button } from './ui/button';
import { cn } from './ui/utils';
import type { SystemStatusItem } from '../types';

interface SystemStatusCardProps {
  status: SystemStatusItem;
  compact?: boolean;
  onRetry?: () => void;
}

const sourceIconMap = {
  onchain: Wallet,
  backend: Database,
  assets: ImageOff,
  ui: ServerCrash,
} as const;

const stateToneMap = {
  healthy: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-100',
  degraded: 'border-amber-500/20 bg-amber-500/5 text-amber-100',
  offline: 'border-rose-500/20 bg-rose-500/5 text-rose-100',
} as const;

const stateBadgeMap = {
  healthy: 'Canli',
  degraded: 'Kisitli',
  offline: 'Kapali',
} as const;

export function SystemStatusCard({ status, compact = false, onRetry }: SystemStatusCardProps) {
  const SourceIcon = sourceIconMap[status.source];
  const StatusIcon = status.state === 'healthy' ? CheckCircle2 : AlertTriangle;

  return (
    <GlassCard
      className={cn(
        'border p-5',
        stateToneMap[status.state],
        compact ? 'h-full' : 'p-6'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-current/20 bg-black/10">
            <SourceIcon className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold tracking-[0.18em] text-current/90 uppercase">{status.title}</h3>
              <span className="rounded-full border border-current/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-current/75">
                {stateBadgeMap[status.state]}
              </span>
            </div>
            <p className="text-sm leading-6 text-current/75">{status.detail}</p>
          </div>
        </div>
        <StatusIcon className="mt-0.5 h-5 w-5 shrink-0 text-current/85" />
      </div>

      {(status.context || status.checkedAt) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-current/55">
          {status.context ? <span>{status.context}</span> : null}
          {status.checkedAt ? <span>{status.checkedAt}</span> : null}
        </div>
      )}

      {onRetry && status.state !== 'healthy' && (
        <div className="mt-4">
          <Button
            variant="outline"
            className="gap-2 border-current/20 bg-transparent text-current hover:bg-black/10 hover:text-current"
            onClick={onRetry}
          >
            <RefreshCw className="h-4 w-4" />
            Yeniden dene
          </Button>
        </div>
      )}
    </GlassCard>
  );
}
