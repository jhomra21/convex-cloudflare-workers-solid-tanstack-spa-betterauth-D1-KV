import { Show, For, createMemo } from 'solid-js';
import { convexApi, useQuery } from '~/lib/convex';
import { Icon } from '~/components/ui/icon';
import { useCurrentUser } from '~/lib/auth-actions';

export interface CanvasActiveUsersProps {
  canvasId?: string;
  currentUserId?: string;
  class?: string;
}

export function CanvasActiveUsers(props: CanvasActiveUsersProps) {
  const currentUser = useCurrentUser();
  
  // Fetch active users for the canvas
  const activeUsers = useQuery(
    convexApi.canvas.getCanvasActiveUsers,
    () => props.canvasId ? { 
      canvasId: props.canvasId as any,
      ownerName: currentUser()?.name || undefined
    } : null
  );

  // Format user names with current user context
  const formattedUsers = createMemo(() => {
    const users = activeUsers.data();
    if (!users) return [];
    
    return users.map(user => ({
      ...user,
      displayName: user.userId === props.currentUserId ? "You" : user.userName,
      isCurrentUser: user.userId === props.currentUserId
    }));
  });

  return (
    <Show when={activeUsers.data() && activeUsers.data()!.length > 0}>
      <div class={`flex items-center gap-1 text-xs text-muted-foreground ${props.class || ''}`}>
        <Icon name="users" class="h-3 w-3" />
        <span>
          {activeUsers.data()!.length} active
        </span>
        <Show when={activeUsers.data()!.length <= 4}>
          <span class="text-muted-foreground/70">•</span>
          <div class="flex items-center gap-1">
            <For each={formattedUsers().slice(0, 4)}>
              {(user, index) => (
                <span class="inline-flex items-center">
                  <span class={user.isOwner ? "font-medium" : ""}>
                    {user.isCurrentUser ? "You" : user.displayName}
                    {user.isOwner ? " (Host)" : ""}
                  </span>
                  {index() < Math.min(formattedUsers().length - 1, 3) ? ", " : ""}
                </span>
              )}
            </For>
            <Show when={activeUsers.data()!.length > 4}>
              <span class="text-muted-foreground/70">
                +{activeUsers.data()!.length - 4} more
              </span>
            </Show>
          </div>
        </Show>
      </div>
    </Show>
  );
}
