import { createSignal, createMemo, For, Show, onMount, onCleanup } from 'solid-js';
import { Button } from '~/components/ui/button';
import { Icon, type IconName } from '~/components/ui/icon';
import { cn } from '~/lib/utils';
import { toast } from 'solid-sonner';
import type { ChatMessage } from '~/types/agents';
import type { ContextItem } from '~/types/context';
import { ContextSelector } from '~/components/ContextSelector';
import { useContextSelection } from '~/lib/hooks/use-context-selection';
import { getAllContextItems } from '~/lib/utils/context-scanner';

export interface FloatingChatInterfaceProps {
  canvasId: string;
  userId: string;
  userName: string;
  chatHistory: ChatMessage[];
  isProcessing: boolean;
  availableAgents: Array<{ id: string; prompt: string; imageUrl?: string; type: string }>;
  onSendMessage: (message: string, contextItems?: any[], uploadedFiles?: File[]) => Promise<void>;
}



export function FloatingChatInterface(props: FloatingChatInterfaceProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [message, setMessage] = createSignal('');
  const [uploadedFiles, setUploadedFiles] = createSignal<File[]>([]);
  const [hoveredMessageIndex, setHoveredMessageIndex] = createSignal<number | null>(null);

  // Initialize context selection
  const contextSelection = useContextSelection();

  let chatContainerRef: HTMLDivElement | undefined;
  let messageInputRef: HTMLTextAreaElement | undefined;
  let fileInputRef: HTMLInputElement | undefined;
  let addContextButtonRef: HTMLButtonElement | undefined;

  // Update available context items when agents change
  createMemo(() => {
    const allItems = getAllContextItems(props.availableAgents);
    contextSelection.updateAvailableItems(allItems);
  });

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    if (chatContainerRef) {
      chatContainerRef.scrollTop = chatContainerRef.scrollHeight;
    }
  };

  // Scroll to bottom when chat history changes
  createMemo(() => {
    const history = props.chatHistory;
    if (history.length > 0 && isOpen()) {
      setTimeout(scrollToBottom, 100);
    }
  });

  // Focus input when chat opens
  createMemo(() => {
    if (isOpen() && messageInputRef) {
      setTimeout(() => messageInputRef?.focus(), 100);
    }
  });

  // Handle message submission
  const handleSendMessage = async () => {
    const currentMessage = message().trim();
    if (!currentMessage || props.isProcessing) return;

    const contextItems = contextSelection.selectedItems();
    const currentUploadedFiles = uploadedFiles();

    // Clear inputs
    setMessage('');
    setUploadedFiles([]);

    try {
      await props.onSendMessage(currentMessage, contextItems, currentUploadedFiles);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    }
  };

  // Handle Enter key in textarea
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
    // Clear all context with Ctrl/Cmd + Shift + X
    if (e.key === 'x' && e.shiftKey && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      contextSelection.clearSelection();
      setUploadedFiles([]);
      toast.success('Cleared all context');
    }
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Copy message to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  // Get icon for item (always returns bot icon for agents)
  const getItemIcon = (item: ContextItem): IconName => {
    // All context items are agents now, so always return 'bot'
    return 'bot';
  };



  // Handle file upload
  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast.error('Please upload image files only');
      return;
    }

    setUploadedFiles(prev => [...prev, ...imageFiles]);
    toast.success(`Added ${imageFiles.length} image(s)`);
  };

  // Remove uploaded file
  const removeUploadedFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };



  // Handle click outside to close (optional)
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.floating-chat-container')) {
      // Uncomment if you want click outside to close
      // setIsOpen(false);
    }
  };

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    onCleanup(() => {
      document.removeEventListener('click', handleClickOutside);
    });
  });

  return (
    <>
      <div class="floating-chat-container absolute bottom-8 right-6 z-[9998]">
        {/* Chat Interface */}
        <div
          class={cn(
            "bg-background border-2 border-border rounded-lg shadow-xl transition-all duration-150 ease-out",
            "flex flex-col overflow-hidden",
            isOpen()
              ? "opacity-100 scale-100 translate-y-0 w-96 h-[28rem]"
              : "opacity-0 scale-95 translate-y-2 w-0 h-0 pointer-events-none"
          )}
          style={{
            'transform-origin': 'bottom right',
          }}
        >
          {/* Header */}
          <div class="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 border-b">
            <div class="flex items-center gap-2 min-w-0">
              <Icon name="message-circle" class="h-4 w-4 text-green-600 flex-shrink-0" />
              <span class="text-sm font-medium text-green-700 dark:text-green-300 truncate">
                AI Chat Assistant
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              class="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              <Icon name="x" class="h-3 w-3" />
            </Button>
          </div>

          {/* Chat Messages */}
          <div
            ref={chatContainerRef}
            class="flex-1 overflow-y-auto p-3 space-y-2 min-h-0"
          >
            <Show
              when={props.chatHistory.length > 0}
              fallback={
                <div class="text-center text-muted-foreground text-sm py-4">
                  <Icon name="message-circle" class="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Start a conversation!</p>
                  <p class="text-xs mt-1">Ask me to create agents for you.</p>
                </div>
              }
            >
              <For each={props.chatHistory}>
                {(msg: ChatMessage, index) => (
                  <div class={cn(
                    "flex gap-2 text-sm",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}>
                    <Show when={msg.role === 'assistant'}>
                      <div class="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon name="bot" class="h-3 w-3 text-green-600" />
                      </div>
                    </Show>

                    <div 
                      class={cn(
                        "max-w-[80%] rounded-lg px-3 py-2 relative group cursor-pointer transition-all",
                        msg.role === 'user'
                          ? "bg-blue-500 text-white hover:bg-blue-600"
                          : "bg-muted text-foreground hover:bg-muted/80"
                      )}
                      onClick={() => copyToClipboard(msg.content)}
                      onMouseEnter={() => setHoveredMessageIndex(index())}
                      onMouseLeave={() => setHoveredMessageIndex(null)}
                      title="Click to copy"
                    >
                      <div class="whitespace-pre-wrap break-words">
                        {/* Split content by **Created Agents:** to handle status section */}
                        <Show
                          when={msg.role === 'assistant' && msg.content.includes('**Created Agents:**')}
                          fallback={<p>{msg.content}</p>}
                        >
                          {(() => {
                            const parts = msg.content.split('**Created Agents:**');
                            return (
                              <>
                                <p>{parts[0]}</p>
                                <Show when={parts[1]}>
                                  <div class="mt-2 pt-2 border-t border-border/20">
                                    <p class="text-xs font-medium text-muted-foreground mb-1">Created Agents:</p>
                                    <div class="space-y-1 text-xs">
                                      <For each={parts[1].trim().split('\n').filter(line => line.trim())}>
                                        {(line) => (
                                          <div class="flex items-center gap-1">
                                            <span class="text-orange-500">🔄</span>
                                            <span class="text-muted-foreground">{line.replace('🔄 ', '')}</span>
                                          </div>
                                        )}
                                      </For>
                                    </div>
                                  </div>
                                </Show>
                              </>
                            );
                          })()}
                        </Show>
                      </div>
                      <p class={cn(
                        "text-xs mt-1 opacity-70",
                        msg.role === 'user' ? "text-blue-100" : "text-muted-foreground"
                      )}>
                        {formatTime(msg.timestamp)}
                      </p>
                      
                      {/* Copy icon on hover */}
                      <Show when={hoveredMessageIndex() === index()}>
                        <div class={cn(
                          "absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity",
                          "bg-background/80 backdrop-blur-sm rounded p-1",
                          msg.role === 'user' ? "bg-blue-600/20" : "bg-muted/50"
                        )}>
                          <Icon 
                            name="copy" 
                            class={cn(
                              "h-3 w-3",
                              msg.role === 'user' ? "text-white" : "text-muted-foreground"
                            )} 
                          />
                        </div>
                      </Show>
                    </div>

                    <Show when={msg.role === 'user'}>
                      <div class="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon name="user" class="h-3 w-3 text-blue-600" />
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </Show>
          </div>

          {/* Context Section - Selected Items */}
          <Show when={contextSelection.hasSelection()}>
            <div class="border-t px-3 py-1.5">
              <div class="flex flex-wrap gap-1">
                <For each={contextSelection.selectedItems().slice(0, 3)}>
                  {(item) => (
                    <div class="flex items-center gap-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-xs border border-blue-200 dark:border-blue-800">
                      <Icon name={getItemIcon(item)} class="h-3 w-3 flex-shrink-0" />
                      <span class="truncate max-w-20">{item.name}</span>
                      <button
                        onClick={() => contextSelection.removeItem(item.id)}
                        class="hover:bg-blue-200 dark:hover:bg-blue-800 rounded p-0.5"
                        title="Remove from context"
                      >
                        <Icon name="x" class="h-2.5 w-2.5" />
                      </button>
                    </div>
                  )}
                </For>
                <Show when={contextSelection.selectionCount() > 3}>
                  <div class="flex items-center px-2 py-1 text-xs text-muted-foreground">
                    +{contextSelection.selectionCount() - 3} more
                  </div>
                </Show>
              </div>
            </div>
          </Show>

          {/* Uploaded Files Section */}
          <Show when={uploadedFiles().length > 0}>
            <div class="border-t px-3 py-1.5">
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-muted-foreground">Uploaded Files</span>
                <button
                  onClick={() => setUploadedFiles([])}
                  class="text-xs text-muted-foreground hover:text-foreground"
                  title="Clear all files"
                >
                  Clear all
                </button>
              </div>
              <div class="flex flex-wrap gap-1">
                <For each={uploadedFiles().slice(0, 3)}>
                  {(file, index) => (
                    <div class="flex items-center gap-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded text-xs border border-green-200 dark:border-green-800">
                      <Icon name="image" class="h-3 w-3 flex-shrink-0" />
                      <span class="truncate max-w-20" title={file.name}>
                        {file.name.length > 15 ? file.name.substring(0, 12) + '...' : file.name}
                      </span>
                      <button
                        onClick={() => removeUploadedFile(index())}
                        class="hover:bg-green-200 dark:hover:bg-green-800 rounded p-0.5"
                        title="Remove file"
                      >
                        <Icon name="x" class="h-2.5 w-2.5" />
                      </button>
                    </div>
                  )}
                </For>
                <Show when={uploadedFiles().length > 3}>
                  <div class="flex items-center px-2 py-1 text-xs text-muted-foreground">
                    +{uploadedFiles().length - 3} more
                  </div>
                </Show>
              </div>
            </div>
          </Show>



          {/* Message Input */}
          <div class="border-t p-3">
            {/* Context Controls */}
            <div class="flex items-center gap-1 mb-2 relative">
              <Button
                ref={addContextButtonRef}
                onClick={() => {
                  contextSelection.openSelector();
                }}
                variant="ghost"
                size="sm"
                class="h-7 px-2 text-xs"
              >
                <Icon name="plus" class="h-3 w-3 mr-1" />
                Add Agents
                <Show when={contextSelection.hasSelection()}>
                  <span class="ml-1 bg-blue-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center">
                    {contextSelection.selectionCount()}
                  </span>
                </Show>
              </Button>

              {/* Context Selector */}
              <Show when={contextSelection.isOpen()}>
                <div class="absolute bottom-full left-0 mb-2">
                  <ContextSelector
                    isOpen={contextSelection.isOpen()}
                    onClose={contextSelection.closeSelector}
                    onSelect={contextSelection.handleSelection}
                    selectedItems={contextSelection.selectedItems()}
                    availableItems={contextSelection.availableItems()}
                  />
                </div>
              </Show>

              <Button
                onClick={() => fileInputRef?.click()}
                variant="ghost"
                size="sm"
                class="h-7 px-2 text-xs"
              >
                <Icon name="paperclip" class="h-3 w-3 mr-1" />
                Upload Images
                <Show when={uploadedFiles().length > 0}>
                  <span class="ml-1 bg-green-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center">
                    {uploadedFiles().length}
                  </span>
                </Show>
              </Button>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                class="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </div>

            <div class="flex gap-2">
              <textarea
                ref={messageInputRef}
                value={message()}
                onInput={(e) => setMessage(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  contextSelection.hasSelection() || uploadedFiles().length > 0
                    ? "Describe what you want to do with the selected context..."
                    : "Ask me to create agents..."
                }
                class="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-h-[2.5rem] max-h-20"
                rows="1"
                disabled={props.isProcessing}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!message().trim() || props.isProcessing}
                size="sm"
                class="px-3"
              >
                <Show
                  when={props.isProcessing}
                  fallback={<Icon name="send" class="h-4 w-4" />}
                >
                  <Icon name="loader-2" class="h-4 w-4 animate-spin" />
                </Show>
              </Button>
            </div>

            <div class="flex items-center justify-between mt-2">
              <p class="text-xs text-muted-foreground">
                <Show 
                  when={contextSelection.hasSelection() || uploadedFiles().length > 0}
                  fallback="Press Enter to send, Shift+Enter for new line"
                >
                  <span title="Ctrl/Cmd+Shift+X to clear all">
                    Enter to send • Ctrl+Shift+X to clear context
                  </span>
                </Show>
              </p>
              <Show when={props.isProcessing}>
                <div class="flex items-center gap-1 text-xs text-orange-500">
                  <Icon name="loader-2" class="h-3 w-3 animate-spin" />
                  <span>Creating agents...</span>
                </div>
              </Show>
            </div>
          </div>


        </div>

        {/* Chat Toggle Button - Subtle Design */}
        <Button
          onClick={() => setIsOpen(!isOpen())}
          class={cn(
            "h-9.5 w-9.5 rounded-full shadow-md transition-all duration-150 ease-out",
            "bg-background border-2 border-border hover:border-green-500/50",
            "hover:bg-green-50 dark:hover:bg-green-950/20",
            "flex items-center justify-center relative",
            isOpen() ? "scale-0 opacity-0 pointer-events-none" : "scale-100 opacity-100"
          )}
          style={{
            'transform-origin': 'center',
          }}
        >
          <Show
            when={props.isProcessing}
            fallback={<Icon name="message-circle" class="h-4 w-4 text-green-600" />}
          >
            <Icon name="loader-2" class="h-4 w-4 animate-spin text-green-600" />
          </Show>

          {/* Notification dot for context selection */}
          <Show when={contextSelection.hasSelection()}>
            <div class="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border border-background"></div>
          </Show>
        </Button>
      </div>
    </>
  );
}
