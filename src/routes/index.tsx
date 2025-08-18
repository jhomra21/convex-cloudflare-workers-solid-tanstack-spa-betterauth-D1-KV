import { createFileRoute, useLoaderData } from '@tanstack/solid-router';
import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { Button } from '~/components/ui/button';
import { useRouter } from '@tanstack/solid-router';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '~/components/ui/card';
import { Icon } from '~/components/ui/icon';
import Footer from '~/components/Footer';
import { publicLoader } from '~/lib/auth-guard';

const HomePage: Component = () => {
  const router = useRouter();
  const loaderData = useLoaderData({ from: '/' });

  return (
    <div class="p-4 min-h-screen flex flex-col bg-gradient-to-br from-stone-50 via-stone-100 to-stone-400/60 text-gray-900">
      <div class="max-w-5xl mx-auto w-full flex flex-col flex-grow">
        <section class="text-center pb-8">
          <h1 class="text-4xl md:text-6xl font-extrabold tracking-tight">
            Generative AI Canvas
          </h1>
          <p class="mt-4 text-lg text-muted-foreground">
            Create images, video, and audio — guided by an agentic chat. Build, remix, and share in one canvas.
          </p>
          <div class="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Show
              when={loaderData()?.session}
              fallback={(
                <>
                  <Button
                    onClick={() => router.navigate({ to: "/auth", search: { redirect: undefined, deleted: undefined } })}
                    variant="sf-compute"
                    class="justify-between w-full sm:w-auto px-6 py-3"
                  >
                    <span>Login  //  Sign Up</span>
                    <span class="ml-2 opacity-70">🔑</span>
                  </Button>
                  <Button
                    variant="outline"
                    class="w-full sm:w-auto px-6 py-3"
                    onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    Learn more
                  </Button>
                </>
              )}
            >
              <div class="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => router.navigate({ to: "/dashboard/canvas" })}
                  variant="sf-compute"
                  class="justify-between w-full sm:w-auto px-6 py-3"
                >
                  <span>Open Canvas</span>
                  <span class="ml-2 opacity-70">🎨</span>
                </Button>
                <Button
                  onClick={() => router.navigate({ to: "/dashboard" })}
                  variant="secondary"
                  class="w-full sm:w-auto px-6 py-3"
                >
                  <span>Go to Dashboard</span>
                </Button>
              </div>
            </Show>
          </div>
        </section>

        <section id="features" class="grid gap-6 sm:grid-cols-2">
          <Card>
            <CardHeader class="flex flex-row items-center gap-3">
              <Icon name="image" class="size-6 text-primary" />
              <CardTitle>Images</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Generate, paint, and remix photos and artwork with prompt-driven tools.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader class="flex flex-row items-center gap-3">
              <Icon name="video" class="size-6 text-primary" />
              <CardTitle>Video</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Bring ideas to motion. Create short clips and loops from text prompts.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader class="flex flex-row items-center gap-3">
              <Icon name="music" class="size-6 text-primary" />
              <CardTitle>Audio</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Compose soundscapes, music, and voice with generative audio models.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader class="flex flex-row items-center gap-3">
              <Icon name="bot" class="size-6 text-primary" />
              <CardTitle>Canvas Agent</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Use natural language to create other agents, generate or edit media.</p>
            </CardContent>
          </Card>
        </section>

        <div class="mt-6" />

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
