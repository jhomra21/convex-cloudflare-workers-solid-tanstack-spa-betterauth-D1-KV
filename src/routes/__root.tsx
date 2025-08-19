import {
  Link,
  Outlet,
  createRootRouteWithContext,
} from '@tanstack/solid-router'
import { Transition } from 'solid-transition-group'
import { QueryClient } from '@tanstack/solid-query'
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools'
import { Toaster } from '~/components/ui/sonner'

// Define router context type (can be shared or defined in a central types file too)
export interface RouterContext {
  queryClient: QueryClient
}

// Custom error component
function CustomErrorComponent({ error }: { error: Error }) {
  return (
    <div class="flex flex-col items-center justify-center min-h-svh p-4 bg-background">
      <div class="w-full max-w-md p-6 bg-card rounded-lg shadow-lg">
        <h1 class="text-2xl font-bold text-destructive mb-4">Something went wrong</h1>
        <div class="bg-destructive/10 text-destructive p-4 rounded-md mb-4">
          <p class="font-mono text-sm">{error.message}</p>
        </div>
        <Link 
          to="/"
          class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
}

// Create root route with context
export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  errorComponent: CustomErrorComponent,
});

function RootComponent() {

  return (
    <div class="min-h-svh w-screen">
      <Transition
        appear={true}
        mode="outin"
        onEnter={(el, done) => {
          const animation = el.animate(
            [
              { opacity: 0 },
              { opacity: 1 }
            ],
            { duration: 300, easing: 'ease-in' }
          );
          animation.finished.then(() => {
            done();
          });
        }}
        onExit={(el, done) => {
          const animation = el.animate(
            [
              { opacity: 1 },
              { opacity: 0 }
            ],
            { duration: 300, easing: 'ease-out' }
          );
          animation.finished.then(() => {
            done();
          });
        }}
      >
      {/* <Suspense></Suspense> */}

          {/* Simplified transition for root route - less animations to debug */}
          <Outlet />

      </Transition>
      <Toaster />
      <TanStackRouterDevtools position="bottom-right" />
    </div>
  )
}
