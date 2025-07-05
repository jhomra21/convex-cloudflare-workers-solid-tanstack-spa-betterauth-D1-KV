import { createSignal, createUniqueId, Show, For } from 'solid-js';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
// Using native textarea to avoid Kobalte context issues
import { Icon } from '~/components/ui/icon';
import { toast } from 'solid-sonner';
import { cn } from '~/lib/utils';
import { useAgentPromptState, useAgentVoiceState, useAgentExaggerationState, useAgentCustomAudioState } from '~/lib/hooks/use-persistent-state';
import { useStableStatus } from '~/lib/hooks/use-stable-props';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { VoiceSelector } from '~/components/VoiceSelector';
import { convexClient, convexApi } from '~/lib/convex';
import type { VoiceOption } from '~/types/agents';

export interface VoiceAgentProps {
    id?: string;
    prompt?: string;
    onRemove?: (id: string) => void;
    onMouseDown?: (e: MouseEvent) => void;
    size?: { width: number; height: number };
    onResizeStart?: (e: MouseEvent, handle: string) => void;
    generatedAudio?: string;
    voice?: VoiceOption;
    audioSampleUrl?: string;

    onPromptChange?: (id: string, prompt: string) => void;
    status?: 'idle' | 'processing' | 'success' | 'failed';
    model?: 'normal' | 'pro';
    type?: 'voice-generate';
    connectedAgentId?: string;
    class?: string;
}

// VOICE_OPTIONS moved to VoiceSelector component

