// This file contains commented out email and password log in with better-auth.
// It is not used in the app due to worker free tier CPU limits and password hashing, but is kept here for reference.
import { createFileRoute, useSearch, useNavigate } from '@tanstack/solid-router';
import { Show, createSignal, createEffect } from 'solid-js';
import { useQuery, type QueryObserverResult } from '@tanstack/solid-query';
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
import { LoginMethodButton } from '~/components/auth/LoginMethodButton';
import { Icon } from '~/components/ui/icon';

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
  const sessionQuery = useQuery(sessionQueryOptions) as QueryObserverResult<SessionQueryResult, Error>;

  const search = useSearch({ from: '/auth' });
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = createSignal<AuthTab>('signIn');
  const [loadingAction, setLoadingAction] = createSignal<AuthAction>(null);




  // const signInMutation = useSignInMutation();
  // const signUpMutation = useSignUpMutation();
  const googleSignInMutation = useGoogleSignInMutation();
  const githubSignInMutation = useGithubSignInMutation();
  const twitterSignInMutation = useTwitterSignInMutation();

  createEffect(() => {
    if (sessionQuery.data) {
      // Don't navigate if we're currently in an OAuth callback flow
      if (window.location.pathname.includes('/auth/callback')) return;
      const redirectTo = (search as any)?.redirect as string | undefined;
      navigate({ to: redirectTo || '/dashboard', replace: true });
    }
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

                

              <div class="relative py-2">
                <div class="absolute inset-0 flex items-center"><span class="w-full border-t" /></div>
                <div class="relative flex justify-center text-xs uppercase">
                  <span class="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>*/}
              <LoginMethodButton
                method="google"
                label="Sign In with Google"
                class="mt-4"
                loading={loadingAction() === 'google'}
                disabled={loadingAction() !== null}
                icon={<Icon name="google" class="mr-2 h-4 w-4" />}
                onClick={() => {
                  setLoadingAction('google');
                  googleSignInMutation.mutate(undefined, {
                    onError: (err) => {
                      console.error(err);
                      setLoadingAction(null);
                    }
                  });
                }}
              />

              <LoginMethodButton
                method="github"
                label="Sign In with GitHub"
                class="mt-4"
                loading={loadingAction() === 'github'}
                disabled={loadingAction() !== null}
                icon={<Icon name="github" class="mr-2 h-4 w-4" />}
                onClick={() => {
                  setLoadingAction('github');
                  githubSignInMutation.mutate(undefined, {
                    onError: (err) => {
                      console.error(err);
                      setLoadingAction(null);
                    }
                  });
                }}
              />

              <LoginMethodButton
                method="twitter"
                label="Sign In with Twitter"
                class="mt-4"
                loading={loadingAction() === 'twitter'}
                disabled={loadingAction() !== null}
                icon={<Icon name="twitter" class="mr-2 h-4 w-4" />}
                onClick={() => {
                  setLoadingAction('twitter');
                  twitterSignInMutation.mutate(undefined, {
                    onError: (err) => {
                      console.error(err);
                      setLoadingAction(null);
                    }
                  });
                }}
              />
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