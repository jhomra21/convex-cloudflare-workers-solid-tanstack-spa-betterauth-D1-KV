/**
 * Memoized wrapper for ImageAgent to prevent unnecessary re-renders
 * This component only re-renders when its specific agent data changes
 */

import { createMemo } from 'solid-js';
import { ImageAgent } from './ImageAgent';
import { cn } from '~/lib/utils';
import type { Agent, AvailableAgent } from '~/types/agents';

interface MemoizedImageAgentProps {
  agent: Agent;
  isDragged: boolean;
  isResizing: boolean;
  zIndex: number;
  isExiting?: boolean;
  isRecentlyDragged?: boolean;
  availableAgents: AvailableAgent[];
  onRemove: (id: string) => void;
  onMouseDown: (e: MouseEvent) => void;
  onResizeStart: (e: MouseEvent, handle: string) => void;
  onPromptChange: (id: string, prompt: string) => void;
  onConnectAgent: (sourceId: string, targetId: string) => void;
  onDisconnectAgent: (id: string) => void;
  class?: string;
}

export function MemoizedImageAgent(props: MemoizedImageAgentProps) {
  // Memoize the agent state to prevent unnecessary re-renders
  const agentState = createMemo(() => {
    // Animation classes based on state
    const animationClass = props.isExiting ? 'animate-scale-out' : '';
    
    return {
      transform: props.isDragged ? 'scale(1.05)' : 'scale(1)',
      transition: props.isDragged ? 'none' : 'transform 0.2s ease',
      borderClass: props.isDragged 
        ? "border-primary shadow-xl" 
        : props.isResizing
        ? "border-secondary shadow-lg"
        : "border-transparent hover:border-muted-foreground/20",
      animationClass
    };
  });

  // Memoize the position and size to avoid object recreation
  const positionStyle = createMemo(() => ({
    transform: `translate3d(${props.agent.position.x}px, ${props.agent.position.y}px, 0) ${agentState().transform}`,
    transition: agentState().transition,
    'z-index': props.zIndex,
    'will-change': 'transform',
  }));

  return (
    <div
      class="absolute select-none"
      data-agent-id={props.agent.id}
      style={positionStyle()}
      onMouseDown={(e) => {
        // Prevent drag if clicking on interactive elements
        const target = e.target as HTMLElement;
        const isInteractiveElement = target.matches('input, textarea, button, select, input[type="range"], [contenteditable="true"], [role="slider"], [data-part="thumb"]') ||
                                   target.closest('input, textarea, button, select, input[type="range"], [contenteditable="true"], [role="slider"], [data-part="thumb"]');
        
        if (!isInteractiveElement) {
          props.onMouseDown(e);
        }
      }}
    >
      <ImageAgent
        id={props.agent.id}
        userName={props.agent.userName}
        prompt={props.agent.prompt}
        onRemove={props.onRemove}
        size={props.agent.size}
        onResizeStart={props.onResizeStart}
        generatedImage={props.agent.generatedImage}
        isDragged={props.isDragged}
        isRecentlyDragged={props.isRecentlyDragged}
        onPromptChange={props.onPromptChange}
        status={props.agent.status}
        model={props.agent.model}
        type={props.agent.type as 'image-generate' | 'image-edit'}
        connectedAgentId={props.agent.connectedAgentId}
        uploadedImageUrl={props.agent.uploadedImageUrl}
        activeImageUrl={props.agent.activeImageUrl}
        availableAgents={props.availableAgents}
        onConnectAgent={props.onConnectAgent}
        onDisconnectAgent={props.onDisconnectAgent}
        class={cn(
          "shadow-lg border-2 transition-all duration-200",
          agentState().borderClass,
          agentState().animationClass,
          props.class
        )}
      />
    </div>
  );
}
