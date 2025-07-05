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
      viewport: v.optional(v.object({
        x: v.number(),
        y: v.number(),
        zoom: v.number(),
      })),
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
      viewport: v.optional(v.object({
        x: v.number(),
        y: v.number(),
        zoom: v.number(),
      })),
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

// Update canvas viewport (zoom and pan)
export const updateCanvasViewport = mutation({
  args: {
    canvasId: v.id("canvases"),
    viewport: v.object({
      x: v.number(),
      y: v.number(),
      zoom: v.number(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, { canvasId, viewport }) => {
    // Constrain viewport values to safe bounds
    const constrainedViewport = {
      x: viewport.x, // Allow any pan position for now
      y: viewport.y, // Allow any pan position for now
      zoom: Math.max(0.2, Math.min(2.0, viewport.zoom)), // Constrain zoom
    };
    
    await ctx.db.patch(canvasId, {
      viewport: constrainedViewport,
      updatedAt: Date.now(),
    });
    
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
    // Delete all shared access entries (clean removal)
    const sharedEntries = await ctx.db
      .query("sharedCanvases")
      .withIndex("by_original_canvas", (q) => 
        q.eq("originalCanvasId", canvasId).eq("isActive", true))
      .collect();
    
    for (const entry of sharedEntries) {
      await ctx.db.delete(entry._id);
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
    userId: v.string(),
    userName: v.string() // User's display name
  },
  returns: v.union(v.id("canvases"), v.null()),
  handler: async (ctx, { shareId, userId, userName }) => {
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
        sharedWithUserName: userName,
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
  args: { userId: v.string(), userName: v.optional(v.string()) },
  returns: v.array(v.object({
    _id: v.id("canvases"),
    name: v.string(),
    userId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    shareId: v.optional(v.string()),
    isShareable: v.optional(v.boolean()),
    sharedBy: v.string(), // Original owner's name (fallback to ID)
    joinedAt: v.number(),
  })),
  handler: async (ctx, { userId, userName }) => {
    const sharedEntries = await ctx.db
      .query("sharedCanvases")
      .withIndex("by_shared_with_user", (q) => 
        q.eq("sharedWithUserId", userId).eq("isActive", true))
      .collect();
    
    const canvases = [];
    for (const entry of sharedEntries) {
      const canvas = await ctx.db.get(entry.originalCanvasId);
      if (canvas) {
        // For the owner name, we'll use a fallback since we don't store it
        // In a full implementation, you'd want to store owner names too
        const ownerName = `User-${canvas.userId.slice(-4).toUpperCase()}`;
        
        canvases.push({
          _id: canvas._id,
          name: canvas.name,
          userId: canvas.userId,
          createdAt: canvas.createdAt,
          updatedAt: canvas.updatedAt,
          shareId: canvas.shareId,
          isShareable: canvas.isShareable,
          sharedBy: ownerName,
          joinedAt: entry.joinedAt,
        });
      }
    }
    
    return canvases;
  },
});

// Get users currently sharing a canvas (including owner)
export const getCanvasActiveUsers = query({
  args: { canvasId: v.id("canvases"), ownerName: v.optional(v.string()) },
  returns: v.array(v.object({
    userId: v.string(),
    userName: v.string(),
    joinedAt: v.number(),
    isOwner: v.boolean(),
  })),
  handler: async (ctx, { canvasId, ownerName }) => {
    // Get the canvas to find the owner
    const canvas = await ctx.db.get(canvasId);
    if (!canvas) return [];
    
    const users = [];
    
    // Add the canvas owner first
    users.push({
      userId: canvas.userId,
      userName: ownerName || `User-${canvas.userId.slice(-4).toUpperCase()}`,
      joinedAt: canvas.createdAt,
      isOwner: true,
    });
    
    // Add shared users (guests)
    const sharedEntries = await ctx.db
      .query("sharedCanvases")
      .withIndex("by_original_canvas", (q) => 
        q.eq("originalCanvasId", canvasId).eq("isActive", true))
      .collect();
    
    for (const entry of sharedEntries) {
      users.push({
        userId: entry.sharedWithUserId,
        userName: entry.sharedWithUserName,
        joinedAt: entry.joinedAt,
        isOwner: false,
      });
    }
    
    return users;
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
