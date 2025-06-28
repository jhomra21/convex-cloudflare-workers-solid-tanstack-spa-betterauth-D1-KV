import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Generate a random share ID
function generateShareId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

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
      shareId: v.optional(v.string()),
      isShareable: v.optional(v.boolean()),
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

// Get specific canvas by ID (if user has access)
export const getCanvasById = query({
  args: { 
    canvasId: v.id("canvases"),
    userId: v.string()
  },
  returns: v.union(
    v.object({
      _id: v.id("canvases"),
      _creationTime: v.number(),
      name: v.string(),
      userId: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
      shareId: v.optional(v.string()),
      isShareable: v.optional(v.boolean()),
    }),
    v.null()
  ),
  handler: async (ctx, { canvasId, userId }) => {
    const canvas = await ctx.db.get(canvasId);
    if (!canvas) return null;
    
    // Check if user has access (owner or shared)
    if (canvas.userId === userId) {
      return canvas; // User owns the canvas
    }
    
    // Check if canvas is shared with user
    const sharedAccess = await ctx.db
      .query("sharedCanvases")
      .withIndex("by_shared_with_user", (q) => 
        q.eq("sharedWithUserId", userId).eq("isActive", true))
      .filter((q) => q.eq(q.field("originalCanvasId"), canvasId))
      .first();
    
    if (sharedAccess) {
      return canvas; // User has shared access
    }
    
    return null; // No access
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

// Enable canvas sharing - generates shareId
export const enableCanvasSharing = mutation({
  args: { canvasId: v.id("canvases") },
  returns: v.string(),
  handler: async (ctx, { canvasId }) => {
    const shareId = generateShareId();
    
    await ctx.db.patch(canvasId, {
      shareId,
      isShareable: true,
      updatedAt: Date.now(),
    });
    
    return shareId;
  },
});

// Disable canvas sharing
export const disableCanvasSharing = mutation({
  args: { canvasId: v.id("canvases") },
  returns: v.null(),
  handler: async (ctx, { canvasId }) => {
    // Remove all shared access
    const sharedEntries = await ctx.db
      .query("sharedCanvases")
      .withIndex("by_original_canvas", (q) => 
        q.eq("originalCanvasId", canvasId).eq("isActive", true))
      .collect();
    
    for (const entry of sharedEntries) {
      await ctx.db.patch(entry._id, { isActive: false });
    }
    
    // Disable sharing on canvas
    await ctx.db.patch(canvasId, {
      shareId: undefined,
      isShareable: false,
      updatedAt: Date.now(),
    });
    
    return null;
  },
});

// Join a shared canvas
export const joinSharedCanvas = mutation({
  args: { 
    shareId: v.string(), 
    userId: v.string() 
  },
  returns: v.union(v.id("canvases"), v.null()),
  handler: async (ctx, { shareId, userId }) => {
    // Find canvas by shareId
    const canvas = await ctx.db
      .query("canvases")
      .withIndex("by_shareId", (q) => q.eq("shareId", shareId))
      .first();
    
    if (!canvas || !canvas.isShareable) {
      return null; // Canvas not found or not shareable
    }
    
    // Don't let owner join their own canvas
    if (canvas.userId === userId) {
      return canvas._id;
    }
    
    // Check if user already has access
    const existingShare = await ctx.db
      .query("sharedCanvases")
      .withIndex("by_shared_with_user", (q) => 
        q.eq("sharedWithUserId", userId).eq("isActive", true))
      .filter((q) => q.eq(q.field("originalCanvasId"), canvas._id))
      .first();
    
    if (!existingShare) {
      // Create new shared canvas entry
      await ctx.db.insert("sharedCanvases", {
        originalCanvasId: canvas._id,
        sharedWithUserId: userId,
        sharedByUserId: canvas.userId,
        joinedAt: Date.now(),
        isActive: true,
      });
    }
    
    return canvas._id;
  },
});

// Get canvases shared with user
export const getSharedCanvases = query({
  args: { userId: v.string() },
  returns: v.array(v.object({
    _id: v.id("canvases"),
    name: v.string(),
    userId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    shareId: v.optional(v.string()),
    isShareable: v.optional(v.boolean()),
    sharedBy: v.string(), // Original owner's userId
    joinedAt: v.number(),
  })),
  handler: async (ctx, { userId }) => {
    const sharedEntries = await ctx.db
      .query("sharedCanvases")
      .withIndex("by_shared_with_user", (q) => 
        q.eq("sharedWithUserId", userId).eq("isActive", true))
      .collect();
    
    const canvases = [];
    for (const entry of sharedEntries) {
      const canvas = await ctx.db.get(entry.originalCanvasId);
      if (canvas) {
        canvases.push({
          _id: canvas._id,
          name: canvas.name,
          userId: canvas.userId,
          createdAt: canvas.createdAt,
          updatedAt: canvas.updatedAt,
          shareId: canvas.shareId,
          isShareable: canvas.isShareable,
          sharedBy: entry.sharedByUserId,
          joinedAt: entry.joinedAt,
        });
      }
    }
    
    return canvases;
  },
});

// Get canvas by shareId (for public access info)
export const getCanvasInfoByShareId = query({
  args: { shareId: v.string() },
  returns: v.union(v.object({
    _id: v.id("canvases"),
    name: v.string(),
    userId: v.string(),
    isShareable: v.boolean(),
  }), v.null()),
  handler: async (ctx, { shareId }) => {
    const canvas = await ctx.db
      .query("canvases")
      .withIndex("by_shareId", (q) => q.eq("shareId", shareId))
      .first();
    
    if (!canvas || !canvas.isShareable) {
      return null;
    }
    
    return {
      _id: canvas._id,
      name: canvas.name,
      userId: canvas.userId,
      isShareable: canvas.isShareable,
    };
  },
});
