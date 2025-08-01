import { createSignal, createMemo } from 'solid-js';
import type { ContextItem } from '~/types/context';

export interface UseContextSelectionOptions {
  initialItems?: ContextItem[];
}

export function useContextSelection(options: UseContextSelectionOptions = {}) {
  const [selectedItems, setSelectedItems] = createSignal<ContextItem[]>(options.initialItems || []);
  const [isOpen, setIsOpen] = createSignal(false);

  // Available context items - this would typically come from your file system/agents
  const [availableItems, setAvailableItems] = createSignal<ContextItem[]>([]);

  // Memoized selected item IDs for quick lookup
  const selectedItemIds = createMemo(() => 
    new Set(selectedItems().map(item => item.id))
  );

  // Open context selector
  const openSelector = () => {
    setIsOpen(true);
  };

  // Close context selector
  const closeSelector = () => {
    setIsOpen(false);
  };

  // Handle item selection from the selector
  const handleSelection = (items: ContextItem[]) => {
    setSelectedItems(items);
  };

  // Add a single item to selection
  const addItem = (item: ContextItem) => {
    setSelectedItems(prev => {
      const exists = prev.some(existing => existing.id === item.id);
      if (exists) return prev;
      return [...prev, item];
    });
  };

  // Remove a single item from selection
  const removeItem = (itemId: string) => {
    setSelectedItems(prev => prev.filter(item => item.id !== itemId));
  };

  // Clear all selected items
  const clearSelection = () => {
    setSelectedItems([]);
  };

  // Check if an item is selected
  const isItemSelected = (itemId: string) => {
    return selectedItemIds().has(itemId);
  };

  // Update available items (typically called when file system changes)
  const updateAvailableItems = (items: ContextItem[]) => {
    setAvailableItems(items);
  };

  // Get context for chat/AI processing
  const getContextForChat = () => {
    return selectedItems().map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      path: item.path,
      description: item.description
    }));
  };

  return {
    // State
    selectedItems,
    availableItems,
    isOpen,
    selectedItemIds,

    // Actions
    openSelector,
    closeSelector,
    handleSelection,
    addItem,
    removeItem,
    clearSelection,
    isItemSelected,
    updateAvailableItems,
    getContextForChat,

    // Computed
    hasSelection: createMemo(() => selectedItems().length > 0),
    selectionCount: createMemo(() => selectedItems().length)
  };
}
