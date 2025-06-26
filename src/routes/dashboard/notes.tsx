import { createFileRoute } from '@tanstack/solid-router';
import { createSignal, For, Show } from 'solid-js';
import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { NoteCard } from '~/components/NoteCard';
import { NoteEditor } from '~/components/NoteEditor';
import { useNotes, useCreateNoteMutation, useUpdateNoteMutation, useDeleteNoteMutation, useNoteEditor, type Note } from '~/lib/notes-actions';
import { Spinner } from '../auth';
import { toast } from 'solid-sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '~/components/ui/dialog';

export function NotesPage() {
  // Query and mutations
  const notesQuery = useNotes();
  const createMutation = useCreateNoteMutation();
  const updateMutation = useUpdateNoteMutation();
  const deleteMutation = useDeleteNoteMutation();

  // Local state for UI management
  const [editorOpen, setEditorOpen] = createSignal(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = createSignal(false);
  const [noteToDelete, setNoteToDelete] = createSignal<Note | null>(null);
  const [filter, setFilter] = createSignal<'all' | 'active' | 'archived'>('all');
  
  // Editor state management
  const { note, setNote, resetNote, setNoteForEditing } = useNoteEditor();
  
  // Filtered notes
  const filteredNotes = () => {
    if (!notesQuery.data) return [];

    switch (filter()) {
      case 'active':
        return notesQuery.data.filter(note => note.status === 'active');
      case 'archived':
        return notesQuery.data.filter(note => note.status === 'archived');
      default:
        return notesQuery.data;
    }
  };

  // Handle edit note
  const handleEditNote = (noteToEdit: Note) => {
    setNoteForEditing(noteToEdit);
    setEditorOpen(true);
  };

  // Handle create new note
  const handleNewNote = () => {
    resetNote();
    setEditorOpen(true);
  };

  // Handle archive/unarchive note
  const handleArchiveNote = (noteToArchive: Note) => {
    const newStatus = noteToArchive.status === 'active' ? 'archived' : 'active';
    const actionText = newStatus === 'archived' ? 'archived' : 'unarchived';
    
    updateMutation.mutate({
      id: noteToArchive.id,
      status: newStatus,
    });
    
    toast.success(`Note "${noteToArchive.title}" ${actionText}`);
  };
  
  // Handle delete note
  const handleDeleteNote = (noteToDelete: Note) => {
    setNoteToDelete(noteToDelete);
    setDeleteDialogOpen(true);
  };
  
  // Handle confirm delete
  const confirmDelete = () => {
    if (!noteToDelete()) return;
    
    const note = noteToDelete();
    deleteMutation.mutate(note!.id);
    
    toast.success(`Note "${note!.title}" deleted`);
    setDeleteDialogOpen(false);
    setNoteToDelete(null);
  };
  
  // Save note (create or update)
  const saveNote = () => {
    if (!note.title?.trim()) {
      toast.error('Note title is required');
      return;
    }
    
    if ('id' in note) {
      // For updates, extract the plain object data from the store
      const updateData = {
        id: note.id,
        title: note.title,
        content: note.content,
        status: note.status
      };
      updateMutation.mutate(updateData);
      toast.success(`Note "${note.title}" updated`);
    } else {
      // For creation, extract the plain object data from the store
      const createData = {
        title: note.title,
        content: note.content || ''
      };
      createMutation.mutate(createData);
      toast.success(`Note "${note.title}" created`);
    }
    
    setEditorOpen(false);
    resetNote();
  };

  return (
    <div class="container mx-auto max-w-5xl px-4 py-8 min-h-screen">
      <div class="flex flex-col space-y-8">
        {/* Header */}
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-2xl font-semibold mb-1">My Notes</h1>
            <p class="text-muted-foreground text-sm">
              Create, edit and manage your notes
            </p>
          </div>
          <Button 
            variant="sf-compute" 
            onClick={handleNewNote}
            disabled={createMutation.isPending}
          >
            <Show when={!createMutation.isPending} fallback={<Spinner class="mr-2 h-4 w-4" />}>
              <Icon name="plus" class="mr-2 h-4 w-4" />
            </Show>
            New Note
          </Button>
        </div>

        {/* Filters */}
        <div class="flex items-center space-x-4">
          <Button
            variant={filter() === 'all' ? 'sf-compute' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter() === 'active' ? 'sf-compute' : 'ghost'}
            size="sm"
            onClick={() => setFilter('active')}
          >
            <Icon name="file" class="mr-2 h-4 w-4" />
            Active
          </Button>
          <Button
            variant={filter() === 'archived' ? 'sf-compute' : 'ghost'}
            size="sm"
            onClick={() => setFilter('archived')}
          >
            <Icon name="archive" class="mr-2 h-4 w-4" />
            Archived
          </Button>
        </div>

        {/* Notes grid */}
        <Show
          when={!notesQuery.isPending}
          fallback={<div class="flex justify-center py-12"><Spinner class="h-8 w-8" /></div>}
        >
          <Show
            when={notesQuery.data?.length}
            fallback={
              <div class="text-center py-12">
                <Icon name="file" class="mx-auto h-12 w-12 text-muted-foreground/60" />
                <h2 class="mt-4 text-lg font-medium">No notes found</h2>
                <p class="mt-1 text-sm text-muted-foreground">
                  Get started by creating a new note
                </p>
                <Button variant="sf-compute" class="mt-6" onClick={handleNewNote}>
                  <Icon name="plus" class="mr-2 h-4 w-4" />
                  New Note
                </Button>
              </div>
            }
          >
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <For each={filteredNotes()}>
                {note => (
                  <NoteCard
                    note={note}
                    onEdit={handleEditNote}
                    onArchive={handleArchiveNote}
                    onDelete={handleDeleteNote}
                  />
                )}
              </For>
            </div>
          </Show>
        </Show>

        {/* Note Editor Dialog */}
        <NoteEditor
          isOpen={editorOpen()}
          onClose={() => setEditorOpen(false)}
          onSave={saveNote}
          note={note}
          setNote={setNote}
        />
        
        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen()} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Note?</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the note "{noteToDelete()?.title}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                variant="sf-compute-destructive" 
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
              >
                <Show when={!deleteMutation.isPending} fallback={<Spinner class="mr-2 h-4 w-4" />}>
                  Delete
                </Show>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/dashboard/notes')({
  component: NotesPage,
}); 