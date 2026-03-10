import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  nodeId: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class NodeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Error caught in node ${this.props.nodeId}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-4 min-h-[100px] min-w-[150px] bg-destructive/10 border-2 border-destructive rounded-lg text-destructive">
          <AlertTriangle className="h-6 w-6 mb-2 text-destructive" />
          <p className="text-xs font-bold text-center">Node Render Error</p>
          <p className="text-[10px] text-center mt-1 opacity-80 break-words max-w-full">
            {this.state.error?.message || 'Unknown error'}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
