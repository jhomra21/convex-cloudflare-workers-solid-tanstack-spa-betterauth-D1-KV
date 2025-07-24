import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type {
  AgentStatus,
  AgentType
} from "../src/types/agents";


// Get all agents for a canvas
export const getCanvasAgents = query({
  args: { canvasId: v.id("canvases") },
  returns: v.array(
    v.object({
      _id: v.id("agents"),
      _creationTime: v.number(),
      canvasId: v.id("canvases"),
      userId: v.string(),
      userName: v.optional(v.string()),
      prompt: v.string(),
      positionX: v.number(),
      positionY: v.number(),
      width: v.number(),
      height: v.number(),
      imageUrl: v.optional(v.string()),
      audioUrl: v.optional(v.string()),
      videoUrl: v.optional(v.string()),
      voice: v.optional(v.union(
        v.literal("Aurora"), v.literal("Blade"), v.literal("Britney"),
        v.literal("Carl"), v.literal("Cliff"), v.literal("Richard"),
        v.literal("Rico"), v.literal("Siobhan"), v.literal("Vicky")
      )),
      audioSampleUrl: v.optional(v.string()),
      requestId: v.optional(v.string()),
      model: v.union(v.literal("normal"), v.literal("pro")),
      status: v.union(v.literal("idle"), v.literal("processing"), v.literal("success"), v.literal("failed"), v.literal("deleting")),
      type: v.union(v.literal("image-generate"), v.literal("image-edit"), v.literal("voice-generate"), v.literal("video-generate")),
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
    userName: v.optional(v.string()),
    prompt: v.string(),
    positionX: v.number(),
    positionY: v.number(),
    width: v.number(),
    height: v.number(),
    model: v.optional(v.union(v.literal("normal"), v.literal("pro"))),
    type: v.optional(v.union(v.literal("image-generate"), v.literal("image-edit"), v.literal("voice-generate"), v.literal("video-generate"))),
    voice: v.optional(v.union(
      v.literal("Aurora"), v.literal("Blade"), v.literal("Britney"),
      v.literal("Carl"), v.literal("Cliff"), v.literal("Richard"),
      v.literal("Rico"), v.literal("Siobhan"), v.literal("Vicky")
    )),
    audioSampleUrl: v.optional(v.string()),
    connectedAgentId: v.optional(v.id("agents")),
    uploadedImageUrl: v.optional(v.string()),
  },
  returns: v.id("agents"),
  handler: async (ctx, args) => {
    const agentId = await ctx.db.insert("agents", {
      canvasId: args.canvasId,
      userId: args.userId,
      userName: args.userName,
      prompt: args.prompt,
      positionX: args.positionX,
      positionY: args.positionY,
      width: args.width,
      height: args.height,
      model: args.model || "normal",
      status: "idle", // All agents start as idle
      type: args.type || "image-generate",
      voice: args.voice,
      audioSampleUrl: args.audioSampleUrl,
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

// Update agent status with validation
export const updateAgentStatus = mutation({
  args: {
    agentId: v.id("agents"),
    status: v.union(v.literal("idle"), v.literal("processing"), v.literal("success"), v.literal("failed"), v.literal("deleting")),
    forceUpdate: v.optional(v.boolean()), // Allow bypassing validation in special cases
  },
  returns: v.null(),
  handler: async (ctx, { agentId, status, forceUpdate = false }) => {
    if (!forceUpdate) {
      // Get current agent to validate transition
      const currentAgent = await ctx.db.get(agentId);
      if (!currentAgent) {
        throw new Error("Agent not found");
      }

      // Import validation function (note: this is a runtime import in Convex)
      // For now, we'll implement basic validation inline
      const currentStatus = currentAgent.status as AgentStatus;

      // Basic status transition validation
      const invalidTransitions = [
        { from: 'processing', to: 'idle' }, // Cannot go from processing to idle
      ];

      const isInvalidTransition = invalidTransitions.some(
        t => t.from === currentStatus && t.to === status
      );

      if (isInvalidTransition) {
        throw new Error(`Invalid status transition from ${currentStatus} to ${status}`);
      }
    }

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

// Mark agent as deleting (for cross-client animation)
export const markAgentDeleting = mutation({
  args: { agentId: v.id("agents") },
  returns: v.null(),
  handler: async (ctx, { agentId }) => {
    await ctx.db.patch(agentId, {
      status: "deleting",
      updatedAt: Date.now(),
    });
    return null;
  },
});

// Mark multiple agents as deleting (for bulk operations)
export const markAgentsDeleting = mutation({
  args: {
    canvasId: v.id("canvases"),
    agentIds: v.optional(v.array(v.id("agents"))), // If provided, only mark these agents
    userId: v.optional(v.string()) // If provided, only mark agents owned by this user
  },
  returns: v.null(),
  handler: async (ctx, { canvasId, agentIds, userId }) => {
    let agents;

    if (agentIds) {
      // Mark specific agents
      agents = await Promise.all(
        agentIds.map(id => ctx.db.get(id))
      );
      agents = agents.filter(agent => agent !== null);
    } else {
      // Get agents from canvas
      let query = ctx.db
        .query("agents")
        .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId));

      if (userId) {
        // Filter by user
        const allAgents = await query.collect();
        agents = allAgents.filter(agent => agent.userId === userId);
      } else {
        // All agents
        agents = await query.collect();
      }
    }

    // Mark all agents as deleting in parallel
    await Promise.all(
      agents.map(agent =>
        ctx.db.patch(agent._id, {
          status: "deleting",
          updatedAt: Date.now(),
        })
      )
    );

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

// Connect two agents with validation
export const connectAgents = mutation({
  args: {
    sourceAgentId: v.id("agents"),
    targetAgentId: v.id("agents"),
    forceConnection: v.optional(v.boolean()), // Allow bypassing validation
  },
  returns: v.null(),
  handler: async (ctx, { sourceAgentId, targetAgentId, forceConnection = false }) => {
    // Verify both agents exist
    const sourceAgent = await ctx.db.get(sourceAgentId);
    const targetAgent = await ctx.db.get(targetAgentId);

    if (!sourceAgent || !targetAgent) {
      throw new Error("One or both agents not found");
    }

    // Prevent self-connection
    if (sourceAgentId === targetAgentId) {
      throw new Error("Agents cannot connect to themselves");
    }

    if (!forceConnection) {
      // Validate connection rules
      const sourceType = sourceAgent.type as AgentType;
      const targetType = targetAgent.type as AgentType;

      // Valid connection rules - be explicit about what's allowed
      const validConnections = [
        { source: 'image-generate', target: 'image-edit' }, // Generate can connect to edit (main workflow)
        { source: 'image-edit', target: 'image-edit' }, // Edit can connect to other edit (chaining)
      ];

      const isValidConnection = validConnections.some(
        rule => rule.source === sourceType && rule.target === targetType
      );

      if (!isValidConnection) {
        // Provide helpful error messages for common mistakes
        if (sourceType === 'image-edit' && targetType === 'image-generate') {
          throw new Error(`Invalid connection: Edit agents cannot connect to Generate agents. Workflow flows from Generate → Edit`);
        } else if (sourceType === 'image-generate' && targetType === 'image-generate') {
          throw new Error(`Invalid connection: Generate agents cannot connect to other Generate agents`);
        } else {
          throw new Error(`Invalid connection: ${sourceType} agents cannot connect to ${targetType} agents`);
        }
      }

      // Check if agents are already connected
      if (sourceAgent.connectedAgentId === targetAgentId ||
        targetAgent.connectedAgentId === sourceAgentId) {
        throw new Error("Agents are already connected");
      }

      // Check if agents already have other connections (for now, limit to one connection per agent)
      if (sourceAgent.connectedAgentId || targetAgent.connectedAgentId) {
        throw new Error("One or both agents are already connected to other agents");
      }
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
    type: v.union(v.literal("image-generate"), v.literal("image-edit"), v.literal("voice-generate"), v.literal("video-generate")),
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
      userName: v.optional(v.string()),
      prompt: v.string(),
      positionX: v.number(),
      positionY: v.number(),
      width: v.number(),
      height: v.number(),
      imageUrl: v.optional(v.string()),
      audioUrl: v.optional(v.string()),
      videoUrl: v.optional(v.string()),
      voice: v.optional(v.union(
        v.literal("Aurora"), v.literal("Blade"), v.literal("Britney"),
        v.literal("Carl"), v.literal("Cliff"), v.literal("Richard"),
        v.literal("Rico"), v.literal("Siobhan"), v.literal("Vicky")
      )),
      audioSampleUrl: v.optional(v.string()),
      requestId: v.optional(v.string()),
      model: v.union(v.literal("normal"), v.literal("pro")),
      status: v.union(v.literal("idle"), v.literal("processing"), v.literal("success"), v.literal("failed"), v.literal("deleting")),
      type: v.union(v.literal("image-generate"), v.literal("image-edit"), v.literal("voice-generate"), v.literal("video-generate")),
      connectedAgentId: v.optional(v.id("agents")),
      uploadedImageUrl: v.optional(v.string()),
      activeImageUrl: v.optional(v.string()),
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

// Clear only user's agents from canvas (for shared canvases)
export const clearUserAgents = mutation({
  args: {
    canvasId: v.id("canvases"),
    userId: v.string()
  },
  returns: v.null(),
  handler: async (ctx, { canvasId, userId }) => {
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    for (const agent of agents) {
      await ctx.db.delete(agent._id);
    }
    return null;
  },
});

// Update agent audio URL
export const updateAgentAudio = mutation({
  args: {
    agentId: v.id("agents"),
    audioUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { agentId, audioUrl }) => {
    await ctx.db.patch(agentId, {
      audioUrl,
      status: "success",
      updatedAt: Date.now(),
    });
    return null;
  },
});

// Update agent for voice generation start - status and voice settings in one call
export const startVoiceGeneration = mutation({
  args: {
    agentId: v.id("agents"),
    status: v.union(v.literal("idle"), v.literal("processing"), v.literal("success"), v.literal("failed"), v.literal("deleting")),
    voice: v.optional(v.union(
      v.literal("Aurora"), v.literal("Blade"), v.literal("Britney"),
      v.literal("Carl"), v.literal("Cliff"), v.literal("Richard"),
      v.literal("Rico"), v.literal("Siobhan"), v.literal("Vicky")
    )),
    audioSampleUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { agentId, status, voice, audioSampleUrl }) => {
    await ctx.db.patch(agentId, {
      status,
      voice,
      audioSampleUrl,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// Update agent request ID for webhook matching
export const updateAgentRequestId = mutation({
  args: {
    agentId: v.id("agents"),
    requestId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { agentId, requestId }) => {
    await ctx.db.patch(agentId, {
      requestId,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// Get agent by request ID (for webhook processing)
export const getAgentByRequestId = query({
  args: { requestId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("agents"),
      _creationTime: v.number(),
      canvasId: v.id("canvases"),
      userId: v.string(),
      userName: v.optional(v.string()),
      prompt: v.string(),
      positionX: v.number(),
      positionY: v.number(),
      width: v.number(),
      height: v.number(),
      imageUrl: v.optional(v.string()),
      audioUrl: v.optional(v.string()),
      videoUrl: v.optional(v.string()),
      voice: v.optional(v.union(
        v.literal("Aurora"), v.literal("Blade"), v.literal("Britney"),
        v.literal("Carl"), v.literal("Cliff"), v.literal("Richard"),
        v.literal("Rico"), v.literal("Siobhan"), v.literal("Vicky")
      )),
      audioSampleUrl: v.optional(v.string()),
      requestId: v.optional(v.string()),
      model: v.union(v.literal("normal"), v.literal("pro")),
      status: v.union(v.literal("idle"), v.literal("processing"), v.literal("success"), v.literal("failed"), v.literal("deleting")),
      type: v.union(v.literal("image-generate"), v.literal("image-edit"), v.literal("voice-generate"), v.literal("video-generate")),
      connectedAgentId: v.optional(v.id("agents")),
      uploadedImageUrl: v.optional(v.string()),
      activeImageUrl: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, { requestId }) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_request_id", (q) => q.eq("requestId", requestId))
      .unique();
  },
});

// Update agent video URL
export const updateAgentVideo = mutation({
  args: {
    agentId: v.id("agents"),
    videoUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { agentId, videoUrl }) => {
    await ctx.db.patch(agentId, {
      videoUrl,
      status: "success",
      updatedAt: Date.now(),
    });
    return null;
  },
});