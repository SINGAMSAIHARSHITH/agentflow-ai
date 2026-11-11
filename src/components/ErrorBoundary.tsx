import React from 'react';
import { AlertTriangle, RotateCcw, RefreshCw } from 'lucide-react';
import { H1Logo } from './H1Logo';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  errorStack: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      errorStack: '',
    };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error && error.stack ? error.stack : '';
    return {
      hasError: true,
      errorMessage: message || 'An unexpected rendering error occurred.',
      errorStack: stack,
    };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo): void {
    console.error('[H1-multilevel ErrorBoundary]', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleResetAndReload = (): void => {
    try {
      window.localStorage.removeItem('h1_agentflow_state_v2');
    } catch {
      // ignore storage errors
    }
    const baseUrl = import.meta.env.BASE_URL || '/agentflow-ai/';
    window.location.href = baseUrl;
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        data-testid="error-fallback-screen"
        className="min-h-screen w-full bg-[#FAF8F6] text-[#302C29] flex items-center justify-center p-6 font-sans"
      >
        <div className="w-full max-w-lg rounded-3xl bg-[#FFFFFF] border border-[#E8E3DF] shadow-[0_12px_36px_-8px_rgba(48,44,41,0.08)] p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between">
            <H1Logo size={28} showWordmark={true} />
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FDF0EE] border border-[#E8B8B4] text-[11.5px] font-medium text-[#C96D65]">
              <AlertTriangle className="w-3.5 h-3.5" />
              Recovery Mode
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-[#302C29]">
              Workspace encountered a runtime exception
            </h1>
            <p className="text-[13.5px] text-[#79736E] leading-relaxed">
              H1-multilevel caught an unexpected error while rendering the interface. Your agent
              workflows and local state are protected. You can reload the page or reset the local
              workspace cache.
            </p>
          </div>

          {this.state.errorMessage && (
            <div className="p-3.5 rounded-2xl bg-[#FAF8F6] border border-[#E8E3DF] text-[12px] font-mono text-[#C96D65] overflow-x-auto">
              {this.state.errorMessage}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFD6C2] hover:bg-[#F2B9A0] text-[#302C29] text-[13px] font-semibold transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Application
            </button>

            <button
              type="button"
              onClick={this.handleResetAndReload}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#F0EFED] text-[#302C29] border border-[#E8E3DF] text-[13px] font-medium transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-[#C78A4A]" />
              Reset Local Cache & Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
