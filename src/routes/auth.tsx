// This file contains commented out email and password log in with better-auth.
// It is not used in the app due to worker free tier CPU limits and password hashing, but is kept here for reference.
import { createFileRoute, useSearch, useNavigate } from '@tanstack/solid-router';
import { Show, createSignal, createEffect, onCleanup } from 'solid-js';
import { useQuery, type QueryObserverResult } from '@tanstack/solid-query';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader } from '~/components/ui/card';
// import { Input } from '~/components/ui/input';
// import { Label } from '~/components/ui/label';
import { sessionQueryOptions } from '~/lib/auth-guard';
import {
  // useSignInMutation, 
  // useSignUpMutation, 
  useGoogleSignInMutation,
  useGithubSignInMutation,
  useTwitterSignInMutation
} from '~/lib/auth-actions';

import type { User, Session } from 'better-auth';

type SessionQueryResult = {
  user: User,
  session: Session
} | null;

export const Spinner = (props: { class?: string }) => (
  <div
    class={`h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-t-transparent ${props.class ?? ''}`}
  />
);

type AuthAction = 'signIn' | 'signUp' | 'google' | 'github' | 'twitter' | null;
type AuthTab = 'signIn' | 'signUp';

function AuthPage() {
  const sessionQuery = useQuery(() => sessionQueryOptions()) as QueryObserverResult<SessionQueryResult, Error>;

  const search = useSearch({ from: '/auth' });
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = createSignal<AuthTab>('signIn');
  const [name, setName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [apiError, setApiError] = createSignal<string | null>(null);
  const [loadingAction, setLoadingAction] = createSignal<AuthAction>(null);

  const [containerHeight, setContainerHeight] = createSignal<string | number>('auto');
  let signInFormRef: HTMLDivElement | undefined;
  let signUpFormRef: HTMLDivElement | undefined;




  const handleError = (error: Error) => {
    setApiError(error.message);
  };

  // const signInMutation = useSignInMutation();
  // const signUpMutation = useSignUpMutation();
  const googleSignInMutation = useGoogleSignInMutation();
  const githubSignInMutation = useGithubSignInMutation();
  const twitterSignInMutation = useTwitterSignInMutation();
  createEffect(() => {
    // Clear API error when switching tabs or changing form inputs
    activeTab();
    email();
    password();
    name();
    setApiError(null);
  });

  createEffect(() => {
    if (sessionQuery.isPending || sessionQuery.data) {
      setContainerHeight('auto');

      // Don't navigate if we're currently in an OAuth callback flow
      if (window.location.pathname.includes('/auth/callback')) {
        // console.log('Skipping navigation - in OAuth callback flow');
        return;
      }

      navigate({ to: '/dashboard', replace: true });
      return;
    }

    const targetRef = activeTab() === 'signIn' ? signInFormRef : signUpFormRef;
    if (!targetRef) return;

    const observer = new ResizeObserver(() => {
      const newHeight = targetRef.scrollHeight;
      if (newHeight > 0) {
        setContainerHeight(`${newHeight}px`);
      }
    });

    observer.observe(targetRef);

    onCleanup(() => {
      observer.disconnect();
    });
  });

  return (
    <div class="p-8 min-h-svh flex flex-col items-center justify-center bg-gradient-to-br from-stone-50 via-stone-100 to-stone-400/60 text-gray-900">
      <Show when={(search as any)?.deleted === 'true'}>
        <Card class="w-full max-w-sm mb-4 bg-green-50 border-green-200">
          <CardContent class="p-4 text-center">
            <p class="text-green-800 font-medium">Account successfully deleted</p>
            <p class="text-green-600 text-sm mt-1">Thank you for using our service</p>
          </CardContent>
        </Card>
      </Show>
      <Card class="w-full max-w-sm overflow-hidden transition-all duration-300 ease-in-out">
        <CardHeader class="p-0">
          <div class="flex">
            <button

              onClick={() => setActiveTab('signIn')}
              class={`flex-1 p-4 text-center font-semibold cursor-pointer border-b-2 transition-all duration-300 ${activeTab() === 'signIn' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground opacity-60 hover:bg-muted/50'}`}
            >
              Sign In
            </button>
            <div class="w-px bg-border"></div>
            <button

              onClick={() => setActiveTab('signUp')}
              class={`flex-1 p-4 text-center font-semibold cursor-pointer border-b-2 transition-all duration-300 ${activeTab() === 'signUp' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground opacity-60 hover:bg-muted/50'}`}
            >
              Sign Up
            </button>
          </div>
        </CardHeader>
        <CardContent class=" overflow-hidden">
          <Show when={sessionQuery.isPending}>
            <div class="flex justify-center py-4">
              <Spinner />
            </div>
          </Show>
          <Show when={!sessionQuery.isPending && !sessionQuery.data}>
            <div class="space-y-4">
              {/* Sign In Form 
                <div 
                    class="relative transition-[height] duration-300 ease-in-out"
                    style={{ height: containerHeight().toString() }}
                >
                  
                    <div 
                        ref={signInFormRef}
                        class={`w-full absolute top-0 left-0 transition-all duration-300 ease-in-out transform ${activeTab() === 'signIn' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full pointer-events-none'}`}
                    >
                        <form onSubmit={(e) => { 
                            e.preventDefault(); 
                            setLoadingAction('signIn');
                            signInMutation.mutate({ email: email(), password: password() }, { 
                                onError: handleError,
                                onSettled: () => setLoadingAction(null)
                            }); 
                        }} class="space-y-4 pt-4">
                            <div class="space-y-2">
                                <Label for="email-signin">Email</Label>
                                <Input id="email-signin" type="email" placeholder="your@email.com" value={email()} onChange={setEmail} disabled={loadingAction() !== null} />
                            </div>
                            <div class="space-y-2">
                                <Label for="password-signin">Password</Label>
                                <Input id="password-signin" type="password" placeholder="••••••••" value={password()} onChange={setPassword} disabled={loadingAction() !== null} />
                            </div>
                            <Button variant="sf-compute" type="submit" class="w-full" disabled={loadingAction() !== null}>
                                <Show when={loadingAction() === 'signIn'}><Spinner class="mr-2" /></Show>
                                Sign In
                            </Button>
                        </form>
                    </div>
                    */}
              {/* Sign Up Form 
                    <div 
                        ref={signUpFormRef}
                        class={`w-full absolute top-0 left-0 transition-all duration-300 ease-in-out transform ${activeTab() === 'signUp' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none'}`}
                    >
                        <form onSubmit={(e) => { 
                            e.preventDefault(); 
                            setLoadingAction('signUp');
                            signUpMutation.mutate({ email: email(), password: password(), name: name() }, { 
                                onError: handleError,
                                onSettled: () => setLoadingAction(null)
                            }); 
                        }} class="space-y-4 pt-4">
                            <div class="space-y-2">
                                <Label for="name-signup">Name (Optional)</Label>
                                <Input id="name-signup" type="text" placeholder="Your Name" value={name()} onChange={setName} disabled={loadingAction() !== null} />
                            </div>
                            <div class="space-y-2">
                                <Label for="email-signup">Email</Label>
                                <Input id="email-signup" type="email" placeholder="your@email.com" value={email()} onChange={setEmail} disabled={loadingAction() !== null} />
                            </div>
                            <div class="space-y-2">
                                <Label for="password-signup">Password</Label>
                                <Input id="password-signup" type="password" placeholder="••••••••" value={password()} onChange={setPassword} disabled={loadingAction() !== null} />
                            </div>
                            <Button variant="sf-compute" type="submit" class="w-full" disabled={loadingAction() !== null}>
                                <Show when={loadingAction() === 'signUp'}><Spinner class="mr-2" /></Show>
                                Create Account
                            </Button>
                        </form>
                    </div>
                </div>

                <Show when={apiError()}>
                    <p class="text-sm text-red-600 bg-red-100 p-3 rounded-md border border-red-200">{apiError()}</p>
                </Show>

              <div class="relative py-2">
                <div class="absolute inset-0 flex items-center"><span class="w-full border-t" /></div>
                <div class="relative flex justify-center text-xs uppercase">
                  <span class="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>*/}

              <Button variant="outline" class="w-full mt-4" onClick={() => {
                setLoadingAction('google');

                googleSignInMutation.mutate(undefined, {
                  onError: (err) => {
                    handleError(err);
                    setLoadingAction(null);
                  }
                });
              }} disabled={loadingAction() !== null}>
                <Show when={loadingAction() === 'google'}><Spinner class="mr-2" /></Show>
                <Show when={!googleSignInMutation.isPending}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" class="mr-2 h-4 w-4">
                    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.223,0-9.641-3.219-11.303-7.583l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.022,36.407,44,30.638,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                  </svg>
                </Show>
                Sign In with Google
              </Button>
              <Button variant="outline" class="w-full mt-4" onClick={() => {
                setLoadingAction('github');
                githubSignInMutation.mutate(undefined, {
                  onError: (err) => {
                    handleError(err);
                    setLoadingAction(null);
                  }
                });
              }} disabled={loadingAction() !== null}>
                <Show when={loadingAction() === 'github'}><Spinner class="mr-2" /></Show>
                <Show when={!githubSignInMutation.isPending}>
                  <svg class="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/>
                  </svg>
                </Show>

                Sign In with GitHub
              </Button>
              <Button variant="outline" class="w-full mt-4" onClick={() => {
                setLoadingAction('twitter');
                twitterSignInMutation.mutate(undefined, {
                  onError: (err) => {
                    handleError(err);
                    setLoadingAction(null);
                  }
                });
              }} disabled={loadingAction() !== null}>
                <Show when={loadingAction() === 'twitter'}><Spinner class="mr-2" /></Show>
                <Show when={!twitterSignInMutation.isPending}>
                  <svg class="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.46 6c-.77.35-1.6.58-2.46.67.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98-3.54-.18-6.69-1.86-8.79-4.46-.37.63-.58 1.37-.58 2.15 0 1.49.76 2.81 1.91 3.58-.7-.02-1.37-.21-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.35 0-.69-.02-1.03-.06C3.44 20.29 5.7 21 8.12 21c7.34 0 11.35-6.08 11.35-11.35 0-.17 0-.34-.01-.51.78-.57 1.45-1.28 1.99-2.08z"/>
                  </svg>
                </Show>
                Sign In with Twitter
              </Button>
            </div>
          </Show>
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute('/auth')({
  component: AuthPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      redirect: (search.redirect as string) || undefined,
      deleted: (search.deleted as string) || undefined,
    };
  },
});