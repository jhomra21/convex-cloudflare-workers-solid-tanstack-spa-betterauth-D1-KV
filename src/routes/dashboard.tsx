import {
  Outlet,
  createFileRoute,
  useLocation,
}
  from '@tanstack/solid-router'
import { Suspense, Show, createSignal, createMemo } from 'solid-js'
import { Transition } from 'solid-transition-group'
import { QueryClient } from '@tanstack/solid-query'
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '~/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { Separator } from "~/components/ui/separator"
import { AppSidebar } from '~/components/AppSidebar'
import { Breadcrumbs } from '~/components/Breadcrumbs'
import { CanvasControls } from '~/components/CanvasControls'
import { FeedbackButton } from '~/components/FeedbackButton'
import { protectedLoader } from '~/lib/auth-guard'
import { activeCanvasId, setActiveCanvasId, currentCanvas } from '~/lib/canvas-store'
import { useCurrentUserId } from '~/lib/auth-actions'

// Define router context type (can be shared or defined in a central types file too)
export interface RouterContext {
  queryClient: QueryClient
}

// Create root route with context
export const Route = createFileRoute('/dashboard')({
  beforeLoad: protectedLoader,
  component: DashboardPage,
});

function DashboardPage() {
  const [isScrolled, setIsScrolled] = createSignal(false);
  const location = useLocation();
  const userId = useCurrentUserId();

  // Check if we're on the canvas page
  const isCanvasPage = createMemo(() => location().pathname === '/dashboard/canvas');

  let scrollTimer: number;
  const handleScroll = (e: Event) => {
    // Throttle scroll events for better performance
    if (scrollTimer) return;
    scrollTimer = requestAnimationFrame(() => {
      const target = e.target as HTMLDivElement;
      setIsScrolled(target.scrollTop > 10);
      scrollTimer = 0;
    });
  };

  return (
    <div class="h-svh w-screen">
      <Show when={true}
      // fallback={
      //   <div class="h-screen w-screen flex items-center justify-center">
      //     <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      //     <p class="ml-4">Verifying authentication...</p>
      //   </div>
      // }
      >
        {/* <Transition
            onEnter={(el, done) => {
              const animation = el.animate(
                [
                  { opacity: 0 },
                  { opacity: 1 }
                ],
                { duration: 500, easing: 'ease-in' }
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
                { duration: 200, easing: 'ease-in-out' }
              );
              animation.finished.then(() => {
                done();
              });
            }}
          > */}
        <SidebarProvider>
          <div class="flex h-svh w-screen overflow-x-hidden bg-muted/40">
            <AppSidebar />
            <SidebarInset onScroll={handleScroll} class="flex-grow min-w-0 bg-background rounded-xl shadow-md transition-transform ease-out flex flex-col overflow-y-auto min-h-0">
              <header class={`flex h-16 shrink-0 items-center rounded-t-xl bg-background sticky top-0 z-20 transition-shadow ${isScrolled() ? 'shadow-md' : ''}`}>
                <div class="flex items-center gap-2 !pl-2 !pr-0 min-w-0 flex-1">
                  <Tooltip openDelay={500}>
                    <TooltipTrigger>
                      <SidebarTrigger class="-ml-[7px] flex-shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Toggle Sidebar</p>
                    </TooltipContent>
                  </Tooltip>
                  <Separator orientation="vertical" class="mr-2 h-4 flex-shrink-0" />
                  <div class="min-w-0 overflow-hidden">
                    <Breadcrumbs />
                  </div>
                </div>
                <div class="flex items-center gap-1 sm:gap-2 pr-2 flex-shrink-0">
                  <Show when={isCanvasPage()}>
                    <CanvasControls
                      activeCanvasId={activeCanvasId()}
                      onCanvasChange={setActiveCanvasId}
                      currentCanvas={currentCanvas()}
                      userId={userId()}
                    />
                  </Show>
                  <FeedbackButton />
                </div>
              </header>
              <div class="flex-grow px-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] relative min-h-0">
                <Suspense fallback={
                  <div class="w-full h-full flex items-center justify-center">
                    <p>Loading dashboard content...</p>
                  </div>
                }>
                  <Transition
                    mode="outin"
                    // appear={true}
                    onEnter={(el, done) => {
                      const animation = el.animate(
                        [
                          { opacity: 0 },
                          { opacity: 1 }
                        ],
                        { duration: 150, easing: 'ease-out' }
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
                        { duration: 150, easing: 'ease-out' }
                      );
                      animation.finished.then(() => {
                        done();
                      });
                    }} >
                    <Outlet />
                  </Transition>
                </Suspense>
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
        {/* </Transition> */}
      </Show>
    </div>
  );
}

