import { redirect } from '@tanstack/solid-router';
import { authClient } from './auth-client';
import type { QueryClient } from '@tanstack/solid-query';

// Centralized session query options that can be reused across the app.
export const sessionQueryOptions = () => ({
  queryKey: ['session'],
  queryFn: async () => {
    const { data, error } = await authClient.getSession();
    if (error) {
      // Log the error but return null to signify no session. This is handled by callers.
      console.error("Session fetch error:", error);
      return null;
    }
    return data;
  },
  staleTime: 1000 * 60 * 5, // 5 minutes, matches global config.
});

/**
 * Helper to fetch session data using the TanStack Query cache.
 * `ensureQueryData` will return cached data if available and not stale,
 * otherwise it will fetch it.
 */
const getSessionWithCache = (queryClient: QueryClient) => {
  return queryClient.ensureQueryData(sessionQueryOptions());
}

/**
 * A TanStack Router loader that protects a route from unauthenticated access.
 * It uses the QueryClient to fetch/cache the session, preventing excessive requests.
 * If the user is not logged in, it redirects them to the /auth page.
 * It also returns the session data to be used in the route's context.
 */
export const protectedLoader = async ({ context }: { context: { queryClient: QueryClient } }) => {
  const { queryClient } = context;
  const session = await getSessionWithCache(queryClient);

  if (!session) {
    throw redirect({
      to: '/auth',
      search: {
        // Pass the current path as a redirect parameter to return after login
        redirect: window.location.pathname,
      },
    });
  }
  return { session };
};

/**
 * A TanStack Router loader for public routes.
 * It fetches the session data without enforcing authentication, using the cache.
 * This is useful for UI that changes based on whether a user is logged in or not.
 */
export const publicLoader = async ({ context }: { context: { queryClient: QueryClient } }) => {
    const { queryClient } = context;
    const session = await getSessionWithCache(queryClient);
    return { session };
} 