export function VoiceAgent(props: VoiceAgentProps) {
    const agentId = props.id || createUniqueId();

    // Use persistent state hooks for prompt, voice, exaggeration, and custom audio
    const [localPrompt, setLocalPrompt] = useAgentPromptState(agentId, props.prompt || '');
    const [selectedVoice, setSelectedVoice] = useAgentVoiceState(agentId, props.voice || 'Aurora');
    const [exaggeration, setExaggeration] = useAgentExaggerationState(agentId, 1.5);
    const [customAudioUrl, setCustomAudioUrl] = useAgentCustomAudioState(agentId, props.audioSampleUrl || '');
    const [showPromptInput, setShowPromptInput] = createSignal(!props.prompt);
    const [isLocallyGenerating, setIsLocallyGenerating] = createSignal(false);

    // Use stable status to prevent flicker
    const stableStatus = useStableStatus(() => props.status);

    // Combined loading state: local generating OR backend processing
    const isLoading = () => isLocallyGenerating() || stableStatus().isProcessing;
    const hasFailed = () => stableStatus().isFailed;
    const isSuccess = () => stableStatus().isSuccess;
    const hasAudio = () => !!props.generatedAudio;

    const handleGenerateVoice = async () => {
        const currentPrompt = localPrompt().trim();
        if (!currentPrompt) {
            toast.error('Please enter text to generate speech');
            return;
        }

        setIsLocallyGenerating(true);

        // Set status to 'processing' optimistically  
        convexClient.mutation(convexApi.agents.updateAgentStatus, {
            agentId: agentId as any,
            status: 'processing',
        });

        // Sync prompt with parent before calling mutation
        props.onPromptChange?.(agentId, currentPrompt);

        try {
            const response = await fetch('/api/voice', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: currentPrompt,
                    voice: customAudioUrl() ? undefined : selectedVoice(),
                    audioSampleUrl: customAudioUrl() || undefined,
                    exaggeration: exaggeration(),
                    model: props.model || 'normal',
                    agentId,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate voice');
            }

            toast.success('Voice generation started! Please wait...');
            setShowPromptInput(false);
        } catch (error) {
            console.error('Voice generation error:', error as Error);
            toast.error((error as Error).message || 'Failed to generate voice');
        } finally {
            setIsLocallyGenerating(false);
        }
    };

    // handlePromptSubmit removed - not needed since we use onKeyDown

    const handlePromptChange = (value: string) => {
        setLocalPrompt(value); // This automatically persists via the hook
    };

    // Only sync to canvas when user finishes editing
    const handleBlur = () => {
        props.onPromptChange?.(agentId, localPrompt());
    };



    // Voice change is now handled directly in VoiceSelector

    const handleEditPrompt = () => {
        setShowPromptInput(true);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleGenerateVoice();
        }
    };

    // Agent size - use props.size directly to avoid circular dependency
    const agentSize = () => props.size || { width: 320, height: 384 };

    return (
        <ErrorBoundary>
            <style>
                {`
          .exaggeration-slider {
            -webkit-appearance: none;
            appearance: none;
            background: transparent;
            outline: none;
          }
          
          .exaggeration-slider::-webkit-slider-track {
            height: 12px;
            border-radius: 6px;
            background: transparent;
          }
          
          .exaggeration-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            height: 16px;
            width: 16px;
            border-radius: 50%;
            background: #3b82f6;
            border: 2px solid white;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            margin-top: -6px;
          }
          
          .exaggeration-slider::-webkit-slider-thumb:hover {
            transform: scale(1.1);
            will-change: transform;
            -moz-transition: transform 0.1s ease-in-out;
            transition: transform 0.1s ease-in-out;
            -webkit-transition: transform 0.1s ease-in-out;
          }
          
          .exaggeration-slider::-moz-range-track {
            height: 12px;
            border-radius: 6px;
            background: transparent;
            border: none;
          }
          
          .exaggeration-slider::-moz-range-thumb {
            height: 16px;
            width: 16px;
            border-radius: 50%;
            background: #3b82f6;
            border: 2px solid white;
            cursor: pointer;
            -moz-appearance: none;
            appearance: none;
          }
          
          .exaggeration-slider::-moz-range-thumb:hover {
            transform: scale(1.1);
            will-change: transform;
            transition: transform 0.1s ease-in-out;
            -moz-transition: transform 0.1s ease-in-out;
            -webkit-transition: transform 0.1s ease-in-out;
          }
          
          .exaggeration-slider:disabled::-webkit-slider-thumb {
            background: #9ca3af;
            cursor: not-allowed;
          }
          
          .exaggeration-slider:disabled::-moz-range-thumb {
            background: #9ca3af;
            cursor: not-allowed;
          }
        `}
            </style>
            <Card
                class={cn(
                    "flex flex-col relative transition-all duration-300",
                    isLoading() ? "border border-secondary/50" : "",
                    props.class
                )}
                style={{
                    width: `${agentSize().width}px`,
                    height: `${agentSize().height}px`
                }}
            >
                {/* Drag Handle - Larger clickable area */}
                <div
                    class="w-full h-8 bg-muted/30 cursor-move rounded-t-lg hover:bg-muted/50 transition-colors flex items-center justify-between px-3 border-b border-muted/40"
                    title="Drag to move agent"
                >
                    <div class="flex items-center gap-2">
                        <Show when={isLoading()} fallback={
                            <Icon
                                name="mic"
                                class="h-3 w-3 text-muted-foreground/60"
                            />
                        }>
                            <Icon
                                name="loader"
                                class="h-3 w-3 animate-spin text-muted-foreground/60"
                            />
                        </Show>
                        <span class="text-xs text-muted-foreground/60 capitalize">
                            Voice
                        </span>
                    </div>
                    
                    <div class="flex gap-1">
                        <div class="w-1 h-1 bg-muted-foreground/40 rounded-full"></div>
                        <div class="w-1 h-1 bg-muted-foreground/40 rounded-full"></div>
                        <div class="w-1 h-1 bg-muted-foreground/40 rounded-full"></div>
                    </div>
                </div>

                <CardContent class="p-4 flex flex-col h-full relative">
                    {/* Action Buttons Overlay - Only show when there's no audio or we're in prompt input mode */}
                    <Show when={!isLoading() && props.onRemove && (!hasAudio() || showPromptInput())}>
                        <div class="absolute top-2 right-2 flex gap-1 z-10">
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => props.onRemove?.(agentId)}
                            >
                                <Icon name="x" class="h-3 w-3" />
                            </Button>
                        </div>
                    </Show>

                    {/* Prompt Section */}
                    <div class="flex-shrink-0 mb-4">
                        <Show when={showPromptInput() || !hasAudio()}>
                            <div class="space-y-2">
                                {/* Voice Selection */}
                                <div class="flex items-center gap-2">
                                    <div class="text-xs text-muted-foreground">Voice:</div>
                                    <VoiceSelector
                                        selectedVoice={selectedVoice() as VoiceOption}
                                        onVoiceChange={(voice) => setSelectedVoice(voice)}
                                        customAudioUrl={customAudioUrl()}
                                        disabled={isLoading()}
                                    />
                                </div>

                                {/* Custom Audio URL (Optional) */}
                                <Input
                                    value={customAudioUrl()}
                                    onInput={(e) => setCustomAudioUrl((e.target as HTMLInputElement).value)}
                                    placeholder="Optional: Custom voice audio URL"
                                    class="text-xs"
                                />

                                {/* Exaggeration Slider */}
                                <div class="space-y-1">
                                    <div class="flex items-center justify-between">
                                        <label class="text-xs text-muted-foreground">Exaggeration:</label>
                                        <span class="text-xs text-muted-foreground font-mono">{exaggeration().toFixed(2)}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.25"
                                        max="2.0"
                                        step="0.05"
                                        value={exaggeration()}
                                        onInput={(e) => setExaggeration(parseFloat((e.target as HTMLInputElement).value))}
                                        disabled={isLoading()}
                                        class="exaggeration-slider w-full h-3 bg-muted rounded-lg cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 border border-muted-foreground/20"
                                        style={{
                                            background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${((exaggeration() - 0.25) / (2.0 - 0.25)) * 100}%, hsl(var(--muted-foreground) / 0.3) ${((exaggeration() - 0.25) / (2.0 - 0.25)) * 100}%, hsl(var(--muted-foreground) / 0.3) 100%)`
                                        }}
                                    />
                                    <div class="flex justify-between text-xs text-muted-foreground/60">
                                        <span>Subtle (0.25)</span>
                                        <span>Dramatic (2.0)</span>
                                    </div>
                                </div>

                                <textarea
                                    value={localPrompt()}
                                    onInput={(e) => handlePromptChange(e.currentTarget.value)}
                                    onBlur={handleBlur}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Enter text to convert to speech..."
                                    class="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-shadow placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                                    rows={3}
                                    disabled={isLoading()}
                                />

                                <Button
                                    onClick={handleGenerateVoice}
                                    class="w-full"
                                    disabled={isLoading() || !localPrompt().trim()}
                                >
                                    <Show when={isLoading()} fallback={
                                        <>
                                            <Icon name="mic" class="w-4 h-4 mr-2" />
                                            Generate Speech
                                        </>
                                    }>
                                        <Icon name="loader" class="w-4 h-4 mr-2 animate-spin" />
                                        Generating...
                                    </Show>
                                </Button>
                            </div>
                        </Show>
                    </div>

                    {/* Generated Audio Display */}
                    <Show when={hasAudio() && isSuccess()}>
                        <div class="flex-1 flex flex-col relative">
                            {/* Audio Info */}
                            <div class="mb-3">
                                <p class="text-xs text-muted-foreground mb-1">Generated Audio:</p>
                                <p class="text-xs text-muted-foreground/80">
                                    Voice: {selectedVoice()}
                                    <Show when={customAudioUrl()}>
                                        {" (Custom)"}
                                    </Show>
                                    <br />
                                    Exaggeration: {exaggeration().toFixed(2)}
                                </p>
                            </div>

                            {/* Audio Player */}
                            <div class="bg-muted/30 rounded-lg p-3 mb-3 relative">
                                <audio
                                    controls
                                    class="w-full"
                                    preload="none"
                                >
                                    <source src={props.generatedAudio} type="audio/wav" />
                                    Your browser does not support the audio element.
                                </audio>

                                {/* Action Buttons Overlay - removed to prevent overlap */}
                            </div>

                            {/* Action Buttons */}
                            <div class="flex gap-2 mt-auto">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="flex-1"
                                    onClick={handleEditPrompt}
                                >
                                    <Icon name="edit" class="w-3 h-3 mr-2" />
                                    Edit
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="flex-1"
                                    onClick={() => {
                                        if (props.generatedAudio) {
                                            const link = document.createElement('a');
                                            link.href = props.generatedAudio;
                                            link.download = `voice-${Date.now()}.wav`;
                                            link.click();
                                        }
                                    }}
                                >
                                    <Icon name="download" class="w-3 h-3 mr-2" />
                                    Download
                                </Button>
                                {/* Add delete button here when audio is shown */}
                                <Show when={props.onRemove}>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => props.onRemove?.(agentId)}
                                    >
                                        <Icon name="x" class="w-3 h-3" />
                                    </Button>
                                </Show>
                            </div>
                        </div>
                    </Show>

                    {/* Error State */}
                    <Show when={hasFailed()}>
                        <div class="flex-1 flex flex-col items-center justify-center text-center">
                            <Icon name="x" class="w-8 h-8 text-destructive mb-2" />
                            <p class="text-sm text-muted-foreground mb-3">
                                Voice generation failed
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleEditPrompt}
                            >
                                <Icon name="refresh-cw" class="w-3 h-3 mr-2" />
                                Try Again
                            </Button>
                        </div>
                    </Show>

                    {/* Loading State */}
                    <Show when={isLoading() && !hasAudio()}>
                        <div class="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-20">
                            <Icon name="loader" class="w-8 h-8 animate-spin text-muted-foreground mb-2" />
                            <p class="text-sm text-muted-foreground">
                                Generating voice...
                            </p>
                        </div>
                    </Show>
                </CardContent>

                {/* Resize Handles - Following the same pattern as ImageAgent */}
                <Show when={props.onResizeStart}>
                    <For each={[
                        { position: 'nw', cursor: 'nw-resize', class: 'top-0 left-0 -mt-1 -ml-1' },
                        { position: 'ne', cursor: 'ne-resize', class: 'top-0 right-0 -mt-1 -mr-1' },
                        { position: 'sw', cursor: 'sw-resize', class: 'bottom-0 left-0 -mb-1 -ml-1' },
                        { position: 'se', cursor: 'se-resize', class: 'bottom-0 right-0 -mb-1 -mr-1' },
                        { position: 'n', cursor: 'n-resize', class: 'top-0 left-1/2 -mt-1 -ml-1' },
                        { position: 's', cursor: 's-resize', class: 'bottom-0 left-1/2 -mb-1 -ml-1' },
                        { position: 'w', cursor: 'w-resize', class: 'top-1/2 left-0 -mt-1 -ml-1' },
                        { position: 'e', cursor: 'e-resize', class: 'top-1/2 right-0 -mt-1 -mr-1' },
                    ]}>
                        {(handle) => (
                            <div
                                class={cn(
                                    "absolute w-2 h-2 bg-primary/50 rounded-full opacity-0 hover:opacity-100 transition-opacity z-10",
                                    handle.class
                                )}
                                style={{ cursor: handle.cursor }}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    props.onResizeStart?.(e, handle.position);
                                }}
                            />
                        )}
                    </For>
                </Show>
            </Card>
        </ErrorBoundary>
    );
}
