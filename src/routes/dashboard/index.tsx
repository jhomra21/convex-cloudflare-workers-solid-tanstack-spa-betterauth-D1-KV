import { createFileRoute, Link, useRouteContext } from '@tanstack/solid-router';
import { For, createMemo, children, Show } from 'solid-js';
import { useMutation } from '@tanstack/solid-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { useSignOutMutation } from '~/lib/auth-actions';
import { Spinner } from '../auth';


export function DashboardIndex() {
  const context = useRouteContext({ from: '/dashboard' });
  const user = createMemo(() => context()?.session?.user);
  const signOutMutation = useSignOutMutation();

  const testApiMutation = useMutation(() => ({
    mutationFn: async () => {
      const response = await fetch('/api/');
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.statusText}`);
      }
      return response.json();
    },
  }));

  const dashboardItems = [
    {
      title: 'Account',
      description: 'Manage your account',
      icon: '🗄️',
      path: '/dashboard/account',
      color: 'border-green-200 dark:border-green-800'
    },
    {
      title: 'Notes',
      description: 'Create and manage your notes from D1 database',
      icon: '📝',
      path: '/dashboard/notes',
      color: 'border-purple-200 dark:border-purple-800'
    },
    {
      title: 'Tasks',
      description: 'Create and manage your tasks from Convex database',
      icon: '🔄',
      path: '/dashboard/tasks',
      color: 'border-blue-200 dark:border-blue-800'
    }
    // to add more items here, follow the format below
    //,
    //{
    //  title: 'item',
    //  description: 'item',
    //  icon: '✅',
    //  path: '/dashboard/item',
    //  color: 'border-purple-200 dark:border-purple-800'
    //}
  ];

  const renderCard = (item: typeof dashboardItems[0]) => {
    // Pre-compute the button content using createMemo
    const buttonContent = createMemo(() => (
      <>Open {item.title}</>
    ));

    // Use children helper to create a stable child function
    const buttonChildren = children(() => buttonContent());

    return (
      <Card class={`overflow-hidden transition-all hover:shadow-sm border-l-2 ${item.color} bg-card`}>
        <div class="p-5">
          <div class="flex justify-between items-center mb-3">
            <CardTitle class="text-lg font-medium">{item.title}</CardTitle>
            <span class="text-2xl">{item.icon}</span>
          </div>
          <CardDescription class="text-sm text-muted-foreground mb-4">
            {item.description}
          </CardDescription>
          <div class="flex justify-start">
            <Button 
              variant="sf-compute"
              size="sm"
              as={Link}
              to={item.path}
              preload="intent"
              class="font-normal"
            >
              {buttonChildren()}
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div class="container py-8 px-4 mx-auto max-w-5xl flex flex-col min-h-screen">
      <div class="flex-grow">
        <div class="mb-10">
          <h1 class="text-2xl font-semibold mb-2">Welcome, {user()?.name || 'User'}</h1>
          <p class="text-muted-foreground text-sm">
            Welcome to the dashboard. You can edit this page at <span class="font-mono text-base bg-muted px-1 rounded-md">/routes/dashboard/index.tsx</span>
          </p>
        </div>

        <div class="mb-10">
          <Button 
            variant="sf-compute" 
            onClick={() => testApiMutation.mutate()}
            disabled={testApiMutation.isPending}
          >
            <Show when={testApiMutation.isPending} fallback={'Test API'}>
              <Spinner class="mr-2" />
              Loading...
            </Show>
          </Button>
          
          <div 
            class="mt-4 transition-all duration-300 ease-in-out overflow-hidden relative" 
            style={{ 
              opacity: testApiMutation.isSuccess || testApiMutation.isError ? '1' : '0',
              "max-height": testApiMutation.isSuccess || testApiMutation.isError ? '300px' : '0',
              "margin-top": testApiMutation.isSuccess || testApiMutation.isError ? '16px' : '0'
            }}
          >
            <div class="bg-muted p-4 rounded-md text-sm relative">
              <button 
                onClick={() => testApiMutation.reset()} 
                class="absolute top-2 right-2 h-6 w-6 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6L6 18"></path>
                  <path d="M6 6L18 18"></path>
                </svg>
              </button>
              <pre class="overflow-auto max-h-60">
                <Show when={testApiMutation.isSuccess}>
                  {JSON.stringify(testApiMutation.data, null, 2)}
                </Show>
                <Show when={testApiMutation.isError}>
                  {testApiMutation.error?.message}
                </Show>
              </pre>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <For each={dashboardItems}>
            {renderCard}
          </For>
        </div>

        <Card class="mt-12 bg-card/50">
          <CardHeader>
            <CardTitle class="text-base font-medium">About This Demo</CardTitle>
            <CardDescription>
              This application demonstrates integration of several technologies:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul class="space-y-2 text-sm text-muted-foreground">
              <li class="flex items-center gap-2">
                <div class="h-1 w-1 rounded-full bg-muted-foreground"></div>
                SolidJS and Tanstack Router for reactive UI
              </li>
              <li class="flex items-center gap-2">
                <div class="h-1 w-1 rounded-full bg-muted-foreground"></div>
                Better-auth with Cloudflare D1 and KV for authentication
              </li>
              <li class="flex items-center gap-2">
                <div class="h-1 w-1 rounded-full bg-muted-foreground"></div>
                Single Worker for Server and Client using Cloudflare Vite Plugin
              </li>  
              <li class="flex items-center gap-2">
                <div class="h-1 w-1 rounded-full bg-muted-foreground"></div>
                Shadcn components converted to SolidJS [<a href="https://www.solid-ui.com/" class="text-blue-500">solid-ui</a>, <a href="https://shadcn-solid.com/" class="text-blue-500">shadcn-solid</a>]
              </li>
              <li class="flex items-center gap-2">
                <div class="h-1 w-1 rounded-full bg-muted-foreground"></div>
                Notes CRUD with D1
              </li>  
            </ul>
          </CardContent>
          <CardFooter>
            <Button variant="sf-compute" onClick={() => signOutMutation.mutate()} disabled={signOutMutation.isPending}>
              <Show when={signOutMutation.isPending}><Spinner class="mr-2" /></Show>
              <Show when={!signOutMutation.isPending}>
                Logout
              </Show>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/dashboard/')({
  component: DashboardIndex,
}); 