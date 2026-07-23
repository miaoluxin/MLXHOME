import { Component, type ReactNode, type ErrorInfo } from 'react';
import { VscError, VscRefresh } from 'react-icons/vsc';

interface Props {
  children: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary] ${this.props.name || 'Panel'} crashed:`, error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-3 p-6 bg-bg-deep">
          <VscError size={32} className="text-red-400" />
          <div className="text-xs text-text-secondary text-center">
            <p className="font-medium text-text-primary mb-1">{this.props.name || '此面板'} 崩溃了</p>
            <p className="text-text-tertiary">{this.state.error?.message || '未知错误'}</p>
          </div>
          <button onClick={this.handleRetry}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-accent/10 text-accent rounded hover:bg-accent/20 transition-colors">
            <VscRefresh size={12} /> 重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
