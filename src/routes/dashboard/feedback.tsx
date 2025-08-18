import { createFileRoute } from '@tanstack/solid-router'
import { For, Show, createSignal } from 'solid-js'
import { useAllFeedbackQuery, useAdminCheckQuery, useUpdateFeedbackStatusMutation, useDeleteFeedbackMutation } from '~/lib/feedback-actions'
import { Button } from '~/components/ui/button'
import { Icon } from '~/components/ui/icon'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuItem,
} from '~/components/ui/dropdown-menu'

export const Route = createFileRoute('/dashboard/feedback')({
    beforeLoad: ({ context }) => {
        // Start admin check query early but don't block page load
        const { queryClient } = context;
        queryClient.prefetchQuery({
            queryKey: ['admin-check'],
            queryFn: async () => {
                const response = await fetch('/api/feedback/admin-check', {
                    credentials: 'include',
                });
                if (!response.ok) return { isAdmin: false };
                return response.json();
            },
            staleTime: 1000 * 60 * 10,
        }).catch(() => {
            // Ignore prefetch errors
        });
    },
    component: FeedbackBoard,
})

function FeedbackBoard() {
    const [selectedType, setSelectedType] = createSignal<'all' | 'bug' | 'feedback'>('all')
    const [selectedStatus, setSelectedStatus] = createSignal<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all')
    const [deletingItemId, setDeletingItemId] = createSignal<string | null>(null)

    const feedbackQuery = useAllFeedbackQuery()
    const adminCheckQuery = useAdminCheckQuery()
    const updateStatusMutation = useUpdateFeedbackStatusMutation()
    const deleteFeedbackMutation = useDeleteFeedbackMutation()

    const isAdmin = () => adminCheckQuery.data?.isAdmin || false

    const handleDeleteConfirm = (itemId: string) => {
        deleteFeedbackMutation.mutate(itemId)
        setDeletingItemId(null)
    }

    const handleDeleteCancel = () => {
        setDeletingItemId(null)
    }

    const filteredFeedback = () => {
        const data = feedbackQuery.data?.feedback || []
        return data.filter(item => {
            const typeMatch = selectedType() === 'all' || item.type === selectedType()
            const statusMatch = selectedStatus() === 'all' || item.status === selectedStatus()
            return typeMatch && statusMatch
        })
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return 'text-blue-600 bg-blue-50'
            case 'in_progress': return 'text-yellow-600 bg-yellow-50'
            case 'resolved': return 'text-green-600 bg-green-50'
            case 'closed': return 'text-gray-600 bg-gray-50'
            default: return 'text-gray-600 bg-gray-50'
        }
    }

    const getTypeIcon = (type: string) => {
        return type === 'bug' ? 'bug' : 'message-circle'
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <div class="space-y-6 px-2 pb-2 !pt-0">
            {/* Header */}
            <div class="flex justify-between">
                <h1 class="text-2xl font-semibold text-gray-900">Feedback Board</h1>
            </div>

            {/* Filters */}
            <div>
                <div class="flex flex-col sm:flex-row gap-6">
                    <div class="flex items-center gap-3">
                        <span class="text-sm font-medium text-gray-900 min-w-fit">Type:</span>
                        <div class="flex gap-2">
                            <Button
                                variant={selectedType() === 'all' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedType('all')}
                                class="min-w-fit"
                            >
                                All
                            </Button>
                            <Button
                                variant={selectedType() === 'bug' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedType('bug')}
                                class="gap-2 min-w-fit"
                            >
                                <Icon class="size-4" name="bug" />
                                Bugs
                            </Button>
                            <Button
                                variant={selectedType() === 'feedback' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedType('feedback')}
                                class="gap-2 min-w-fit"
                            >
                                <Icon class="size-4" name="message-circle" />
                                Feedback
                            </Button>
                        </div>
                    </div>

                    <div class="flex items-center gap-3">
                        <span class="text-sm font-medium text-gray-900 min-w-fit">Status:</span>
                        <div class="flex gap-2 flex-wrap">
                            <Button
                                variant={selectedStatus() === 'all' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedStatus('all')}
                                class="min-w-fit"
                            >
                                All
                            </Button>
                            <Button
                                variant={selectedStatus() === 'open' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedStatus('open')}
                                class="min-w-fit"
                            >
                                Open
                            </Button>
                            <Button
                                variant={selectedStatus() === 'in_progress' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedStatus('in_progress')}
                                class="min-w-fit"
                            >
                                In Progress
                            </Button>
                            <Button
                                variant={selectedStatus() === 'resolved' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedStatus('resolved')}
                                class="min-w-fit"
                            >
                                Resolved
                            </Button>
                            <Button
                                variant={selectedStatus() === 'closed' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedStatus('closed')}
                                class="min-w-fit"
                            >
                                Closed
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Loading State */}
            <Show when={feedbackQuery.isLoading}>
                <div class="flex items-center justify-center py-12">
                    <div class="flex items-center gap-2 text-gray-600">
                        <Icon class="size-5 animate-spin" name="loader-2" />
                        Loading feedback...
                    </div>
                </div>
            </Show>

            {/* Error State */}
            <Show when={feedbackQuery.isError}>
                <div class="flex items-center justify-center py-12">
                    <div class="text-center">
                        <Icon class="size-12 text-red-500 mx-auto mb-4" name="circle-x" />
                        <h3 class="text-lg font-medium text-gray-900 mb-2">Failed to load feedback</h3>
                        <p class="text-gray-600 mb-4">
                            {feedbackQuery.error?.message || 'An error occurred while loading feedback'}
                        </p>
                        <Button onClick={() => feedbackQuery.refetch()} variant="outline">
                            Try Again
                        </Button>
                    </div>
                </div>
            </Show>

            {/* Feedback List */}
            <Show when={feedbackQuery.isSuccess}>
                <div class="space-y-4">
                    <div class="flex items-center justify-between">
                        <p class="text-sm text-gray-600">
                            Showing {filteredFeedback().length} of {feedbackQuery.data?.feedback.length || 0} items
                        </p>
                        <Button
                            onClick={() => feedbackQuery.refetch()}
                            variant="outline"
                            size="sm"
                            disabled={feedbackQuery.isFetching}
                        >
                            <Show when={feedbackQuery.isFetching}>
                                <Icon class="size-4 animate-spin" name="loader-2" />
                            </Show>
                            <Show when={!feedbackQuery.isFetching}>
                                <Icon class="size-4" name="refresh-cw" />
                            </Show>
                            Refresh
                        </Button>
                    </div>

                    <Show when={filteredFeedback().length === 0}>
                        <div class="text-center py-12">
                            <Icon class="size-12 text-gray-400 mx-auto mb-4" name="message-circle" />
                            <h3 class="text-lg font-medium text-gray-900 mb-2">No feedback found</h3>
                            <p class="text-gray-600">
                                {selectedType() !== 'all' || selectedStatus() !== 'all'
                                    ? 'Try adjusting your filters to see more results.'
                                    : 'No feedback has been submitted yet.'
                                }
                            </p>
                        </div>
                    </Show>

                    <div class="grid gap-4">
                        <For each={filteredFeedback()}>
                            {(item) => (
                                <div class="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                                    <div class="flex items-start justify-between mb-4">
                                        <div class="flex items-center gap-3">
                                            <div class="flex items-center gap-2">
                                                <Icon
                                                    class={`size-5 ${item.type === 'bug' ? 'text-red-600' : 'text-blue-600'}`}
                                                    name={getTypeIcon(item.type)}
                                                />
                                                <span class="font-medium capitalize text-gray-900">
                                                    {item.type}
                                                </span>
                                            </div>
                                            <span class={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.status)}`}>
                                                {item.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <time class="text-sm text-gray-500">
                                            {formatDate(item.createdAt)}
                                        </time>
                                    </div>

                                    <div class="mb-4">
                                        <p class="text-gray-800 whitespace-pre-wrap leading-relaxed">
                                            {item.message}
                                        </p>
                                    </div>

                                    <div class="flex items-center justify-between pt-4 border-t border-gray-100">
                                        <Show when={item.userName}>
                                            <div class="flex items-center gap-2 text-sm text-gray-600">
                                                <Icon class="size-4" name="user" />
                                                <span>
                                                    {item.userName || 'Anonymous'}
                                                </span>
                                            </div>
                                        </Show>

                                        {/* Admin Controls */}
                                        <Show when={isAdmin()}>
                                            <div class="flex items-center gap-2 transition-all duration-200">
                                                {/* Status Update Dropdown */}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger
                                                        as={Button}
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={updateStatusMutation.isPending}
                                                    >
                                                        <Show when={updateStatusMutation.isPending}>
                                                            <Icon class="size-4 animate-spin" name="loader-2" />
                                                        </Show>
                                                        <Show when={!updateStatusMutation.isPending}>
                                                            <Icon class="size-4" name="edit" />
                                                        </Show>
                                                        Status
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem
                                                            onClick={() => updateStatusMutation.mutate({ id: item.id, status: 'open' })}
                                                        >
                                                            <Icon class="size-4 mr-2" name="circle" />
                                                            Open
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => updateStatusMutation.mutate({ id: item.id, status: 'in_progress' })}
                                                        >
                                                            <Icon class="size-4 mr-2" name="clock" />
                                                            In Progress
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => updateStatusMutation.mutate({ id: item.id, status: 'resolved' })}
                                                        >
                                                            <Icon class="size-4 mr-2" name="check-circle" />
                                                            Resolved
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => updateStatusMutation.mutate({ id: item.id, status: 'closed' })}
                                                        >
                                                            <Icon class="size-4 mr-2" name="circle-x" />
                                                            Closed
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>

                                                {/* Delete Button with Inline Confirmation */}
                                                <div class="flex items-center gap-2 transition-all duration-200">
                                                    <Show when={deletingItemId() !== item.id}>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setDeletingItemId(item.id)}
                                                            disabled={deleteFeedbackMutation.isPending}
                                                            class="text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200"
                                                        >
                                                            <Icon class="size-4" name="trash-2" />
                                                        </Button>
                                                    </Show>

                                                    {/* Inline Delete Confirmation */}
                                                    <Show when={deletingItemId() === item.id}>
                                                        <div class="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleDeleteConfirm(item.id)}
                                                                disabled={deleteFeedbackMutation.isPending}
                                                                class="text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200"
                                                            >
                                                                <Show when={deleteFeedbackMutation.isPending}>
                                                                    <Icon class="size-4 animate-spin" name="loader-2" />
                                                                </Show>
                                                                <Show when={!deleteFeedbackMutation.isPending}>
                                                                    <Icon class="size-4" name="check" />
                                                                </Show>
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={handleDeleteCancel}
                                                                disabled={deleteFeedbackMutation.isPending}
                                                                class="transition-all duration-200"
                                                            >
                                                                <Icon class="size-4" name="x" />
                                                            </Button>
                                                        </div>
                                                    </Show>
                                                </div>
                                            </div>
                                        </Show>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </div>
            </Show>
        </div>
    )
}