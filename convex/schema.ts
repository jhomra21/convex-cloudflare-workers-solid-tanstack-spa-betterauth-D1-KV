import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  images: defineTable({
    imageUrl: v.string(),
    model: v.optional(v.string()),
    prompt: v.string(),
    seed: v.optional(v.number()),
    steps: v.optional(v.number()),
    userId: v.string(),
  }).index("by_userId", ["userId"]),
  tasks: defineTable({
    isCompleted: v.boolean(),
    text: v.string(),
    userId: v.string(),
  })
    .index("by_text", ["text"])
    .index("by_userId", ["userId"]),
  canvases: defineTable({
    name: v.string(),
    userId: v.string(),
    userName: v.optional(v.string()), // Store canvas owner's display name (optional for backward compatibility)
    createdAt: v.number(),
    updatedAt: v.number(),
    shareId: v.optional(v.string()),
    isShareable: v.optional(v.boolean()),
  }).index("by_userId", ["userId"])
    .index("by_shareId", ["shareId"]),
  viewports: defineTable({
    userId: v.string(),
    canvasId: v.id("canvases"),
    x: v.number(),      // Pan X position (pixels)
    y: v.number(),      // Pan Y position (pixels) 
    zoom: v.number(),   // Zoom level (0.01 to 2.0)
    updatedAt: v.number(),
  }).index("by_user_canvas", ["userId", "canvasId"])
    .index("by_canvas", ["canvasId"]),
  agents: defineTable({
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
    status: v.union(v.literal("idle"), v.literal("processing"), v.literal("success"), v.literal("failed")),
    type: v.union(v.literal("image-generate"), v.literal("image-edit"), v.literal("voice-generate"), v.literal("video-generate")),
    connectedAgentId: v.optional(v.id("agents")),
    uploadedImageUrl: v.optional(v.string()),
    activeImageUrl: v.optional(v.string()), // For edit agents: which image to use as input (original or generated)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_canvas", ["canvasId"])
    .index("by_user", ["userId"])
    .index("by_connected_agent", ["connectedAgentId"])
    .index("by_request_id", ["requestId"]),
  sharedCanvases: defineTable({
    originalCanvasId: v.id("canvases"),
    sharedWithUserId: v.string(),
    sharedWithUserName: v.string(), // Store user's display name
    sharedByUserId: v.string(),
    joinedAt: v.number(),
    isActive: v.boolean(),
  })
    .index("by_shared_with_user", ["sharedWithUserId", "isActive"])
    .index("by_original_canvas", ["originalCanvasId", "isActive"])
    .index("by_shared_by_user", ["sharedByUserId"]),
}); 