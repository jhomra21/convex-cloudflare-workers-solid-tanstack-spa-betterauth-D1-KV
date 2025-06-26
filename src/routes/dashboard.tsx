import {
    Outlet,
    createFileRoute,
  } 
  from '@tanstack/solid-router'
  import { Suspense, Show, createSignal } from 'solid-js'
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
  import { protectedLoader } from '~/lib/auth-guard'
  
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
      <div class="h-screen w-screen">
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
              <div class="flex h-screen w-screen overflow-hidden bg-muted/40">
                <AppSidebar />
                <SidebarInset class="flex-grow min-w-0 bg-background rounded-xl shadow-md transition-all duration-150 ease-in-out flex flex-col">
                  <header class={`flex h-16 shrink-0 items-center gap-2 p-2 border-b border-gray-200 dark:border-gray-700 bg-background/95 backdrop-blur-sm sticky top-0 z-20 md:relative md:z-10 transition-shadow duration-150 will-change-scroll-position ${isScrolled() ? 'shadow-md' : ''}`}>
                    <div class="flex items-center gap-2 px-4">
                      <Tooltip openDelay={500}>
                        <TooltipTrigger>
                          <SidebarTrigger class="-ml-1" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Toggle Sidebar</p>
                        </TooltipContent>
                      </Tooltip>
                      <Separator orientation="vertical" class="mr-2 h-4" />
                      <Breadcrumbs />
                    </div>
                  </header>
                  {/* Opacity gradient overlay positioned right under header for fade effect */}
                  <div class={`absolute top-16 left-0 right-0 h-6 bg-gradient-to-b from-background/90 to-transparent pointer-events-none z-30 transform transition-transform duration-200 will-change-transform ${isScrolled() ? 'translate-y-0' : 'translate-y-[-100%]'}`}></div>
                  <div onScroll={handleScroll} class="flex-grow overflow-y-auto p-4 relative min-h-0">
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
                            { duration: 300, easing: 'ease-in-out' }
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
  
  