import {
  RouterProvider,
  createRouter,
  // createRootRouteWithContext, // Keep for context, but component is in __root.tsx
  // useLocation, // No longer used directly here
} from '@tanstack/solid-router'
import { render } from 'solid-js/web'
// Suspense, Show, Transition are now in __root.tsx
// import { Show, Suspense } from 'solid-js'
// import { Transition } from 'solid-transition-group'
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query'

// Import auth initialization

// Import the generated route tree - this should now work after Vite restart
import { routeTree } from './routeTree.gen' 

import './styles.css'
import NotFound from './components/NotFound';

// Initialize auth (check for token in URL, etc.)

// Remove duplicate session prefetch since authClient.ts already handles this
// authClient.ts has its own initialization logic that runs when imported
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10,   // 10 minutes
    },
  },
});

// Make queryClient globally accessible for session caching
window.__QUERY_CLIENT = queryClient;

// Create router with the generated routeTree and provide context
const router = createRouter({
  routeTree,
  defaultPreload: 'viewport',
  defaultNotFoundComponent: NotFound,
  scrollRestoration: true,
  scrollRestorationBehavior: 'smooth',
  // The context needs to be provided to the router instance.
  // The type for this context should match what `__root.tsx` expects.
  context: {
    queryClient, // Provide queryClient to all routes via context
  }
  // If RouterContext interface from __root.tsx is imported, can type context:
  // context: { queryClient } satisfies RouterContext,
})

// Register the router instance for type safety
declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router
  }
}
// Add type declaration for global queryClient
declare global {
  interface Window {
    __QUERY_CLIENT: typeof queryClient;
  }
}
function MainApp() {
  return (
    <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

const rootElement = document.getElementById('app')
if (rootElement) {
  render(() => <MainApp />, rootElement)
}
