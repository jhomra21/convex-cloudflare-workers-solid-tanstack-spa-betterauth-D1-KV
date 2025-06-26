import { Show } from "solid-js";
import { Card, CardContent, CardFooter } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Icon } from "~/components/ui/icon";
import { type Note } from "~/lib/notes-actions";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Separator } from "~/components/ui/separator";

interface NoteCardProps {
  note: Note;
  onEdit?: (note: Note) => void;
  onArchive?: (note: Note) => void;
  onDelete?: (note: Note) => void;
}

export function NoteCard(props: NoteCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatUpdatedTime = (dateString: string) => {
    const updatedDate = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - updatedDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    // If less than 24 hours, show relative time
    if (diffHours < 24) {
      if (diffHours === 0) {
        // If less than an hour, show minutes
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
      }
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    }
    
    // Otherwise show the regular date
    return formatDate(dateString);
  };

  return (
    <Card class="h-full flex flex-col transition-all duration-200 hover:shadow-md overflow-hidden bg-card/80 backdrop-blur-sm">
      <CardContent class="flex-grow pt-5 pb-3 px-5">
        <div class="flex justify-between items-start mb-3">
          <h3 class="text-lg font-medium tracking-tight text-foreground/90">
            {props.note.title}
          </h3>
          <Show when={props.note.status === "archived"}>
            <span class="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full font-medium">
              Archived
            </span>
          </Show>
        </div>
        <p class="text-sm text-muted-foreground/90 line-clamp-3 mb-4">
          {props.note.content || "No content"}
        </p>
        <div class="text-xs text-muted-foreground/70 font-medium mt-auto pt-2 border-t border-border/40 flex justify-between items-center">
          <div class="flex items-center gap-1">
            <Icon name="calendar" class="h-3.5 w-3.5" />
            <span>{formatDate(props.note.createdAt)}</span>
          </div>
          <div class="flex items-center gap-1">
            <Icon name="file-clock" class="h-3.5 w-3.5" />
            <span>{formatUpdatedTime(props.note.updatedAt)}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter class="flex items-center !pl-0 p-0">
        <Tooltip>
          <TooltipTrigger as="div" class="flex-1 h-full w-full">
            <Button
              variant="ghost"
              size="sm"
              class="w-full h-full rounded-bl-lg py-4 hover:bg-foreground/5"
              onClick={() => props.onEdit?.(props.note)}
            >
              <Icon name="gear" class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Edit Note</p>
          </TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" class="h-6" />
        <Tooltip>
          <TooltipTrigger as="div" class="flex-1 h-full w-full">
            <Button
              variant="ghost"
              size="sm"
              class="w-full h-full py-4 hover:bg-foreground/5"
              onClick={() => props.onArchive?.(props.note)}
            >
              <Show
                when={props.note.status === "active"}
                fallback={<Icon name="archive-restore" class="h-4 w-4" />}
              >
                <Icon name="archive" class="h-4 w-4" />
              </Show>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <Show
              when={props.note.status === "active"}
              fallback={<p>Unarchive Note</p>}
            >
              <p>Archive Note</p>
            </Show>
          </TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" class="h-6" />
        <Tooltip>
          <TooltipTrigger as="div" class="flex-1 h-full w-full">
            <Button
              variant="ghost"
              size="sm"
              class="w-full h-full rounded-br-lg text-destructive hover:text-destructive py-4 hover:bg-foreground/5"
              onClick={() => props.onDelete?.(props.note)}
            >
              <Icon name="x" class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete Note</p>
          </TooltipContent>
        </Tooltip>
      </CardFooter>
    </Card>
  );
}
