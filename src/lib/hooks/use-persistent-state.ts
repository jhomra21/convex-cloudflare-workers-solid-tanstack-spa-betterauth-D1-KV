import { createSignal } from 'solid-js';

// WeakMap for storing component-specific state
// This prevents memory leaks as it allows garbage collection of unused keys
const persistentStateMap = new WeakMap<object, Map<string, any>>();

// Stable context objects for agent prompts - prevents recreation on re-renders
const agentContexts = new Map<string, object>();

// Default context object to avoid circular references
const defaultContext = {};

export function usePersistentState<T>(
  key: string,
  initialValue: T,
  contextObject?: object
): [() => T, (value: T) => void] {
  // Use provided context object or create a default one
  const context = contextObject || defaultContext;
  
  // Get or create state map for this context
  if (!persistentStateMap.has(context)) {
    persistentStateMap.set(context, new Map());
  }
  const stateMap = persistentStateMap.get(context)!;
  
  // Initialize signal with persisted value or initial value
  const persistedValue = stateMap.get(key) ?? initialValue;
  const [value, setValue] = createSignal<T>(persistedValue);
  
  // Persist changes to the map
  const setPersistentValue = (newValue: T) => {
    setValue(() => newValue);
    stateMap.set(key, newValue);
  };
  
  return [value, setPersistentValue];
}

// Specific hook for agent prompt state with automatic cleanup
export function useAgentPromptState(agentId: string, initialPrompt: string = '') {
  // Get or create a stable context object for this agent ID
  if (!agentContexts.has(agentId)) {
    agentContexts.set(agentId, { agentId });
  }
  const agentContext = agentContexts.get(agentId)!;
  
  return usePersistentState(`prompt-${agentId}`, initialPrompt, agentContext);
}

// Specific hook for agent voice state
export function useAgentVoiceState(agentId: string, initialVoice: any = 'Aurora') {
  if (!agentContexts.has(agentId)) {
    agentContexts.set(agentId, { agentId });
  }
  const agentContext = agentContexts.get(agentId)!;
  
  return usePersistentState(`voice-${agentId}`, initialVoice, agentContext);
}

// Specific hook for agent exaggeration state
export function useAgentExaggerationState(agentId: string, initialExaggeration: number = 1.5) {
  if (!agentContexts.has(agentId)) {
    agentContexts.set(agentId, { agentId });
  }
  const agentContext = agentContexts.get(agentId)!;
  
  return usePersistentState(`exaggeration-${agentId}`, initialExaggeration, agentContext);
}

// Specific hook for agent custom audio URL state
export function useAgentCustomAudioState(agentId: string, initialUrl: string = '') {
  if (!agentContexts.has(agentId)) {
    agentContexts.set(agentId, { agentId });
  }
  const agentContext = agentContexts.get(agentId)!;
  
  return usePersistentState(`customAudio-${agentId}`, initialUrl, agentContext);
}

// Specific hook for agent edit mode state
export function useAgentEditModeState(agentId: string, initialEditMode: boolean = false) {
  if (!agentContexts.has(agentId)) {
    agentContexts.set(agentId, { agentId });
  }
  const agentContext = agentContexts.get(agentId)!;
  
  return usePersistentState(`editMode-${agentId}`, initialEditMode, agentContext);
}
