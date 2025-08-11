import { createSignal, createMemo, For, Show } from 'solid-js';
import { Icon } from '~/components/ui/icon';
import { cn } from '~/lib/utils';
import type { ContextItem } from '~/types/context';

export interface ContextSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (items: ContextItem[]) => void;
  selectedItems: ContextItem[];
  availableItems: ContextItem[];
  placeholder?: string;
  title?: string;
}

export function ContextSelector(props: ContextSelectorProps) {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set());
  
  let containerRef: HTMLDivElement | undefined;

  // Initialize selected items from props
  createMemo(() => {
    const ids = new Set(props.selectedItems.map(item => item.id));
    setSelectedIds(ids);
  });

  // Filter items - only show image agents for context selection
  // Voice and video agents are excluded since chat can only process images
  const filteredItems = createMemo(() => {
    const query = searchQuery().toLowerCase().trim();
    const agentsOnly = props.availableItems.filter(item => {
      // Only show agent-type items
      if (item.type !== 'agent') return false;
      
      // Exclude voice and video agents from selection
      // Chat agents can only work with image agents
      const agentTypeName = item.name.toLowerCase();
      const isVoiceAgent = agentTypeName.includes('voice');
      const isVideoAgent = agentTypeName.includes('video');
      
      return !isVoiceAgent && !isVideoAgent;
    });
    
    if (!query) return agentsOnly;
    
    return agentsOnly.filter(item => 
      item.name.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query)
    );
  });

  // Get selected items
  const selectedItems = createMemo(() => {
    const ids = selectedIds();
    return props.availableItems.filter(item => ids.has(item.id));
  });

  // Toggle item selection and immediately update parent
  const toggleItem = (item: ContextItem) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(item.id)) {
        newSet.delete(item.id);
      } else {
        newSet.add(item.id);
      }
      // Immediately update the parent with new selection
      const newSelectedItems = props.availableItems.filter(i => newSet.has(i.id));
      props.onSelect(newSelectedItems);
      return newSet;
    });
  };

  // Handle close - no need for confirm anymore
  const handleClose = () => {
    props.onClose();
  };

  // Handle click outside and escape key
  createMemo(() => {
    if (props.isOpen) {
      const handleKeyDownWrapper = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          props.onClose();
        }
      };
      
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (containerRef && containerRef.contains(target)) {
          return;
        }
        const isAddAgentsButton = target.closest('button')?.textContent?.includes('Add Agents');
        if (isAddAgentsButton) {
          return;
        }
        props.onClose();
      };

      document.addEventListener('keydown', handleKeyDownWrapper);
      
      const clickTimeout = setTimeout(() => {
        document.addEventListener('click', handleClickOutside, true);
      }, 0);
      
      return () => {
        clearTimeout(clickTimeout);
        document.removeEventListener('keydown', handleKeyDownWrapper);
        document.removeEventListener('click', handleClickOutside, true);
      };
    }
  });

  return (
    <Show when={props.isOpen}>
      <div 
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        class="absolute bottom-full left-0 mb-2 bg-background border border-border rounded-lg shadow-lg w-80 max-h-72 flex flex-col overflow-hidden">
        {/* Search */}
        <div class="p-2 border-b border-border">
          <div class="relative">
            <Icon name="search" class="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              placeholder="Search agents..."
              class="w-full pl-7 pr-3 py-1.5 text-sm bg-muted/50 border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring focus:border-transparent"
              autofocus
            />
          </div>
        </div>

        {/* Items List */}
        <div class="flex-1 overflow-y-auto">
          <Show when={filteredItems().length > 0} fallback={
            <div class="flex flex-col items-center justify-center py-4 text-center">
              <Icon name="search-x" class="h-5 w-5 text-muted-foreground mb-1" />
              <p class="text-xs text-muted-foreground">No agents found</p>
            </div>
          }>
            <div class="py-1">
              <For each={filteredItems()}>
                {(item) => (
                  <button
                    onClick={() => toggleItem(item)}
                    class={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-all",
                      "hover:bg-muted/50 border-l-2 border-transparent",
                      selectedIds().has(item.id) 
                        ? "bg-blue-50 dark:bg-blue-950/30 border-l-blue-500" 
                        : "hover:border-l-muted-foreground/20"
                    )}
                  >
                    <div class="w-8 h-8 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0 overflow-hidden border border-border/50">
                      <Show when={item.imageUrl} fallback={<Icon name="bot" class="h-4 w-4 text-muted-foreground" />}>
                        <img src={item.imageUrl} alt="" class="w-full h-full object-cover" />
                      </Show>
                    </div>
                    
                    <div class="min-w-0 flex-1">
                      <div class="font-medium truncate text-sm">{item.name}</div>
                      <div class="text-xs text-muted-foreground truncate">
                        {item.description || item.type}
                      </div>
                    </div>
                    
                    <div class={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                      selectedIds().has(item.id)
                        ? "bg-blue-500 border-blue-500"
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    )}>
                      <Show when={selectedIds().has(item.id)}>
                        <Icon name="check" class="h-3 w-3 text-white" />
                      </Show>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Footer - simplified */}
        <div class="p-2 border-t border-border bg-muted/20 flex items-center justify-between">
          <div class="text-xs text-muted-foreground">
            <Show when={selectedItems().length > 0} fallback="Click agents to add them">
              {selectedItems().length} selected
            </Show>
          </div>
          
          <button
            onClick={handleClose}
            class="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </Show>
  );
}
