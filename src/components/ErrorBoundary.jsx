import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { createLogger } from '../utils/logger';

const log = createLogger('ErrorBoundary');

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
    this._maxErrors = props.maxErrors ?? 3;
  }

  static getDerivedStateFromError(_error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const errorCount = this.state.errorCount + 1;

    log.error('Component error caught', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack?.slice(0, 500),
      componentStack: errorInfo?.componentStack?.slice(0, 500),
      count: errorCount,
    });

    this.setState({ error, errorInfo, errorCount });

    if (this.props.onError) {
      try { this.props.onError(error, errorInfo); } catch (_) { /* noop */ }
    }
  }

  handleReset = () => {
    const { errorCount } = this.state;
    if (errorCount >= this._maxErrors) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) this.props.onReset();
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({ error: this.state.error, reset: this.handleReset })
          : this.props.fallback;
      }

      const { errorCount } = this.state;

      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-app)] p-4">
          <div className="max-w-md w-full bg-[var(--color-bg-white)] rounded-2xl shadow-xl p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <AlertTriangle size={32} className="text-red-500" />
            </div>

            <h1 className="text-xl font-bold text-[var(--color-text-main)] mb-2">
              {this.props.title || (errorCount >= this._maxErrors ? 'Multiple errors detected' : 'Something went wrong')}
            </h1>

            <p className="text-sm text-[var(--color-text-muted)] mb-6">
              {this.props.message || (errorCount >= this._maxErrors
                ? 'The page will reload to recover. You may lose unsaved data.'
                : 'An unexpected error occurred. Please try again.')}
            </p>

            {import.meta.env.DEV && this.state.error && (
              <details className="text-left mb-6 p-3 bg-[var(--color-bg-app)] rounded-lg overflow-auto max-h-40">
                <summary className="text-xs font-medium text-[var(--color-text-muted)] cursor-pointer select-none">
                  Error Details
                </summary>
                <pre className="mt-2 text-xs text-red-500 whitespace-pre-wrap break-all">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-[var(--color-on-primary)] font-medium text-sm hover:opacity-90 transition-opacity"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 rounded-lg bg-[var(--color-bg-app)] text-[var(--color-text-main)] font-medium text-sm hover:bg-[var(--color-bg-hover)] transition-colors flex items-center gap-2"
              >
                <RefreshCw size={14} />
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
