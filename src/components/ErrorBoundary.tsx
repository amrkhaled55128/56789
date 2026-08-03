import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application render failure', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="fatal-error" role="alert" dir="rtl">
        <div className="fatal-error-card">
          <span className="fatal-error-icon"><AlertTriangle size={28} /></span>
          <h1>حدث خطأ غير متوقع</h1>
          <p>بياناتك محفوظة. أعد تحميل الصفحة، وإذا تكرر الخطأ تواصل مع مسؤول النظام.</p>
          <button className="button primary" onClick={() => window.location.reload()}>
            <RefreshCw size={17} /> إعادة تحميل النظام
          </button>
        </div>
      </main>
    );
  }
}
