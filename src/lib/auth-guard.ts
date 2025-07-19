import { redirect } from '@tanstack/solid-router';
import { authClient } from './auth-client';
import type { QueryClient } from '@tanstack/solid-query';
import { storeShareIntent } from './share-intent';
import type { User, Session } from 'better-auth';

// Type for the session data returned by authClient.getSession()
export type SessionData = {
  user: User;
  session: Session;
} | null;

// Centralized session query options that can be reused across the app.
export const sessionQueryOptions = () => ({
  queryKey: ['session'],
  queryFn: async (): Promise<SessionData> => {
    const { data, error } = await authClient.getSession();
    if (error) {
      // Log the error but return null to signify no session. This is handled by callers.
      console.error("Session fetch error:", error);
      return null;
    }
    return data;
  },
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 30,
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
    const redirectUrl = window.location.pathname + window.location.search;

    // Check if this is a share link and store the intent before redirecting
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('share');
    if (shareId) {
      storeShareIntent(shareId);
    }

    throw redirect({
      to: '/auth',
      search: {
        redirect: redirectUrl,
        deleted: undefined,
      } as { redirect: string | undefined; deleted: string | undefined },
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