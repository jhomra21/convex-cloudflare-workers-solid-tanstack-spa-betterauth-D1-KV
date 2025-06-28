import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get all agents for a canvas
export const getCanvasAgents = query({
  args: { canvasId: v.id("canvases") },
  returns: v.array(
    v.object({
      _id: v.id("agents"),
      _creationTime: v.number(),
      canvasId: v.id("canvases"),
      userId: v.string(),
      prompt: v.string(),
      positionX: v.number(),
      positionY: v.number(),
      width: v.number(),
      height: v.number(),
      imageUrl: v.optional(v.string()),
      model: v.union(v.literal("normal"), v.literal("pro")),
      status: v.union(v.literal("idle"), v.literal("processing"), v.literal("success"), v.literal("failed")),
      type: v.union(v.literal("image-generate"), v.literal("image-edit")),
      connectedAgentId: v.optional(v.id("agents")),
      uploadedImageUrl: v.optional(v.string()),
      activeImageUrl: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, { canvasId }) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
      .collect();
  },
});

// Create a new agent
export const createAgent = mutation({
  args: {
    canvasId: v.id("canvases"),
    userId: v.string(),
    prompt: v.string(),
    positionX: v.number(),
    positionY: v.number(),
    width: v.number(),
    height: v.number(),
    model: v.optional(v.union(v.literal("normal"), v.literal("pro"))),
    type: v.optional(v.union(v.literal("image-generate"), v.literal("image-edit"))),
    connectedAgentId: v.optional(v.id("agents")),
    uploadedImageUrl: v.optional(v.string()),
  },
  returns: v.id("agents"),
  handler: async (ctx, args) => {
    const agentId = await ctx.db.insert("agents", {
      canvasId: args.canvasId,
      userId: args.userId,
      prompt: args.prompt,
      positionX: args.positionX,
      positionY: args.positionY,
      width: args.width,
      height: args.height,
      model: args.model || "normal",
      status: "idle",
      type: args.type || "image-generate",
      connectedAgentId: args.connectedAgentId,
      uploadedImageUrl: args.uploadedImageUrl,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    return agentId;
  },
});

// Update agent position and size
export const updateAgentTransform = mutation({
  args: {
    agentId: v.id("agents"),
    positionX: v.number(),
    positionY: v.number(),
    width: v.number(),
    height: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { agentId, positionX, positionY, width, height }) => {
    await ctx.db.patch(agentId, {
      positionX,
      positionY,
      width,
      height,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// Update agent prompt
export const updateAgentPrompt = mutation({
  args: {
    agentId: v.id("agents"),
    prompt: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { agentId, prompt }) => {
    await ctx.db.patch(agentId, {
      prompt,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// Update agent image
export const updateAgentImage = mutation({
  args: {
    agentId: v.id("agents"),
    imageUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { agentId, imageUrl }) => {
    await ctx.db.patch(agentId, {
      imageUrl,
      status: "success",
      updatedAt: Date.now(),
    });
    return null;
  },
});

// Update agent status
export const updateAgentStatus = mutation({
  args: {
    agentId: v.id("agents"),
    status: v.union(v.literal("idle"), v.literal("processing"), v.literal("success"), v.literal("failed")),
  },
  returns: v.null(),
  handler: async (ctx, { agentId, status }) => {
    await ctx.db.patch(agentId, {
      status,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// Update agent model
export const updateAgentModel = mutation({
  args: {
    agentId: v.id("agents"),
    model: v.union(v.literal("normal"), v.literal("pro")),
  },
  returns: v.null(),
  handler: async (ctx, { agentId, model }) => {
    await ctx.db.patch(agentId, {
      model,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// Delete agent
export const deleteAgent = mutation({
  args: { agentId: v.id("agents") },
  returns: v.null(),
  handler: async (ctx, { agentId }) => {
    await ctx.db.delete(agentId);
    return null;
  },
});

// Connect two agents
export const connectAgents = mutation({
  args: {
    sourceAgentId: v.id("agents"),
    targetAgentId: v.id("agents"),
  },
  returns: v.null(),
  handler: async (ctx, { sourceAgentId, targetAgentId }) => {
    // Verify both agents exist
    const sourceAgent = await ctx.db.get(sourceAgentId);
    const targetAgent = await ctx.db.get(targetAgentId);
    
    if (!sourceAgent || !targetAgent) {
      throw new Error("One or both agents not found");
    }
    
    // Update both agents to reference each other
    await ctx.db.patch(sourceAgentId, {
      connectedAgentId: targetAgentId,
      updatedAt: Date.now(),
    });
    
    await ctx.db.patch(targetAgentId, {
      connectedAgentId: sourceAgentId,
      updatedAt: Date.now(),
    });
    
    return null;
  },
});

// Disconnect agents
export const disconnectAgents = mutation({
  args: {
    agentId: v.id("agents"),
  },
  returns: v.null(),
  handler: async (ctx, { agentId }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent || !agent.connectedAgentId) {
      return null;
    }
    
    // Remove connection from both agents
    await ctx.db.patch(agentId, {
      connectedAgentId: undefined,
      updatedAt: Date.now(),
    });
    
    await ctx.db.patch(agent.connectedAgentId, {
      connectedAgentId: undefined,
      updatedAt: Date.now(),
    });
    
    return null;
  },
});

// Update agent type
export const updateAgentType = mutation({
  args: {
    agentId: v.id("agents"),
    type: v.union(v.literal("image-generate"), v.literal("image-edit")),
  },
  returns: v.null(),
  handler: async (ctx, { agentId, type }) => {
    await ctx.db.patch(agentId, {
      type,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// Update agent uploaded image
export const updateAgentUploadedImage = mutation({
  args: {
    agentId: v.id("agents"),
    uploadedImageUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { agentId, uploadedImageUrl }) => {
    await ctx.db.patch(agentId, {
      uploadedImageUrl,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// Update the active image URL for an edit agent
export const updateAgentActiveImage = mutation({
  args: {
    agentId: v.id("agents"),
    activeImageUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { agentId, activeImageUrl }) => {
    await ctx.db.patch(agentId, {
      activeImageUrl,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// Get connected agent for an agent
export const getConnectedAgent = query({
  args: { agentId: v.id("agents") },
  returns: v.union(
    v.object({
      _id: v.id("agents"),
      _creationTime: v.number(),
      canvasId: v.id("canvases"),
      userId: v.string(),
      prompt: v.string(),
      positionX: v.number(),
      positionY: v.number(),
      width: v.number(),
      height: v.number(),
      imageUrl: v.optional(v.string()),
      model: v.union(v.literal("normal"), v.literal("pro")),
      status: v.union(v.literal("idle"), v.literal("processing"), v.literal("success"), v.literal("failed")),
      type: v.union(v.literal("image-generate"), v.literal("image-edit")),
      connectedAgentId: v.optional(v.id("agents")),
      uploadedImageUrl: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, { agentId }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent || !agent.connectedAgentId) {
      return null;
    }
    
    return await ctx.db.get(agent.connectedAgentId);
  },
});

// Clear all agents from canvas
export const clearCanvasAgents = mutation({
  args: { canvasId: v.id("canvases") },
  returns: v.null(),
  handler: async (ctx, { canvasId }) => {
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
      .collect();
    
    for (const agent of agents) {
      await ctx.db.delete(agent._id);
    }
    return null;
  },
});
