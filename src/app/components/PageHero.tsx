import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { GlassCard } from './GlassCard';

type HeroMetric = {
  label: string;
  value: string;
};

interface PageHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  accent?: string;
  panelTitle?: string;
  panelBody?: string;
  metrics?: HeroMetric[];
  actions?: ReactNode;
}

export function PageHero({
  eyebrow,
  title,
  description,
  accent = 'from-cyan-400/20 via-emerald-300/10 to-orange-300/20',
  panelTitle,
  panelBody,
  metrics = [],
  actions,
}: PageHeroProps) {
  return (
    <section className="relative overflow-hidden px-4 py-14 md:px-6 md:py-20">
      <div className={`absolute inset-0 bg-gradient-to-br ${accent}`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.12),transparent_28%)]" />
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.16)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="container relative z-10 mx-auto">
        <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-end xl:gap-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="max-w-3xl py-2"
          >
            <div className="mb-5 inline-flex rounded-full border border-border/60 bg-background/72 px-4 py-1.5 text-xs font-semibold tracking-[0.24em] text-muted-foreground backdrop-blur">
              {eyebrow}
            </div>
            <h1 className="mb-5 text-4xl font-black tracking-[0.06em] md:text-6xl xl:text-7xl">{title}</h1>
            <p className="max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">{description}</p>
            {actions ? <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div> : null}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, delay: 0.08 }}
          >
            <GlassCard className="overflow-hidden border-primary/20 p-6 md:p-7">
              <div className="space-y-5">
                {(panelTitle || panelBody) && (
                  <div>
                    {panelTitle ? (
                      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">{panelTitle}</p>
                    ) : null}
                    {panelBody ? <p className="mt-3 text-lg font-semibold leading-8">{panelBody}</p> : null}
                  </div>
                )}

                {metrics.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {metrics.map((metric) => (
                      <div key={metric.label} className="rounded-[1.35rem] border border-border/50 bg-background/60 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{metric.label}</p>
                        <p className="mt-2 text-2xl font-black">{metric.value}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
