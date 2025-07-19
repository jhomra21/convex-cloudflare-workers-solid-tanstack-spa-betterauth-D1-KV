import { v } from "convex/values";
import { mutation, query } from "./_generated/server";



export const getImageById = query({
  args: {
    imageId: v.id("images"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.imageId);
  },
});

export const addImage = mutation({
  args: {
    imageUrl: v.string(),
    model: v.optional(v.string()),
    prompt: v.string(),
    seed: v.optional(v.number()),
    steps: v.optional(v.number()),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("images", {
      imageUrl: args.imageUrl,
      model: args.model,
      prompt: args.prompt,
      seed: args.seed,
      steps: args.steps,
      userId: args.userId,
    });
  },
});

export const deleteImage = mutation({
  args: {
    imageId: v.id("images"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.imageId);
    // Note: This doesn't delete the actual file from R2
    // That would require a separate API call
  },
});
