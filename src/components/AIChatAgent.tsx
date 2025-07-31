import { createSignal, createMemo, For, Show } from 'solid-js';
import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { cn } from '~/lib/utils';
import { toast } from 'solid-sonner';
import type { Agent, ChatMessage } from '~/types/agents';

export interface AIChatAgentProps {
  agent: Agent;
  canvasId: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onRemove: (id: string) => void;
  onAnimationEnd: (id: string) => void;
  isDragging: boolean;
  isConnecting: boolean;
  canConnect: boolean;
  onStartConnection: (id: string) => void;
  onCompleteConnection: (id: string) => void;
  onCancelConnection: () => void;
  onMouseDown: (e: MouseEvent) => void;
  isDeleting?: boolean;
}

export function AIChatAgent(props: AIChatAgentProps) {
  const [message, setMessage] = createSignal('');
  const [isProcessing, setIsProcessing] = createSignal(false);
  // Chat is always expanded - no need for expand/collapse state
  let chatContainerRef: HTMLDivElement | undefined;
  let messageInputRef: HTMLTextAreaElement | undefined;

  // Get chat history from agent
  const chatHistory = createMemo(() => props.agent.chatHistory || []);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    if (chatContainerRef) {
      chatContainerRef.scrollTop = chatContainerRef.scrollHeight;
    }
  };

  // Scroll to bottom when chat history changes
  createMemo(() => {
    const history = chatHistory();
    if (history.length > 0) {
      setTimeout(scrollToBottom, 100);
    }
  });

  // Handle message submission
  const handleSendMessage = async () => {
    const currentMessage = message().trim();
    if (!currentMessage || isProcessing()) return;

    setIsProcessing(true);
    setMessage('');

    try {
      const response = await fetch('/api/ai-chat/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentMessage,
          chatAgentId: props.agent.id,
          canvasId: props.canvasId,
          referencedAgents: [],
          uploadedFiles: []
        })
      });

      if (!response.ok) {
        throw new Error('Failed to process message');
      }

      const result = await response.json();
      
      if (result.success) {
        toast.success(`${result.response}`);
        if (result.createdAgents?.length > 0) {
          toast.success(`Created ${result.createdAgents.length} agent(s)`);
        }
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Enter key in textarea
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Focus input when component mounts
  createMemo(() => {
    if (messageInputRef) {
      setTimeout(() => messageInputRef?.focus(), 100);
    }
  });

  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div
      class={cn(
        "absolute bg-background border-2 rounded-lg shadow-lg transition-all duration-200",
        "flex flex-col overflow-hidden",
        props.isSelected ? "border-blue-500 shadow-blue-500/20" : "border-border",
        props.isDeleting ? "animate-out fade-out zoom-out duration-300" : "",
        props.isDragging ? "cursor-grabbing shadow-xl" : "cursor-grab",
        props.canConnect ? "border-green-500 shadow-green-500/20" : "",
        props.isConnecting ? "border-yellow-500 shadow-yellow-500/20" : ""
      )}
      style={{
        left: `${props.agent.position.x}px`,
        top: `${props.agent.position.y}px`,
        width: `${props.agent.size.width}px`,
        height: `${props.agent.size.height}px`,
        'z-index': props.isSelected ? 1000 : 1,
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!props.isDragging) {
          props.onSelect(props.agent.id);
        }
      }}
      onMouseDown={(e) => {
        // Allow dragging from header area, but not from interactive elements
        const target = e.target as HTMLElement;
        const isInteractiveElement = target.closest('button') || target.closest('textarea') || target.closest('input');
        if (!isInteractiveElement) {
          props.onMouseDown(e);
        }
      }}
      onAnimationEnd={() => {
        if (props.isDeleting) {
          props.onAnimationEnd(props.agent.id);
        }
      }}
    >
      {/* Header */}
      <div class="chat-header flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 border-b">
        <div class="flex items-center gap-2 min-w-0">
          <Icon name="message-circle" class="h-4 w-4 text-green-600 flex-shrink-0" />
          <span class="text-sm font-medium text-green-700 dark:text-green-300 truncate">
            AI Chat Assistant
          </span>
        </div>
        
        <div class="chat-header-button flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            class="h-6 w-6 p-0 text-red-500 hover:text-red-600"
            onClick={(e: Event) => {
              e.stopPropagation();
              props.onRemove(props.agent.id);
            }}
          >
            <Icon name="x" class="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Chat Messages */}
        <div 
          ref={chatContainerRef}
          class="flex-1 overflow-y-auto p-3 space-y-2 min-h-0"
        >
          <Show 
            when={chatHistory().length > 0}
            fallback={
              <div class="text-center text-muted-foreground text-sm py-4">
                <Icon name="message-circle" class="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Start a conversation!</p>
                <p class="text-xs mt-1">Ask me to create agents for you.</p>
              </div>
            }
          >
            <For each={chatHistory()}>
              {(msg: ChatMessage) => (
                <div class={cn(
                  "flex gap-2 text-sm",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}>
                  <Show when={msg.role === 'assistant'}>
                    <div class="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon name="bot" class="h-3 w-3 text-green-600" />
                    </div>
                  </Show>
                  
                  <div class={cn(
                    "max-w-[80%] rounded-lg px-3 py-2",
                    msg.role === 'user' 
                      ? "bg-blue-500 text-white" 
                      : "bg-muted text-foreground"
                  )}>
                    <p class="whitespace-pre-wrap break-words">{msg.content}</p>
                    <p class={cn(
                      "text-xs mt-1 opacity-70",
                      msg.role === 'user' ? "text-blue-100" : "text-muted-foreground"
                    )}>
                      {formatTime(msg.timestamp)}
                    </p>
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

        {/* Message Input */}
        <div class="border-t p-3">
          <div class="flex gap-2">
            <textarea
              ref={messageInputRef}
              value={message()}
              onInput={(e) => setMessage(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me to create agents..."
              class="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-h-[2.5rem] max-h-20"
              rows="1"
              disabled={isProcessing()}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!message().trim() || isProcessing()}
              size="sm"
              class="px-3"
            >
              <Show 
                when={isProcessing()}
                fallback={<Icon name="send" class="h-4 w-4" />}
              >
                <Icon name="loader-2" class="h-4 w-4 animate-spin" />
              </Show>
            </Button>
          </div>
          
          <p class="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>

      {/* Processing Indicator */}
      <Show when={isProcessing()}>
        <div class="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div class="flex items-center gap-2 text-sm">
            <Icon name="loader-2" class="h-4 w-4 animate-spin" />
            <span>Processing...</span>
          </div>
        </div>
      </Show>
    </div>
  );
}