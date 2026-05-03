import React from 'react';
import ErrorBoundary from './ErrorBoundary';

/**
 * Higher-order component to wrap a component with an ErrorBoundary
 */
export function withErrorBoundary(WrappedComponent, errorBoundaryProps = {}) {
  return function WithErrorBoundaryWrapper(props) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}
