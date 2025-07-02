import { createMemo } from 'solid-js';
import { VoiceAgent, type VoiceAgentProps } from './VoiceAgent';

/**
 * Memoized wrapper for VoiceAgent to prevent unnecessary re-renders.
 * Uses createMemo to only re-render when props actually change.
 */
export function MemoizedVoiceAgent(props: VoiceAgentProps) {
  // Create a memoized version that only updates when relevant props change
  const memoizedAgent = createMemo(() => (
    <VoiceAgent
      id={props.id}
      prompt={props.prompt}
      onRemove={props.onRemove}
      onMouseDown={props.onMouseDown}
      size={props.size}
      onResizeStart={props.onResizeStart}
      generatedAudio={props.generatedAudio}
      voice={props.voice}
      audioSampleUrl={props.audioSampleUrl}
      onPromptChange={props.onPromptChange}
      status={props.status}
      model={props.model}
      type={props.type}
      connectedAgentId={props.connectedAgentId}
      class={props.class}
    />
  ));

  return memoizedAgent();
}
