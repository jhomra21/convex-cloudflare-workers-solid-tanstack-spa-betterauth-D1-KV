import { Card, CardContent, CardFooter } from '~/components/ui/card';
import { Icon } from '~/components/ui/icon';
import { Button } from '~/components/ui/button';
import { useDeleteImage } from '~/lib/images-actions';
import { toast } from 'solid-sonner';
import type { Doc } from '../../convex/_generated/dataModel';

export interface ImageCardProps {
  image: Doc<"images">;
}

export function ImageCard(props: ImageCardProps) {
  const deleteImage = useDeleteImage();

  const handleDelete = async () => {
    try {
      await deleteImage.mutateAsync(props.image._id);
      toast.success("Image deleted");
    } catch (error) {
      toast.error("Failed to delete image");
    }
  };

  const formattedDate = props.image._creationTime 
    ? new Date(props.image._creationTime).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <Card class="overflow-hidden">
      <div class="aspect-square relative group">
        <img 
          src={props.image.imageUrl} 
          alt={props.image.prompt}
          class="w-full h-full object-cover"
          loading="lazy"
        />
        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
          <Button 
            variant="outline" 
            size="icon"
            class="bg-white text-red-500 hover:bg-red-500 hover:text-white"
            onClick={handleDelete}
            disabled={deleteImage.isPending}
          >
            <Icon name={deleteImage.isPending ? "loader" : "trash-2"} class={`h-4 w-4 ${deleteImage.isPending ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
      <CardContent class="p-4">
        <p class="text-sm line-clamp-2">{props.image.prompt}</p>
      </CardContent>
      {formattedDate && (
        <CardFooter class="px-4 pb-4 pt-0 flex justify-between text-xs text-muted-foreground">
          <span>{formattedDate}</span>
          <span>{props.image.model?.split('/').pop()}</span>
        </CardFooter>
      )}
    </Card>
  );
}
