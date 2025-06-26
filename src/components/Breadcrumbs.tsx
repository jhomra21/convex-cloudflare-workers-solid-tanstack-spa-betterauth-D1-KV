import { useLocation } from '@tanstack/solid-router'
import { createMemo, For } from 'solid-js'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { Link } from '@tanstack/solid-router'
// Icon import kept for when we reintroduce it, but not used in this step
// import { Icon } from '~/components/ui/icon'

export function Breadcrumbs() {
  const location = useLocation()

  const breadcrumbItems = createMemo(() => {
    const currentPath = location().pathname
    
    // Special case for home page
    if (currentPath === '/') {
      return [{
        label: 'Home',
        path: '/',
        isActive: true,
        isLast: true
      }];
    }

    const segments = currentPath.split('/').filter(s => s.length > 0);
    
    // For shadcn style, we'll keep at most 2 breadcrumb items
    // The parent path (if it exists) and the current page
    if (segments.length === 0) return [];
    
    let result = [];
    
    // If we have a parent path, add it as the first item
    if (segments.length > 1) {
      const parentSegment = segments[segments.length - 2];
      let parentPath = '/' + segments.slice(0, segments.length - 1).join('/');
      result.push({
        label: parentSegment.charAt(0).toUpperCase() + parentSegment.slice(1),
        path: parentPath,
        isActive: false,
        isLast: false
      });
    }
    
    // Add the current page
    const currentSegment = segments[segments.length - 1];
    result.push({
      label: currentSegment.charAt(0).toUpperCase() + currentSegment.slice(1),
      path: currentPath,
      isActive: true,
      isLast: true
    });
    
    return result;
  })


  return (
    <Breadcrumb>
      <BreadcrumbList>
        <For each={breadcrumbItems()}>{(crumb, index) =>
          <>
            <BreadcrumbItem class={index() === 0 && !crumb.isLast ? "hidden md:block" : ""}>
              {crumb.isActive ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink as={Link} to={crumb.path}>
                  {crumb.label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {!crumb.isLast && (
              <BreadcrumbSeparator class="hidden md:block" />
            )}
          </>
        }</For>
      </BreadcrumbList>
    </Breadcrumb>
  )
} 