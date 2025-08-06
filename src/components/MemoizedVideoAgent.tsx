/**
 * Memoized wrapper for VideoAgent to prevent unnecessary re-renders
 * This component only re-renders when its specific agent data changes
 */

import { createMemo } from 'solid-js';
import { VideoAgent } from './VideoAgent';
import { cn } from '~/lib/utils';
import type { Agent, AvailableAgent } from '~/types/agents';

interface MemoizedVideoAgentProps {
  agent: Agent;
  isDragged: boolean;
  isResizing: boolean;
  zIndex: number;
  isExiting?: boolean;
  availableAgents?: AvailableAgent[];
  onRemove: (id: string) => void;
  onMouseDown: (e: MouseEvent) => void;
  onResizeStart: (e: MouseEvent, handle: string) => void;
  onPromptChange: (id: string, prompt: string) => void;
  onConnectAgent?: (sourceAgentId: string, targetAgentId: string) => void;
  onDisconnectAgent?: (agentId: string) => void;
  onAnimationEnd?: (id: string) => void;
  class?: string;
}

export function MemoizedVideoAgent(props: MemoizedVideoAgentProps) {
  // Simple style calculations without excessive memoization
  const animationClass = () => props.isExiting ? 'animate-scale-out' : '';
  const borderClass = () => {
    if (props.isDragged) return "border-primary shadow-xl";
    if (props.isResizing) return "border-secondary shadow-lg";
    return "border-transparent hover:border-muted-foreground/20";
  };

  return (
    <div
      class="absolute select-none"
      data-agent-id={props.agent.id}
      style={{
        transform: `translate3d(${props.agent.position.x}px, ${props.agent.position.y}px, 0) ${props.isDragged ? 'scale(1.05)' : ''}`,
        transition: props.isDragged ? 'none' : 'transform 0.2s ease',
        'z-index': props.zIndex,
        'will-change': props.isDragged ? 'transform' : 'auto',
      }}
      onMouseDown={(e) => {
        // Prevent drag if clicking on interactive elements
        const target = e.target as HTMLElement;
        const isInteractiveElement = target.matches('input, textarea, button, select, video, [contenteditable="true"], [role="slider"], [data-part="thumb"]') ||
          target.closest('input, textarea, button, select, video, [contenteditable="true"], [role="slider"], [data-part="thumb"]');

        if (!isInteractiveElement) {
          props.onMouseDown(e);
        }
      }}
      onAnimationEnd={(e) => {
        // Only handle our scale-out animation, not child animations
        if (e.animationName === 'agent-scale-out' && props.onAnimationEnd) {
          props.onAnimationEnd(props.agent.id);
        }
      }}
    >
      <VideoAgent
        id={props.agent.id}
        userName={props.agent.userName}
        prompt={props.agent.prompt}
        size={props.agent.size}
        generatedVideo={props.agent.generatedVideo}
        status={props.agent.status}
        model={props.agent.model}
        type={props.agent.type as 'video-generate' | 'video-image-to-video'}
        connectedAgentId={props.agent.connectedAgentId}
        availableAgents={props.availableAgents}
        onRemove={props.onRemove}
        onResizeStart={props.onResizeStart}
        onPromptChange={props.onPromptChange}
        onConnectAgent={props.onConnectAgent}
        onDisconnectAgent={props.onDisconnectAgent}
        class={cn(
          "shadow-lg border-2 transition-all duration-200",
          borderClass(),
          animationClass(),
          props.class
        )}
      />
    </div>
  );
}
