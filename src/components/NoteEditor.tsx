import { Show } from "solid-js";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { TextField, TextFieldInput, TextFieldLabel, TextFieldTextArea } from "~/components/ui/text-field";
import { type Note, type NoteInput, type NoteUpdateInput } from "~/lib/notes-actions";
import type { Setter } from "solid-js";

interface NoteEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  note: NoteInput | NoteUpdateInput;
  setNote: Setter<NoteInput | NoteUpdateInput>;
}

export function NoteEditor(props: NoteEditorProps) {
  const handleSave = (e: Event) => {
    e.preventDefault();
    if (!props.note.title?.trim()) {
      return;
    }
    props.onSave();
  };

  const isNew = () => !('id' in props.note);

  return (
    <Dialog open={props.isOpen} onOpenChange={props.onClose}>
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew() ? "Create New Note" : "Edit Note"}</DialogTitle>
        </DialogHeader>
        
        <form class="space-y-4" onSubmit={handleSave}>
          <TextField>
            <TextFieldLabel>Title</TextFieldLabel>
            <TextFieldInput 
              placeholder="Note title"
              value={props.note.title || ''}
              onInput={(e) => props.setNote(prev => ({ ...prev, title: e.currentTarget.value }))}
              required
              class="w-full mt-1"
            />
          </TextField>
          
          <TextField>
            <TextFieldLabel>Content</TextFieldLabel>
            <TextFieldTextArea
              placeholder="Write your note content here..."
              value={props.note.content || ''}
              onInput={(e) => props.setNote(prev => ({ ...prev, content: e.currentTarget.value }))}
              rows={6}
              class="w-full mt-1"
            />
          </TextField>

          <Show when={!isNew()}>
            <div class="flex items-center space-x-2">
              <label for="status" class="text-sm font-medium">Status:</label>
              <select
                id="status"
                value={(props.note as Note).status || 'active'}
                onChange={(e) => props.setNote(prev => ({ ...prev, status: e.currentTarget.value as 'active' | 'archived' }))}
                class="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </Show>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={props.onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="sf-compute">
              {isNew() ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 