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
  const agentState = createMemo(() => ({
    transform: props.isDragged ? 'scale(1.05)' : 'scale(1)',
    transition: props.isDragged ? 'none' : 'transform 0.2s ease',
    borderClass: props.isDragged 
      ? "border-primary shadow-xl" 
      : props.isResizing
      ? "border-secondary shadow-lg"
      : "border-transparent hover:border-muted-foreground/20"
  }));

  // Memoize the position and size to avoid object recreation
  const positionStyle = createMemo(() => ({
    left: `${props.agent.position.x}px`,
    top: `${props.agent.position.y}px`,
    transform: agentState().transform,
    transition: agentState().transition,
    'z-index': props.zIndex
  }));

  return (
    <div
      class="absolute select-none"
      style={positionStyle()}
    >
      <ImageAgent
        id={props.agent.id}
        prompt={props.agent.prompt}
        onRemove={props.onRemove}
        onMouseDown={props.onMouseDown}
        size={props.agent.size}
        onResizeStart={props.onResizeStart}
        generatedImage={props.agent.generatedImage}
        onPromptChange={props.onPromptChange}
        status={props.agent.status}
        model={props.agent.model}
        type={props.agent.type}
        connectedAgentId={props.agent.connectedAgentId}
        uploadedImageUrl={props.agent.uploadedImageUrl}
        activeImageUrl={props.agent.activeImageUrl}
        availableAgents={props.availableAgents}
        onConnectAgent={props.onConnectAgent}
        onDisconnectAgent={props.onDisconnectAgent}
        class={cn(
          "shadow-lg border-2 transition-all duration-200",
          agentState().borderClass,
          props.class
        )}
      />
    </div>
  );
}
