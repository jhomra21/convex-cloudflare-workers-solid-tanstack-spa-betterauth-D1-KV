import { Link, useLocation } from '@tanstack/solid-router';
import { For, createMemo, children } from 'solid-js';
import { Icon, type IconName } from './ui/icon';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from './ui/sidebar';
import { type FileRoutesByFullPath } from '../routeTree.gen';
import { NavUser } from './nav-user';

const routeMetadata: Partial<Record<keyof FileRoutesByFullPath, { name: string; iconName: IconName; isSidebarItem?: boolean }>> = {
  '/dashboard': { name: 'Home', iconName: 'house', isSidebarItem: true },
  '/dashboard/account': { name: 'Account', iconName: 'user', isSidebarItem: true },
  '/dashboard/notes': { name: 'Notes', iconName: 'file', isSidebarItem: true },
  '/dashboard/tasks': { name: 'Tasks', iconName: 'square-check', isSidebarItem: true },
  // Add more route metadata here as your application grows
  // Only items with isSidebarItem: true will be shown
};

export function AppSidebar() {
  const { setOpenMobile, isMobile, state } = useSidebar();
  const location = useLocation();
  
  const currentPath = createMemo(() => location().pathname);

  const generatedNavRoutes = createMemo(() => {
    return Object.entries(routeMetadata)
      .filter(([, metadata]) => metadata.isSidebarItem)
      .map(([path, metadata]) => ({
        path: path as string, // Cast because keys are from FileRoutesByFullPath
        name: metadata.name,
        iconName: metadata.iconName,
      }))
      .sort((a, b) => {
        // Ensure 'Home' (/dashboard) comes first if desired
        if (a.path === '/dashboard') return -1;
        if (b.path === '/dashboard') return 1;
        return a.name.localeCompare(b.name); // Otherwise, sort alphabetically by name
      });
  });

  const handleLinkClick = () => {
    if (isMobile()) {
      setOpenMobile(false);
    }
  };

  const renderNavItem = (route: { path: string; name: string; iconName: IconName }) => {
    const isActive = createMemo(() => currentPath() === route.path);
    
    const linkContent = createMemo(() => (
      <div class="flex items-center gap-2 relative w-full">
        <Icon 
          name={route.iconName} 
          class="h-5 w-5 absolute transition-[left] duration-[var(--sidebar-animation-duration)] ease-in-out" 
          classList={{
            "left-0": state() === "expanded",
            "-left-0.5": state() === "collapsed"
          }} 
        />
        <span 
          class="pl-7 transition-[opacity] duration-[var(--sidebar-animation-duration)] ease-in-out" 
          classList={{ 
            "opacity-0 pointer-events-none absolute": state() === "collapsed",
            "opacity-100": state() === "expanded"
          }}
        >
          {route.name}
        </span>
      </div>
    ));

    const linkChildren = children(() => linkContent());

    // Use a less aggressive preload approach
    // Options: 'intent' | 'viewport' | 'render' | false
    // Using false for pages with expensive loaders
    const shouldPreload = route.path === '/dashboard/database' ? false : 'intent';

    return (
      <SidebarMenuItem>
        <SidebarMenuButton 
          as={Link} 
          to={route.path} 
          preload={shouldPreload}
          class="w-full text-left"
          onClick={handleLinkClick}
          tooltip={route.name}
          isActive={isActive()}
        >
          {linkChildren()} 
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <For each={generatedNavRoutes()}>
                {renderNavItem}
              </For>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter class="md:!pb-0 lg:!pb-0 sm:!pb-2 !px-2 !pt-2">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
} 