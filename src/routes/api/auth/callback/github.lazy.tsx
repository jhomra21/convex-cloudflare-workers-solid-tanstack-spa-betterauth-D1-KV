import { createLazyFileRoute, useNavigate } from '@tanstack/solid-router'
import { createEffect } from 'solid-js'
import { hasShareIntent } from '~/lib/share-intent'

export const Route = createLazyFileRoute('/api/auth/callback/github')({
  component: GitHubCallbackComponent,
})

function GitHubCallbackComponent() {
  const navigate = useNavigate()

  createEffect(() => {
    (async () => {
      try {
        // This component is rendered by the client-side router.
        // It immediately makes a fetch request to the same URL it's on.
        // This fetch IS handled by the worker, which processes the code,
        // sets the session cookie, and returns a success response.
        const response = await fetch(window.location.href, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });

        if (response.ok) {
          if (hasShareIntent()) {
            navigate({ to: '/dashboard/images', replace: true });
          } else {
            navigate({ to: '/dashboard', replace: true });
          }
        } else {
          const error = await response.json();
          console.error('Authentication failed:', error);
          // On failure, redirect to the home page for now.
          window.location.href = '/';
        }
      } catch (e) {
        console.error('An error occurred during authentication:', e);
        // On failure, redirect to the home page for now.
        window.location.href = '/';
      }
    })();
  });

  return (
    <main class="flex min-h-screen flex-col items-center justify-center bg-background p-4 font-sans">
      <div class="flex flex-col items-center justify-center space-y-4">
        <div class="h-10 w-10 animate-spin rounded-full border-4 border-solid border-blue-400 border-t-transparent" />
        <div class="text-center">
          <h1 class="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
            Completing sign-in
          </h1>
          <p class="mt-2 text-base text-muted-foreground">
            You will be redirected shortly.
          </p>
        </div>
      </div>
    </main>
  );
}
