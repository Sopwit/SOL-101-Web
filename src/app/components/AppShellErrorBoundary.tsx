import type { ReactNode } from 'react';
import { Component } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Link } from 'react-router';
import { GlassCard } from './GlassCard';
import { Button } from './ui/button';
import { reportError } from '../lib/telemetry';

interface AppShellErrorBoundaryProps {
  children: ReactNode;
}

interface AppShellErrorBoundaryState {
  hasError: boolean;
}

export class AppShellErrorBoundary extends Component<AppShellErrorBoundaryProps, AppShellErrorBoundaryState> {
  state: AppShellErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    reportError('app-shell-boundary', error, 'Route rendering crashed');
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="container mx-auto px-4 py-14 md:px-6 md:py-20">
        <GlassCard className="border border-amber-500/20 bg-amber-500/5 p-8 text-center md:p-12">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.4rem] border border-amber-500/20 bg-amber-500/10 text-amber-100">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="mb-3 text-2xl font-black tracking-[0.05em] text-foreground md:text-3xl">
            Bu ekran gecici olarak toparlanamadi
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
            Uygulamanin tamami kapanmadi. Sadece bu rota render edilirken beklenmeyen bir hata olustu.
            Yeniden deneyebilir veya ana sayfaya donerek akisa devam edebilirsin.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button className="gap-2" onClick={this.handleRetry}>
              <RefreshCw className="h-4 w-4" />
              Yeniden dene
            </Button>
            <Link to="/?forceHome=1">
              <Button variant="outline" className="gap-2">
                <Home className="h-4 w-4" />
                Ana sayfaya don
              </Button>
            </Link>
          </div>
        </GlassCard>
      </div>
    );
  }
}
