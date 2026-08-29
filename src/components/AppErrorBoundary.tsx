import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crash:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
          <h1 className="text-lg font-bold text-rose-400">خطأ في التطبيق</h1>
          <p className="mt-3 text-sm text-slate-400">
            حدث خطأ أثناء التحميل. جرّب تحديث الصفحة.
          </p>
          <p className="mt-2 text-xs text-slate-500 break-all" dir="ltr">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900"
          >
            تحديث الصفحة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
