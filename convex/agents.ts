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
      type: v.union(v.literal("image-generate"), v.literal("image-edit"), v.literal("voice-generate"), v.literal("video-generate"), v.literal("video-image-to-video"), v.literal("ai-chat")),
      connectedAgentId: v.optional(v.id("agents")),
      uploadedImageUrl: v.optional(v.string()),
      activeImageUrl: v.optional(v.string()),
      // AI Chat Agent specific fields
      chatHistory: v.optional(v.array(v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
        timestamp: v.number(),
        metadata: v.optional(v.object({
          referencedAgents: v.optional(v.array(v.id("agents"))),
          uploadedFiles: v.optional(v.array(v.string())),
          createdAgents: v.optional(v.array(v.id("agents")))
        }))
      }))),
      activeOperations: v.optional(v.array(v.object({
        id: v.string(),
        type: v.string(), // "create_agents", "modify_agents"
        status: v.union(v.literal("pending"), v.literal("processing"), v.literal("completed"), v.literal("failed")),
        createdAgents: v.optional(v.array(v.id("agents"))),
        error: v.optional(v.string())
      }))),
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

// Get chat history for a canvas and user
export const getChatHistory = query({
  args: { 
    canvasId: v.id("canvases"),
    userId: v.string()
  },
  returns: v.array(v.object({
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    timestamp: v.number(),
    metadata: v.optional(v.object({
      referencedAgents: v.optional(v.array(v.id("agents"))),
      uploadedFiles: v.optional(v.array(v.string())),
      createdAgents: v.optional(v.array(v.id("agents")))
    }))
  })),
  handler: async (ctx, { canvasId, userId }) => {
    // Find the chat agent for this user on this canvas
    const chatAgent = await ctx.db
      .query("agents")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
      .filter((q) => q.and(
        q.eq(q.field("type"), "ai-chat"),
        q.eq(q.field("userId"), userId)
      ))
      .first();

    return chatAgent?.chatHistory || [];
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
    type: v.optional(v.union(v.literal("image-generate"), v.literal("image-edit"), v.literal("voice-generate"), v.literal("video-generate"), v.literal("video-image-to-video"), v.literal("ai-chat"))),
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

// Delete agent (unidirectional model)
export const deleteAgent = mutation({
  args: { agentId: v.id("agents") },
  returns: v.null(),
  handler: async (ctx, { agentId }) => {
    // In the unidirectional model, we need to clean up agents that point to this agent
    const agentsConnectedToThis = await ctx.db
      .query("agents")
      .withIndex("by_connected_agent", (q) => q.eq("connectedAgentId", agentId))
      .collect();

    // Clear the connectedAgentId for any agents that were getting input from this agent
    for (const connectedAgent of agentsConnectedToThis) {
      await ctx.db.patch(connectedAgent._id, {
        connectedAgentId: undefined,
        updatedAt: Date.now(),
      });
    }

    // Finally delete the agent
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

    // Get agent types (needed for both validation and connection logic)
    const sourceType = sourceAgent.type as AgentType;
    const targetType = targetAgent.type as AgentType;

    if (!forceConnection) {
      // Validate connection rules

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
      
      // Check if target agent already has an input connection
      if (targetAgent.connectedAgentId) {
        // Target already has an input source, disconnect it first
        await ctx.db.patch(targetAgentId, {
          connectedAgentId: undefined,
          updatedAt: Date.now(),
        });
        
        // Clear the local reference
        targetAgent.connectedAgentId = undefined;
      }
    }

    // Update connections based on the unidirectional model:
    // connectedAgentId represents "what this agent gets input from"
    
    if (sourceType === 'image-generate' && targetType === 'image-edit') {
      // Generate -> Edit: Edit agent points to Generate agent as its input source
      await ctx.db.patch(targetAgentId, {
        connectedAgentId: sourceAgentId,
        updatedAt: Date.now(),
      });
    } else if (sourceType === 'image-edit' && targetType === 'image-edit') {
      // Edit -> Edit: Target edit agent points to source edit agent as its input source
      await ctx.db.patch(targetAgentId, {
        connectedAgentId: sourceAgentId,
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});

// Disconnect agents (unidirectional model)
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

    // In the unidirectional model, we simply clear the connectedAgentId
    // This agent will no longer get input from its connected agent
    await ctx.db.patch(agentId, {
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
    type: v.union(v.literal("image-generate"), v.literal("image-edit"), v.literal("voice-generate"), v.literal("video-generate"), v.literal("video-image-to-video"), v.literal("ai-chat")),
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
      type: v.union(v.literal("image-generate"), v.literal("image-edit"), v.literal("voice-generate"), v.literal("video-generate"), v.literal("video-image-to-video"), v.literal("ai-chat")),
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

// Clear all agents from canvas (excluding chat agents)
export const clearCanvasAgents = mutation({
  args: { canvasId: v.id("canvases") },
  returns: v.null(),
  handler: async (ctx, { canvasId }) => {
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
      .filter((q) => q.neq(q.field("type"), "ai-chat")) // Exclude chat agents
      .collect();

    // Since we're deleting all agents (except chat), we don't need to worry about connection cleanup
    // Just delete all non-chat agents directly
    for (const agent of agents) {
      await ctx.db.delete(agent._id);
    }
    return null;
  },
});

// Clear only user's agents from canvas (for shared canvases) - unidirectional model
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
      .filter((q) => q.and(
        q.eq(q.field("userId"), userId),
        q.neq(q.field("type"), "ai-chat") // Exclude chat agents
      ))
      .collect();

    // For each agent being deleted, clean up connections properly
    for (const agent of agents) {
      // Clean up any agents that were getting input from this agent
      const agentsConnectedToThis = await ctx.db
        .query("agents")
        .withIndex("by_connected_agent", (q) => q.eq("connectedAgentId", agent._id))
        .collect();

      for (const connectedAgent of agentsConnectedToThis) {
        await ctx.db.patch(connectedAgent._id, {
          connectedAgentId: undefined,
          updatedAt: Date.now(),
        });
      }

      // Finally delete the agent
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
      type: v.union(v.literal("image-generate"), v.literal("image-edit"), v.literal("voice-generate"), v.literal("video-generate"), v.literal("video-image-to-video"), v.literal("ai-chat")),
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

// Get agent by ID (for API validation)
export const getAgentById = query({
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
      type: v.union(v.literal("image-generate"), v.literal("image-edit"), v.literal("voice-generate"), v.literal("video-generate"), v.literal("video-image-to-video"), v.literal("ai-chat")),
      connectedAgentId: v.optional(v.id("agents")),
      uploadedImageUrl: v.optional(v.string()),
      activeImageUrl: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, { agentId }) => {
    return await ctx.db.get(agentId);
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

// AI Chat Agent specific mutations

// Get or create the single chat agent for a user on a canvas
export const createOrGetChatAgent = mutation({
  args: { 
    canvasId: v.id("canvases"), 
    userId: v.string(), 
    userName: v.string() 
  },
  returns: v.id("agents"),
  handler: async (ctx, { canvasId, userId, userName }) => {
    // Check if chat agent already exists
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
      .filter((q) => q.and(
        q.eq(q.field("type"), "ai-chat"),
        q.eq(q.field("userId"), userId)
      ))
      .unique();

    if (existing) {
      return existing._id; // Return existing chat agent
    }

    // Create new chat agent if none exists
    return await ctx.db.insert("agents", {
      canvasId,
      userId,
      userName,
      type: "ai-chat",
      prompt: "", // Chat agents don't have prompts
      status: "idle",
      model: "normal",
      chatHistory: [],
      activeOperations: [],
      // Position in bottom-right corner, out of the way
      positionX: 50,
      positionY: 50,
      width: 400,
      height: 300,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Get the chat agent for a user on a canvas
export const getChatAgent = query({
  args: { canvasId: v.id("canvases"), userId: v.string() },
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
      type: v.union(v.literal("image-generate"), v.literal("image-edit"), v.literal("voice-generate"), v.literal("video-generate"), v.literal("video-image-to-video"), v.literal("ai-chat")),
      connectedAgentId: v.optional(v.id("agents")),
      uploadedImageUrl: v.optional(v.string()),
      activeImageUrl: v.optional(v.string()),
      chatHistory: v.optional(v.array(v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
        timestamp: v.number(),
        metadata: v.optional(v.object({
          referencedAgents: v.optional(v.array(v.id("agents"))),
          uploadedFiles: v.optional(v.array(v.string())),
          createdAgents: v.optional(v.array(v.id("agents")))
        }))
      }))),
      activeOperations: v.optional(v.array(v.object({
        id: v.string(),
        type: v.string(),
        status: v.union(v.literal("pending"), v.literal("processing"), v.literal("completed"), v.literal("failed")),
        createdAgents: v.optional(v.array(v.id("agents"))),
        error: v.optional(v.string())
      }))),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, { canvasId, userId }) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
      .filter((q) => q.and(
        q.eq(q.field("type"), "ai-chat"),
        q.eq(q.field("userId"), userId)
      ))
      .unique(); // Should only return one chat agent per user per canvas
  },
});

// Update chat history for an AI chat agent
export const updateChatHistory = mutation({
  args: {
    chatAgentId: v.id("agents"),
    messages: v.array(v.object({
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      timestamp: v.number(),
      metadata: v.optional(v.object({
        referencedAgents: v.optional(v.array(v.id("agents"))),
        uploadedFiles: v.optional(v.array(v.string())),
        createdAgents: v.optional(v.array(v.id("agents")))
      }))
    })),
  },
  returns: v.null(),
  handler: async (ctx, { chatAgentId, messages }) => {
    const agent = await ctx.db.get(chatAgentId);
    if (!agent || agent.type !== "ai-chat") {
      throw new Error("Agent not found or not a chat agent");
    }

    const currentHistory = agent.chatHistory || [];
    const updatedHistory = [...currentHistory, ...messages];

    await ctx.db.patch(chatAgentId, {
      chatHistory: updatedHistory,
      updatedAt: Date.now(),
    });
    return null;
  },
});