import { useQuery, useMutation, useQueryClient } from '@tanstack/solid-query';
import { createStore } from 'solid-js/store';

// Note type definition
export type Note = {
  id: string;
  userId: string;
  title: string;
  content: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
};

// Input types for creating and updating notes
export type NoteInput = {
  title: string;
  content?: string;
};

export type NoteUpdateInput = {
  id: string;
  title?: string;
  content?: string;
  status?: 'active' | 'archived';
};

// API client for notes
const notesApi = {
  // Get all notes
  async getAllNotes(): Promise<Note[]> {
    const response = await fetch('/api/notes/');
    if (!response.ok) {
      throw new Error(`Failed to fetch notes: ${response.statusText}`);
    }
    const data = await response.json();
    return data.notes;
  },

  // Get a single note
  async getNote(id: string): Promise<Note> {
    const response = await fetch(`/api/notes/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch note: ${response.statusText}`);
    }
    return await response.json();
  },

  // Create a new note
  async createNote(note: NoteInput): Promise<Note> {
    // Create a plain object from the note (in case it's a store/proxy)
    const plainNote = { 
      title: note.title, 
      content: note.content || '' 
    };
    
    const response = await fetch('/api/notes/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(plainNote),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create note: ${response.statusText}`);
    }
    
    return await response.json();
  },

  // Update a note
  async updateNote(note: NoteUpdateInput): Promise<Note> {
    // Create a plain object from the note (in case it's a store/proxy)
    const plainNote = { 
      title: note.title, 
      content: note.content, 
      status: note.status 
    };
    
    const response = await fetch(`/api/notes/${note.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(plainNote),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update note: ${response.statusText}`);
    }
    
    return await response.json();
  },

  // Delete a note
  async deleteNote(id: string): Promise<void> {
    const response = await fetch(`/api/notes/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to delete note: ${response.statusText}`);
    }
  },
};

// Query hooks for notes
export function useNotes() {
  return useQuery(() => ({
    queryKey: ['notes'],
    queryFn: notesApi.getAllNotes,
    staleTime: 1000 * 60 * 5, // 5 minutes
  }));
}

export function useNote(id: string) {
  return useQuery(() => ({
    queryKey: ['notes', id],
    queryFn: () => notesApi.getNote(id),
    enabled: !!id, // Only run if ID exists
  }));
}

// Mutation hooks for notes
export function useCreateNoteMutation() {
  const queryClient = useQueryClient();
  
  return useMutation(() => ({
    mutationFn: (note: NoteInput) => notesApi.createNote(note),
    onSuccess: (newNote) => {
      // Optimistically update the notes list
      queryClient.setQueryData(['notes'], (oldData: Note[] | undefined) => {
        return oldData ? [...oldData, newNote] : [newNote];
      });
      // Invalidate the cache to trigger a refetch
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  }));
}

export function useUpdateNoteMutation() {
  const queryClient = useQueryClient();
  
  return useMutation(() => ({
    mutationFn: (note: NoteUpdateInput) => notesApi.updateNote(note),
    onMutate: async (updatedNote) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notes'] });
      await queryClient.cancelQueries({ queryKey: ['notes', updatedNote.id] });
      
      // Snapshot the previous value
      const previousNotes = queryClient.getQueryData<Note[]>(['notes']);
      const previousNote = queryClient.getQueryData<Note>(['notes', updatedNote.id]);
      
      // Optimistically update the cache
      if (previousNotes) {
        queryClient.setQueryData(['notes'], 
          previousNotes.map(note => 
            note.id === updatedNote.id 
              ? { ...note, ...updatedNote } 
              : note
          )
        );
      }
      
      if (previousNote) {
        queryClient.setQueryData(['notes', updatedNote.id], {
          ...previousNote,
          ...updatedNote,
        });
      }
      
      return { previousNotes, previousNote };
    },
    onError: (_err, _updatedNote, context: any) => {
      // If the mutation fails, use the context we saved to rollback
      if (context?.previousNotes) {
        queryClient.setQueryData(['notes'], context.previousNotes);
      }
      if (context?.previousNote) {
        queryClient.setQueryData(['notes', _updatedNote.id], context.previousNote);
      }
    },
    onSettled: (_data, _error, variables) => {
      // Always invalidate to ensure we have fresh data
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['notes', variables.id] });
    },
  }));
}

export function useDeleteNoteMutation() {
  const queryClient = useQueryClient();
  
  return useMutation(() => ({
    mutationFn: (id: string) => notesApi.deleteNote(id),
    onMutate: async (deletedId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notes'] });
      
      // Snapshot the previous value
      const previousNotes = queryClient.getQueryData<Note[]>(['notes']);
      
      // Optimistically update by removing the note
      if (previousNotes) {
        queryClient.setQueryData(
          ['notes'], 
          previousNotes.filter(note => note.id !== deletedId)
        );
      }
      
      // Remove the single note from cache
      queryClient.removeQueries({ queryKey: ['notes', deletedId] });
      
      return { previousNotes };
    },
    onError: (_err, _deletedId, context: any) => {
      // If the mutation fails, use the context we saved to rollback
      if (context?.previousNotes) {
        queryClient.setQueryData(['notes'], context.previousNotes);
      }
    },
    onSettled: () => {
      // Always invalidate to ensure we have fresh data
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  }));
}

// A convenient hook for managing note editing state
export function useNoteEditor() {
  const [note, setNote] = createStore<NoteInput | NoteUpdateInput>({
    title: '',
    content: '',
  });
  
  const resetNote = () => setNote({ title: '', content: '' });
  
  const setNoteForEditing = (existingNote: Note) => {
    setNote({
      id: existingNote.id,
      title: existingNote.title,
      content: existingNote.content,
      status: existingNote.status
    });
  };
  
  return { note, setNote, resetNote, setNoteForEditing };
} 