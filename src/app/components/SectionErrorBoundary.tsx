import type { ReactNode } from 'react';
import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { Button } from './ui/button';
import { reportError } from '../lib/telemetry';

interface SectionErrorBoundaryProps {
  children: ReactNode;
  title: string;
  description: string;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
}

export class SectionErrorBoundary extends Component<SectionErrorBoundaryProps, SectionErrorBoundaryState> {
  state: SectionErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    reportError('section-boundary', error, 'Section rendering crashed');
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <GlassCard className="border border-rose-500/20 bg-rose-500/5 p-10 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border border-rose-500/20 bg-rose-500/10 text-rose-100">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h3 className="mb-3 text-2xl font-semibold text-rose-50">{this.props.title}</h3>
        <p className="mx-auto mb-6 max-w-xl text-sm leading-6 text-rose-100/80">{this.props.description}</p>
        <Button className="gap-2" onClick={this.handleRetry}>
          <RefreshCw className="h-4 w-4" />
          Yeniden dene
        </Button>
      </GlassCard>
    );
  }
}
