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

  // Initialize selected items from props
  createMemo(() => {
    const ids = new Set(props.selectedItems.map(item => item.id));
    setSelectedIds(ids);
  });

  // Filter items - only show image agents for context selection
  const filteredItems = createMemo(() => {
    const query = searchQuery().toLowerCase().trim();
    // Only show image agents (already filtered in context-scanner)
    const imageAgentsOnly = props.availableItems.filter(item => item.type === 'agent');
    
    if (!query) return imageAgentsOnly;
    
    return imageAgentsOnly.filter(item => 
      item.name.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query)
    );
  });

  // Get selected items
  const selectedItems = createMemo(() => {
    const ids = selectedIds();
    return props.availableItems.filter(item => ids.has(item.id));
  });

  // Toggle item selection
  const toggleItem = (item: ContextItem) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(item.id)) {
        newSet.delete(item.id);
      } else {
        newSet.add(item.id);
      }
      return newSet;
    });
  };

  // Handle selection confirmation
  const handleConfirm = () => {
    props.onSelect(selectedItems());
    props.onClose();
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      props.onClose();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleConfirm();
    }
  };

  // Handle global key events
  createMemo(() => {
    if (props.isOpen) {
      const handler = (e: KeyboardEvent) => handleKeyDown(e);
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }
  });

  return (
    <Show when={props.isOpen}>
      <div class="absolute bottom-full left-0 mb-2 bg-background border border-border rounded-lg shadow-lg w-fit max-h-60 flex flex-col overflow-hidden">
        {/* Search */}
        <div class="p-2 border-b border-border">
          <div class="relative">
            <Icon name="search" class="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              placeholder="Search image agents..."
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
              <p class="text-xs text-muted-foreground">No image agents found</p>
            </div>
          }>
            <div class="py-1">
              <For each={filteredItems()}>
                {(item) => (
                  <button
                    onClick={() => toggleItem(item)}
                    class={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                      selectedIds().has(item.id) 
                        ? "bg-blue-50 dark:bg-blue-950/50" 
                        : ""
                    )}
                  >
                    <div class="w-6 h-6 rounded bg-muted/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <Show when={item.imageUrl} fallback={<Icon name="bot" class="h-3 w-3 text-muted-foreground" />}>
                        <img src={item.imageUrl} alt="" class="w-full h-full object-cover" />
                      </Show>
                    </div>
                    
                    <div class="min-w-0 flex-1">
                      <div class="font-medium truncate text-xs">{item.name}</div>
                      <div class="text-xs text-muted-foreground truncate">
                        {item.description}
                      </div>
                    </div>
                    
                    <Show when={selectedIds().has(item.id)}>
                      <Icon name="check" class="h-3 w-3 text-blue-600 flex-shrink-0" />
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Footer */}
        <div class="p-2 border-t border-border bg-muted/20 flex items-center justify-between">
          <div class="text-xs text-muted-foreground">
            {selectedItems().length} selected
          </div>
          
          <button
            onClick={handleConfirm}
            disabled={selectedItems().length === 0}
            class="px-2 py-1 text-xs bg-blue-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </Show>
  );
}
