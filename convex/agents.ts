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
