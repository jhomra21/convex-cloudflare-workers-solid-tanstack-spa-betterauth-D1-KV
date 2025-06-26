import { createFileRoute, useLoaderData } from '@tanstack/solid-router';
import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { Button } from '~/components/ui/button';
import { useRouter } from '@tanstack/solid-router';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '~/components/ui/card';
import Footer from '~/components/Footer';
import { publicLoader } from '~/lib/auth-guard';

const HomePage: Component = () => {
  const router = useRouter();
  const loaderData = useLoaderData({ from: '/' });

  return (
    <div class="p-8 min-h-screen flex flex-col bg-gradient-to-br from-stone-50 via-stone-100 to-stone-400/60 text-gray-900">
      <div class="max-w-2xl mx-auto w-full flex flex-col flex-grow">
        <h1 class="text-3xl font-bold mb-6">
          Cloudflare Vite Plugin Starter Template
        </h1>
        <div class="mb-16 flex items-center space-x-4">
          <Show
            when={loaderData()?.session}
            fallback={(
              <Button
                onClick={() => router.navigate({ to: "/auth" })}
                variant="sf-compute"
                class="justify-between w-full md:w-auto px-6 py-3"
              >
                <span>Login  //  Sign Up</span>
                <span class="ml-2 opacity-70">🔑</span>
              </Button>

            )}
          >
            <Button
              onClick={() => router.navigate({ to: "/dashboard" })}
              variant="sf-compute"
              class="justify-between w-full md:w-auto px-6 py-3"
            >
              <span>Go to Dashboard</span>
              <span class="ml-2 opacity-70">◯</span>
            </Button>
          </Show>
        </div>
      
        <Card>
          <CardHeader>
            <CardTitle>
              Quick Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            This project showcases the following technologies:
            <ul class="list-disc list-inside">
              <li>Cloudflare D1, Workers, KV</li>
              <li>SolidJS and Tanstack Router</li>
              <li>Better Auth</li>
              <li>Vite Plugin, Fullstack SPA in one Worker</li>
              <li>Shadcn components converted to SolidJS [<a href="https://www.solid-ui.com/" class="text-blue-500">solid-ui</a>, <a href="https://shadcn-solid.com/" class="text-blue-500">shadcn-solid</a>]</li>
            </ul>
          </CardContent>
          <CardFooter>
            <p class="text-sm text-muted-foreground">
              This is a starter template for the Cloudflare Vite Plugin
            </p>
          </CardFooter>
        </Card>
        
        <Footer />
      </div>
    </div>
  );
};

export const Route = createFileRoute('/')({
  component: HomePage,
  loader: publicLoader,
});
