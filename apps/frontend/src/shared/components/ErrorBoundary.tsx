import { Component, type ReactNode } from 'react';
import { Result, Button } from 'antd';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="500"
          title="Algo sali\u00f3 mal"
          subTitle="La p\u00e1gina encontr\u00f3 un error inesperado."
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              Recargar p\u00e1gina
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}
