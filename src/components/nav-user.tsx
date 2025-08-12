import { SidebarMenuItem } from "./ui/sidebar"
import { useSidebar } from "./ui/sidebar"
import { SidebarMenu } from "./ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Icon } from "./ui/icon"
import { SidebarMenuButton } from "./ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuPortal } from "./ui/dropdown-menu"
import type { Component } from "solid-js"
import { Show, createMemo, createSignal } from "solid-js"
import { Link, useNavigate } from "@tanstack/solid-router"
import { useQuery } from "@tanstack/solid-query"
import { sessionQueryOptions } from "~/lib/auth-guard"
import { useSignOutMutation } from "~/lib/auth-actions"

export const NavUser: Component = () => {
  const { isMobile, state, setOpenMobile } = useSidebar()
  const navigate = useNavigate()
  const signOutMutation = useSignOutMutation();
  const [dropdownOpen, setDropdownOpen] = createSignal(false);
  let buttonRef: HTMLButtonElement | undefined;
  
  // // Get user data from auth context
  // const user = createMemo(() => context()?.session?.user);

  // Use the centralized, cached session query.
  // This removes the staleTime: 0 override, respecting the global config.
  const sessionQuery = useQuery(sessionQueryOptions);

  const user = createMemo(() => sessionQuery.data?.user);

  const getInitials = (name: string) => {
    if (!name || name === "Guest") return name.charAt(0).toUpperCase() || "G";
    return name
      .split(' ')
      .map(part => part[0]?.toUpperCase() || '')
      .join('')
      .slice(0, 2) || 'U'
  }

  const isSidebarCollapsed = createMemo(() => state() === "collapsed");
  
  const handleSignOut = async () => {
    await signOutMutation.mutate();
    if (isMobile()) {
      setOpenMobile(false);
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem
        class="w-full"
        classList={{
          "flex justify-center items-center": isSidebarCollapsed() && !isMobile(),
        }}
      >
        <Show 
          when={user()} 
          fallback={
            <SidebarMenuButton
              as={Link}
              to="/sign-in"
              onClick={() => isMobile() && setOpenMobile(false)}
              class="w-full flex items-center justify-start gap-2 transition-[padding,width] duration-200 ease-in-out"
            >
              <Icon name="login" class="size-5" />
              <Show when={!isSidebarCollapsed() || isMobile()}>
                <span class="transition-opacity duration-200 ease-in-out"
                  classList={{
                    "opacity-0 pointer-events-none": isSidebarCollapsed() && !isMobile(),
                    "opacity-100": !isSidebarCollapsed() || isMobile(),
                  }}
                >
                  Sign In
                </span>
              </Show>
            </SidebarMenuButton>
          }
        >
          <SidebarMenuButton
            ref={buttonRef}
            as="button"
            size="lg"
            class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground !cursor-pointer 
                   transition-[transform,shadow] ease-out flex items-center transform translate-z-0
                   bg-gradient-to-b from-white via-foreground/5 to-foreground/0.5 border !border-t-foreground/3 !border-b-foreground/10 border-x-foreground/10
                   hover:shadow-md hover:shadow-foreground/10
                   active:scale-97 !rounded-xl w-full
                  "
            classList={{
              "p-1 rounded-md w-auto": isSidebarCollapsed() && !isMobile(),
              "w-full justify-start": !isSidebarCollapsed() || isMobile(),
            }}
            onClick={(e: MouseEvent) => {
              // This will only fire on click (mouseup), not mousedown
              e.stopPropagation();
              setDropdownOpen(!dropdownOpen());
            }}
          >
            <Avatar class="h-8 w-8 rounded-lg shrink-0 shadow-sm border border-foreground/5">
                <Show when={user()?.image}>
                  <AvatarImage src={user()?.image || ''} alt={user()?.name || ''} />
              </Show>
                <AvatarFallback class="rounded-lg">{getInitials(user()?.name || "")}</AvatarFallback>
            </Avatar>
            <Show when={!isSidebarCollapsed() || isMobile()}>
              <div class="grid flex-1 text-left text-sm leading-tight ml-2 min-w-0 transition-opacity duration-200 ease-in-out"
                classList={{
                  "opacity-0 pointer-events-none": isSidebarCollapsed() && !isMobile(),
                  "opacity-100": !isSidebarCollapsed() || isMobile(),
                }}
              >
                  <span class="truncate font-semibold">{user()?.name}</span>
                  <span class="truncate text-xs text-foreground/60">{user()?.email}</span>
              </div>
              <Icon name="chevronupdown" class="ml-auto size-4 shrink-0 transition-opacity duration-200 ease-in-out" 
                classList={{
                  "opacity-0 pointer-events-none": isSidebarCollapsed() && !isMobile(),
                  "opacity-100": !isSidebarCollapsed() || isMobile(),
                }}
              />
            </Show>
          </SidebarMenuButton>
          <DropdownMenu 
            placement={isMobile() ? "top" : "right-start"}
            open={dropdownOpen()}
            onOpenChange={setDropdownOpen}
            getAnchorRect={() => buttonRef?.getBoundingClientRect()}
          >
            <DropdownMenuPortal>
              <DropdownMenuContent
              class={`min-w-56 rounded-lg ${isSidebarCollapsed() && !isMobile() ? "w-56" : "w-[var(--kb-menu-content-available-width)]"}`}
            >
              <DropdownMenuLabel class="p-0 font-normal">
                <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar class="h-8 w-8 rounded-lg">
                      <Show when={user()?.image}>
                        <AvatarImage src={user()?.image || ''} alt={user()?.name || ''} />
                    </Show>
                      <AvatarFallback class="rounded-lg">{getInitials(user()?.name || "")}</AvatarFallback>
                  </Avatar>
                  <div class="grid flex-1 text-left text-sm leading-tight">
                      <span class="truncate font-semibold">{user()?.name}</span>
                      <span class="truncate text-xs">{user()?.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
                <DropdownMenuGroup>
                  <DropdownMenuItem class="!cursor-pointer" onClick={() => navigate({ to: "/" })}>
                    <Icon name="house" class="mr-2 size-4" />
                    Go to Home Page
                  </DropdownMenuItem>
                  <DropdownMenuItem class="!cursor-pointer" onClick={() => navigate({ to: "/dashboard/account" })}>
                    <Icon name="user" class="mr-2 size-4" />
                    Profile
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem class="!cursor-pointer" onClick={handleSignOut}>
                  <Icon name="logout" class="mr-2 size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenu>
        </Show>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}