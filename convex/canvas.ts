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
      userName: v.optional(v.string()),
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
      userName: v.optional(v.string()),
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
  args: { userId: v.string(), userName: v.optional(v.string()) },
  returns: v.id("canvases"),
  handler: async (ctx, { userId, userName }) => {
    // Check if user already has a canvas to prevent duplicates
    const existingCanvas = await ctx.db
      .query("canvases")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    
    if (existingCanvas) {
      return existingCanvas._id; // Return existing canvas ID instead of creating duplicate
    }
    
    const canvasData: any = {
      name: "Default Canvas",
      userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (userName) {
      canvasData.userName = userName;
    }

    return await ctx.db.insert("canvases", canvasData);
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

    // Delete all viewports for this canvas
    const viewports = await ctx.db
      .query("viewports")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
      .collect();

    for (const viewport of viewports) {
      await ctx.db.delete(viewport._id);
    }

    // Then delete the canvas
    await ctx.db.delete(canvasId);
    return null;
  },
});

// Enable canvas sharing - generates shareId
export const enableCanvasSharing = mutation({
  args: { canvasId: v.id("canvases"), userName: v.optional(v.string()) },
  returns: v.string(),
  handler: async (ctx, { canvasId, userName }) => {
    const shareId = generateShareId();

    // Get current canvas to check if userName is already stored
    const canvas = await ctx.db.get(canvasId);
    if (!canvas) {
      throw new Error("Canvas not found");
    }

    const updates: any = {
      shareId,
      isShareable: true,
      updatedAt: Date.now(),
    };

    // If canvas doesn't have userName stored and we have one, add it
    if (!canvas.userName && userName) {
      updates.userName = userName;
    }

    await ctx.db.patch(canvasId, updates);

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
    userName: v.optional(v.string()) // User's display name
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
        sharedWithUserName: userName || `Unknown User`,
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
    sharedBy: v.string(), // Original owner's name
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
          sharedBy: canvas.userName || "Unknown User", // Use stored name with fallback
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

    // Add the canvas owner first - use stored userName, fallback to ownerName param, then generate fallback
    const canvasOwnerName = canvas.userName || ownerName || `User-${canvas.userId.slice(-4).toUpperCase()}`;
    users.push({
      userId: canvas.userId,
      userName: canvasOwnerName,
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
