import { For, createSignal, Show, onMount, onCleanup } from "solid-js";
import { createFileRoute } from "@tanstack/solid-router";
import { toast } from "solid-sonner";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { convexApi, useConvexQuery, useConvexMutation } from "~/lib/convex";
import { useCurrentUserId } from "~/lib/auth-actions";
import { Icon } from "~/components/ui/icon";
import type { Doc } from "../../../convex/_generated/dataModel";
import * as TextFieldPrimitive from "@kobalte/core/text-field";

function TasksPage() {
  const userId = useCurrentUserId();

  // Simple Convex query for tasks with real-time updates
  const tasksQuery = useConvexQuery(
    convexApi.tasks.getTasks,
    () => userId() ? { userId: userId()! } : null,
    () => ['tasks', userId()]
  );

  const tasksData = (): Doc<"tasks">[] | undefined => tasksQuery.data;

  // Mutation hooks with optimistic updates for better UX
  const createTaskMutation = useConvexMutation(convexApi.tasks.createTask, {
    optimisticUpdate: (queryClient, variables) => {
      const currentUserId = userId();
      if (!currentUserId) return;

      // Create optimistic task
      const optimisticTask = {
        _id: crypto.randomUUID() as any,
        _creationTime: Date.now(),
        text: variables.text,
        isCompleted: false,
        userId: currentUserId,
      };

      queryClient.setQueryData(['convex', 'tasks', currentUserId], (old: any) =>
        old ? [...old, optimisticTask] : [optimisticTask]
      );
    },
    invalidateQueries: [['convex', 'tasks']],
    onSuccess: () => {
      toast.success("Task created");
      setNewTaskText("");
    },
    onError: () => {
      toast.error("Failed to create task");
    }
  });

  const updateStatusMutation = useConvexMutation(convexApi.tasks.updateTaskStatus, {
    optimisticUpdate: (queryClient, variables) => {
      const currentUserId = userId();
      if (!currentUserId) return;

      queryClient.setQueryData(['convex', 'tasks', currentUserId], (old: any) =>
        old?.map((task: any) =>
          task._id === variables.taskId
            ? { ...task, isCompleted: variables.isCompleted }
            : task
        ) || []
      );
    },
    invalidateQueries: [['convex', 'tasks']],
    onSuccess: (_, variables) => {
      toast.success(`Task ${variables.isCompleted ? "completed" : "marked active"}`);
    },
    onError: () => {
      toast.error("Failed to update task");
    }
  });

  const updateTextMutation = useConvexMutation(convexApi.tasks.updateTaskText, {
    optimisticUpdate: (queryClient, variables) => {
      const currentUserId = userId();
      if (!currentUserId) return;

      queryClient.setQueryData(['convex', 'tasks', currentUserId], (old: any) =>
        old?.map((task: any) =>
          task._id === variables.taskId
            ? { ...task, text: variables.text }
            : task
        ) || []
      );
    },
    invalidateQueries: [['convex', 'tasks']],
    onSuccess: () => {
      toast.success("Task updated");
      setEditingTaskId(null);
    },
    onError: () => {
      toast.error("Failed to update task");
    }
  });

  const deleteTaskMutation = useConvexMutation(convexApi.tasks.deleteTask, {
    optimisticUpdate: (queryClient, variables) => {
      const currentUserId = userId();
      if (!currentUserId) return;

      queryClient.setQueryData(['convex', 'tasks', currentUserId], (old: any) =>
        old?.filter((task: any) => task._id !== variables.taskId) || []
      );
    },
    invalidateQueries: [['convex', 'tasks']],
    onSuccess: () => {
      toast.success("Task deleted");
      cancelDelete();
    },
    onError: () => {
      toast.error("Failed to delete task");
    }
  });

  const [newTaskText, setNewTaskText] = createSignal("");
  const [filter, setFilter] = createSignal<"all" | "completed" | "active">("all");
  const [editingTaskId, setEditingTaskId] = createSignal<string | null>(null);
  const [editText, setEditText] = createSignal("");
  const [deleteConfirmId, setDeleteConfirmId] = createSignal<string | null>(null);

  const [exitingDeleteId, setExitingDeleteId] = createSignal<string | null>(null);
  const [showDeleteButtons, setShowDeleteButtons] = createSignal<string | null>(null);

  const filteredTasks = (): Doc<"tasks">[] => {
    const tasks = tasksData();
    if (!tasks || !userId()) return [];

    switch (filter()) {
      case "completed":
        return tasks.filter((task: Doc<"tasks">) => task.isCompleted);
      case "active":
        return tasks.filter((task: Doc<"tasks">) => !task.isCompleted);
      default:
        return tasks;
    }
  };

  const addTask = async (e: Event) => {
    e.preventDefault();
    if (!newTaskText().trim()) return;
    if (!userId()) {
      toast.error("User not authenticated");
      return;
    }

    createTaskMutation.mutate({
      text: newTaskText(),
      userId: userId()!
    });
  };

  const setCompleted = async (taskId: Doc<"tasks">["_id"], isCompleted: boolean) => {
    updateStatusMutation.mutate({
      taskId,
      isCompleted
    });
  };

  const confirmDelete = (taskId: Doc<"tasks">["_id"]) => {
    setDeleteConfirmId(taskId);
    // Delay showing confirmation buttons to let edit icon fade out first
    setTimeout(() => {
      setShowDeleteButtons(taskId);
    }, 100); // Small delay to let edit icon fade out
  };

  const cancelDelete = () => {
    const currentId = deleteConfirmId();
    if (currentId) {
      setExitingDeleteId(currentId);
      setTimeout(() => {
        setDeleteConfirmId(null);
        setExitingDeleteId(null);
        setShowDeleteButtons(null);
      }, 150); // Match the exit animation duration
    }
  };

  const deleteTask = async (taskId: Doc<"tasks">["_id"]) => {
    deleteTaskMutation.mutate({ taskId });
  };

  const startEditing = (task: Doc<"tasks">) => {
    setEditingTaskId(task._id);
    setEditText(task.text);
  };

  const cancelEditing = () => {
    setEditingTaskId(null);
    setEditText("");
  };

  const saveTaskText = async (taskId: Doc<"tasks">["_id"]) => {
    const newText = editText().trim();
    if (!newText) {
      toast.error("Task text cannot be empty");
      return;
    }

    updateTextMutation.mutate({
      taskId,
      text: newText
    });
  };

  const handleKeyDown = (e: KeyboardEvent, taskId: Doc<"tasks">["_id"]) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveTaskText(taskId);
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  // Handle document-wide clicks to close delete confirmation
  onMount(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // If delete confirmation is open
      if (deleteConfirmId()) {
        // Check if the click target is outside the delete confirmation buttons
        const target = e.target as HTMLElement;
        const isClickOnDeleteConfirm = target.closest('[data-delete-confirm]');
        // Also check if this is the delete button that opens the confirmation
        const isClickOnDeleteButton = target.closest('[data-delete-button]');

        if (!isClickOnDeleteConfirm && !isClickOnDeleteButton) {
          cancelDelete();
        }
      }
    };

    // Add event listener
    document.addEventListener('click', handleClickOutside);

    // Cleanup on component unmount
    onCleanup(() => {
      document.removeEventListener('click', handleClickOutside);
    });
  });

  return (
    <div class="container mx-auto min-h-screen">
      <div class="flex flex-col space-y-8">
        {/* Header */}
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-2xl font-semibold mb-1">My Tasks</h1>
            <p class="text-muted-foreground text-sm">
              Create, manage and track your tasks
            </p>
          </div>
        </div>

        {/* Filters */}
        <div class="flex items-center space-x-4">
          <Button
            variant={filter() === "all" ? "sf-compute" : "ghost"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter() === "active" ? "sf-compute" : "ghost"}
            size="sm"
            onClick={() => setFilter("active")}
          >
            <Icon name="square-check" class="mr-2 h-4 w-4" />
            Active
          </Button>
          <Button
            variant={filter() === "completed" ? "sf-compute" : "ghost"}
            size="sm"
            onClick={() => setFilter("completed")}
          >
            <Icon name="archive" class="mr-2 h-4 w-4" />
            Completed
          </Button>
        </div>

        {/* Task Form */}
        <Card class="!border-none !shadow-none">
          <CardHeader class="!px-0">
            <CardTitle>New Task</CardTitle>
          </CardHeader>
          <form onSubmit={addTask}>
            <CardContent class="!px-0">
              <div class="flex items-center gap-2">
                <Input
                  placeholder="Add a new task..."
                  value={newTaskText()}
                  onChange={(value) => setNewTaskText(value)}
                  class="flex-grow"
                  disabled={createTaskMutation.isPending}
                />
                <Button
                  type="submit"
                  variant="sf-compute"
                  disabled={createTaskMutation.isPending || !newTaskText().trim()}
                >
                  <Icon name="plus" class="mr-2 h-4 w-4" />
                  {createTaskMutation.isPending ? "Creating..." : "Add Task"}
                </Button>
              </div>
              {createTaskMutation.error && (
                <p class="text-red-500 text-sm mt-2">
                  {createTaskMutation.error?.message}
                </p>
              )}
            </CardContent>
          </form>
        </Card>

        {/* Tasks List */}
        <Card class="!border-none !shadow-none">
          <CardContent class="!px-0">
            {/* Loading State - only show if no data available at all */}
            <Show when={!tasksData() && tasksQuery.isLoading}>
              <div class="text-center py-8 text-muted-foreground animate-in fade-in-0 duration-300">
                <Icon name="clock" class="mx-auto h-12 w-12 opacity-20 mb-2" />
                <p>Loading tasks...</p>
              </div>
            </Show>

            {/* Error State */}
            <Show when={tasksQuery.error}>
              <div class="text-center py-8 text-red-500 animate-in fade-in-0 duration-300">
                <Icon name="x" class="mx-auto h-12 w-12 opacity-20 mb-2" />
                <p class="mb-4">Failed to load tasks: {tasksQuery.error?.message}</p>
                <Button onClick={() => tasksQuery.refetch()} variant="outline">
                  <Icon name="clock" class="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            </Show>

            {/* Tasks Content - show if we have any data */}
            <Show when={tasksData()}>
              <div class="space-y-2">
                <For each={filteredTasks()} fallback={
                  <div class="text-center py-8 text-muted-foreground animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
                    <Icon name="square-check" class="mx-auto h-12 w-12 opacity-20 mb-2" />
                    <p>No tasks found. Add a task to get started.</p>
                  </div>
                }>
                  {(task: Doc<"tasks">) => (
                    <div
                      class="flex items-center justify-between rounded-md border p-3 hover:bg-muted/40 transition-all duration-200 animate-in fade-in-0 slide-in-from-top-1 duration-300 ease-out"
                      onClick={(e: MouseEvent) => {
                        // Close delete confirmation if clicking outside of delete buttons
                        if (deleteConfirmId() === task._id &&
                          showDeleteButtons() === task._id &&
                          !(e.target as HTMLElement).closest('[data-delete-confirm]') &&
                          !(e.target as HTMLElement).closest('[data-delete-button]')) {
                          cancelDelete();
                        }
                      }}
                    >
                      <div class="flex items-center gap-3 flex-grow">
                        <div class="transition-opacity duration-200 hover:opacity-80">
                          <Checkbox
                            checked={task.isCompleted}
                            onChange={(checked: boolean) => setCompleted(task._id, checked)}
                          />
                        </div>
                        <Show
                          when={editingTaskId() !== task._id}
                          fallback={
                            <div class="flex-grow flex gap-2 task-edit-enter">
                              <TextFieldPrimitive.Root value={editText()} onChange={setEditText} class="flex-grow">
                                <TextFieldPrimitive.Input
                                  class="flex h-full py-2 w-full rounded-md border border-input bg-transparent text-base shadow-sm transition-colors duration-200 file:border-0 file:bg-transparent file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                                  onKeyDown={(e: KeyboardEvent) => handleKeyDown(e, task._id)}
                                  // Focus the input when it appears
                                  ref={(el: HTMLInputElement) => setTimeout(() => el.focus(), 0)}
                                />
                              </TextFieldPrimitive.Root>
                              <Button size="sm" variant="ghost" onClick={() => saveTaskText(task._id)} class="transition-[opacity,transform] duration-200 hover:opacity-80 hover:scale-105">
                                <Icon name="check" class="h-4 w-4 text-green-500" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEditing} class="transition-[opacity,transform] duration-200 hover:opacity-80 hover:scale-105">
                                <Icon name="x" class="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          }
                        >
                          <span
                            class={task.isCompleted ? "text-muted-foreground line-through transition-all duration-300" : "cursor-pointer transition-colors duration-200 hover:text-foreground/80"}
                            onClick={() => !task.isCompleted && startEditing(task)}
                            title={!task.isCompleted ? "Click to edit" : ""}
                          >
                            {task.text}
                          </span>
                        </Show>
                      </div>
                      <Show when={editingTaskId() !== task._id}>
                        <div class="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            class={`text-muted-foreground hover:text-amber-500 transition-all duration-100 ${deleteConfirmId() === task._id ? 'opacity-0 pointer-events-none' : 'opacity-100'
                              }`}
                            onClick={() => startEditing(task)}
                            disabled={task.isCompleted}
                          >
                            <Icon name="edit" class="h-4 w-4" />
                          </Button>
                          <Show
                            when={deleteConfirmId() === task._id && showDeleteButtons() === task._id}
                            fallback={
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e: MouseEvent) => {
                                  e.stopPropagation(); // Stop propagation to prevent document click handling
                                  confirmDelete(task._id);
                                }}
                                class="text-muted-foreground hover:text-destructive transition-colors duration-200"
                                title="Delete task"
                                data-delete-button
                              >
                                <Icon name="x" class="h-4 w-4" />
                              </Button>
                            }
                          >
                            <div
                              data-delete-confirm
                              class={`flex items-center gap-1 ${exitingDeleteId() === task._id
                                ? 'task-delete-confirm-exit'
                                : 'task-delete-confirm-enter'
                                }`}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e: MouseEvent) => {
                                  e.stopPropagation(); // Stop propagation to prevent document click handling
                                  deleteTask(task._id);
                                }}
                                class="text-destructive hover:bg-destructive/10 transition-colors duration-200"
                                title="Confirm delete"
                              >
                                <Icon name="check" class="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e: MouseEvent) => {
                                  e.stopPropagation(); // Stop propagation to prevent document click handling
                                  cancelDelete();
                                }}
                                class="text-muted-foreground hover:bg-muted transition-colors duration-200"
                                title="Cancel delete"
                              >
                                <Icon name="x" class="h-4 w-4" />
                              </Button>
                            </div>
                          </Show>
                        </div>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </CardContent>
          <CardFooter class="text-sm text-muted-foreground">
            <Show when={tasksData()}>
              {filteredTasks().length} {filteredTasks().length === 1 ? "task" : "tasks"} ({tasksData()?.filter((t) => t.isCompleted).length || 0} completed)
            </Show>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/dashboard/tasks')({
  component: TasksPage,
});