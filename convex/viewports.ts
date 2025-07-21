import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get viewport for a specific user and canvas
export const getUserViewport = query({
  args: { 
    userId: v.string(),
    canvasId: v.id("canvases")
  },
  returns: v.union(
    v.object({
      _id: v.id("viewports"),
      _creationTime: v.number(),
      userId: v.string(),
      canvasId: v.id("canvases"),
      x: v.number(),
      y: v.number(),
      zoom: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, { userId, canvasId }) => {
    return await ctx.db
      .query("viewports")
      .withIndex("by_user_canvas", (q) => q.eq("userId", userId).eq("canvasId", canvasId))
      .first();
  },
});

// Update or create viewport for user and canvas
export const updateUserViewport = mutation({
  args: {
    userId: v.string(),
    canvasId: v.id("canvases"),
    x: v.number(),
    y: v.number(),
    zoom: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { userId, canvasId, x, y, zoom }) => {
    // Constrain viewport values to safe bounds
    const constrainedViewport = {
      x, // Allow any pan position
      y, // Allow any pan position
      zoom: Math.max(0.01, Math.min(2.0, zoom)), // Constrain zoom (1% to 200%)
    };

    // Check if viewport already exists
    const existingViewport = await ctx.db
      .query("viewports")
      .withIndex("by_user_canvas", (q) => q.eq("userId", userId).eq("canvasId", canvasId))
      .first();

    if (existingViewport) {
      // Update existing viewport
      await ctx.db.patch(existingViewport._id, {
        x: constrainedViewport.x,
        y: constrainedViewport.y,
        zoom: constrainedViewport.zoom,
        updatedAt: Date.now(),
      });
    } else {
      // Create new viewport
      await ctx.db.insert("viewports", {
        userId,
        canvasId,
        x: constrainedViewport.x,
        y: constrainedViewport.y,
        zoom: constrainedViewport.zoom,
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});

// Delete viewport (cleanup when canvas is deleted)
export const deleteViewport = mutation({
  args: { 
    userId: v.string(),
    canvasId: v.id("canvases")
  },
  returns: v.null(),
  handler: async (ctx, { userId, canvasId }) => {
    const viewport = await ctx.db
      .query("viewports")
      .withIndex("by_user_canvas", (q) => q.eq("userId", userId).eq("canvasId", canvasId))
      .first();

    if (viewport) {
      await ctx.db.delete(viewport._id);
    }

    return null;
  },
});

// Delete all viewports for a canvas (when canvas is deleted)
export const deleteCanvasViewports = mutation({
  args: { canvasId: v.id("canvases") },
  returns: v.null(),
  handler: async (ctx, { canvasId }) => {
    const viewports = await ctx.db
      .query("viewports")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
      .collect();

    for (const viewport of viewports) {
      await ctx.db.delete(viewport._id);
    }

    return null;
  },
});