import { ErrorBoundary as SolidErrorBoundary, type JSX } from 'solid-js';
import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';

export interface ErrorBoundaryProps {
  children: JSX.Element;
  fallback?: (error: Error, reset: () => void) => JSX.Element;
  onError?: (error: Error) => void;
}

function DefaultErrorFallback(error: Error, reset: () => void) {
  return (
    <Card class="max-w-md mx-auto">
      <CardHeader>
        <CardTitle class="flex items-center gap-2 text-destructive">
          <Icon name="triangle-alert" class="h-5 w-5" />
          Something went wrong
        </CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <p class="text-sm text-muted-foreground">
          An error occurred while processing your request. This might be a temporary issue.
        </p>
        <details class="text-xs">
          <summary class="cursor-pointer text-muted-foreground hover:text-foreground">
            Error details
          </summary>
          <pre class="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
            {error.message}
          </pre>
        </details>
        <div class="flex gap-2">
          <Button onClick={reset} size="sm">
            <Icon name="refresh-cw" class="h-4 w-4 mr-2" />
            Try again
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.location.reload()}
          >
            Reload page
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return (
    <SolidErrorBoundary
      fallback={(error, reset) => {
        // Log error for debugging
        console.error('ErrorBoundary caught an error:', error);
        props.onError?.(error);
        
        // Use custom fallback or default
        return props.fallback ? props.fallback(error, reset) : DefaultErrorFallback(error, reset);
      }}
    >
      {props.children}
    </SolidErrorBoundary>
  );
}

// Specific error boundary for mutation errors
export function MutationErrorBoundary(props: { 
  children: JSX.Element;
  onError?: (error: Error) => void;
}) {
  return (
    <ErrorBoundary
      onError={props.onError}
      fallback={(error, reset) => (
        <div class="p-4 border border-destructive/20 bg-destructive/5 rounded-md">
          <div class="flex items-center gap-2 mb-2">
            <Icon name="circle-x" class="h-4 w-4 text-destructive" />
            <span class="text-sm font-medium text-destructive">Operation failed</span>
          </div>
          <p class="text-xs text-muted-foreground mb-3">
            {error.message || 'An error occurred while saving your changes.'}
          </p>
          <Button onClick={reset} size="sm" variant="outline">
            <Icon name="refresh-cw" class="h-3 w-3 mr-2" />
            Retry
          </Button>
        </div>
      )}
    >
      {props.children}
    </ErrorBoundary>
  );
}
