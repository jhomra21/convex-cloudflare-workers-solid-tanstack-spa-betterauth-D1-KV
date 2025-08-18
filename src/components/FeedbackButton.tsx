import { createSignal, Show } from 'solid-js'
import { Button } from '~/components/ui/button'
import { TextField, TextFieldTextArea, TextFieldLabel } from '~/components/ui/text-field'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Icon } from './ui/icon'
import { useSubmitFeedbackMutation } from '~/lib/feedback-actions'

export function FeedbackButton() {
    const [isOpen, setIsOpen] = createSignal(false)
    const [feedbackType, setFeedbackType] = createSignal<'bug' | 'feedback'>('feedback')
    const [message, setMessage] = createSignal('')
    const [submitSuccess, setSubmitSuccess] = createSignal(false)

    const submitFeedbackMutation = useSubmitFeedbackMutation()

    const handleSubmit = async () => {
        if (!message().trim()) return

        try {
            await submitFeedbackMutation.mutateAsync({
                type: feedbackType(),
                message: message().trim()
            })

            // Show success state briefly
            setSubmitSuccess(true)
            setTimeout(() => {
                setSubmitSuccess(false)
                setMessage('')
                setIsOpen(false)
            }, 1500)

        } catch (error) {
            console.error('Failed to submit feedback:', error)
            // Error handling is managed by the mutation
        }
    }

    const handleClose = () => {
        setIsOpen(false)
        setMessage('')
        setSubmitSuccess(false)
    }

    return (
        <DropdownMenu open={isOpen()} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger
                as={Button}
                variant="ghost"
                size="sm"
                class="gap-2 !px-2"
            >
                <Icon class='size-4' name="message-circle" />
                Feedback
            </DropdownMenuTrigger>
            <DropdownMenuContent class="w-80 p-4">
                <div class="space-y-4">
                    {/* Header with type selection */}
                    <div class="flex items-center justify-between">
                        <div class="flex gap-2">
                            <Button
                                variant={feedbackType() === 'bug' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setFeedbackType('bug')}
                            >
                                <Icon class='size-4' name="bug" />
                                Bug
                            </Button>
                            <Button
                                variant={feedbackType() === 'feedback' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setFeedbackType('feedback')}
                            >
                                <Icon class='size-4' name="message-circle" />
                                Feedback
                            </Button>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClose}
                            class="size-8 p-0"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                class="size-4"
                            >
                                <path d="M18 6 6 18" />
                                <path d="M6 6l12 12" />
                            </svg>
                        </Button>
                    </div>

                    {/* Message input */}
                    <TextField class="space-y-2">
                        <TextFieldLabel>
                            {feedbackType() === 'bug' ? 'Describe the bug' : 'Share your feedback'}
                        </TextFieldLabel>
                        <TextFieldTextArea
                            value={message()}
                            onInput={(e) => {
                                const target = e.currentTarget as HTMLTextAreaElement;
                                setMessage(target.value);
                            }}
                            onKeyDown={(e: Event) => {
                                // Prevent dropdown from interfering with text input
                                e.stopPropagation();
                            }}
                            onKeyUp={(e: Event) => {
                                // Also prevent on keyup to be safe
                                e.stopPropagation();
                            }}
                            placeholder={
                                feedbackType() === 'bug'
                                    ? 'What went wrong? Please include steps to reproduce...'
                                    : 'What would you like to see improved?'
                            }
                            class="min-h-[100px] resize-none"
                        />
                    </TextField>

                    {/* Submit button */}
                    <div class="flex justify-end">
                        <Show when={submitSuccess()}>
                            <div class="flex items-center gap-2 text-sm text-green-600">
                                <Icon class="size-4" name="check" />
                                {feedbackType() === 'bug' ? 'Thank you for the bug report!' : 'Thank you for your feedback!'}
                            </div>
                        </Show>
                        <Show when={!submitSuccess()}>
                            <Button
                                onClick={handleSubmit}
                                disabled={!message().trim() || submitFeedbackMutation.isPending}
                                size="sm"
                            >
                                <Show when={submitFeedbackMutation.isPending}>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        class="size-4 animate-spin"
                                    >
                                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                    </svg>
                                </Show>
                                {submitFeedbackMutation.isPending ? 'Submitting...' : 'Submit'}
                            </Button>
                        </Show>
                    </div>

                    {/* Error message */}
                    <Show when={submitFeedbackMutation.isError}>
                        <div class="text-sm text-red-600">
                            {submitFeedbackMutation.error?.message || 'Failed to submit feedback. Please try again.'}
                        </div>
                    </Show>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}