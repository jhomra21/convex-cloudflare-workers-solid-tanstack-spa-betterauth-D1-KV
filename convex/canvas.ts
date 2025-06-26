import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get default canvas for user
export const getCanvas = query({
  args: { userId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("canvases"),
      _creationTime: v.number(),
      name: v.string(),
      userId: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("canvases")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
  },
});

// Create default canvas for user
export const createCanvas = mutation({
  args: { userId: v.string() },
  returns: v.id("canvases"),
  handler: async (ctx, { userId }) => {
    return await ctx.db.insert("canvases", {
      name: "Default Canvas",
      userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Update canvas metadata
export const updateCanvas = mutation({
  args: {
    canvasId: v.id("canvases"),
    name: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { canvasId, name }) => {
    const updates: any = {
      updatedAt: Date.now(),
    };
    
    if (name !== undefined) {
      updates.name = name;
    }
    
    await ctx.db.patch(canvasId, updates);
    return null;
  },
});

// Delete canvas and all its agents
export const deleteCanvas = mutation({
  args: { canvasId: v.id("canvases") },
  returns: v.null(),
  handler: async (ctx, { canvasId }) => {
    // First delete all agents in this canvas
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
      .collect();
    
    for (const agent of agents) {
      await ctx.db.delete(agent._id);
    }
    
    // Then delete the canvas
    await ctx.db.delete(canvasId);
    return null;
  },
});
