import { Bell, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import type { SystemStatusItem } from '../types';
import { SystemStatusCard } from './SystemStatusCard';

interface NotificationRailProps {
  title: string;
  description: string;
  items: SystemStatusItem[];
  triggerLabel?: string;
}

export function NotificationRail({ title, description, items, triggerLabel = 'Status' }: NotificationRailProps) {
  const issueCount = items.filter((item) => item.state !== 'healthy').length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          className="fixed right-4 bottom-6 z-40 h-auto rounded-full border border-border/60 bg-background/88 px-4 py-3 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.55)] backdrop-blur-2xl md:right-6 md:bottom-10"
          variant="outline"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bell className="h-4 w-4" />
            </span>
            <span className="text-left">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{triggerLabel}</span>
              <span className="block text-sm font-semibold">
                {issueCount > 0 ? `${issueCount} aktif uyari` : 'Tum sistemler normal'}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="overflow-y-auto border-l border-border/60 bg-background/96 sm:max-w-lg">
        <SheetHeader className="border-b border-border/50 px-6 py-6">
          <SheetTitle className="text-xl font-black tracking-[0.08em]">{title}</SheetTitle>
          <SheetDescription className="leading-6">{description}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-5 py-5">
          {items.map((item) => (
            <SystemStatusCard key={item.id} status={item} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
