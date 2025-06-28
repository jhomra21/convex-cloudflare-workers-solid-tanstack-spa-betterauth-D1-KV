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
    createdAt: v.number(),
    updatedAt: v.number(),
    shareId: v.optional(v.string()),
    isShareable: v.optional(v.boolean()),
  }).index("by_userId", ["userId"])
    .index("by_shareId", ["shareId"]),
  agents: defineTable({
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
    activeImageUrl: v.optional(v.string()), // For edit agents: which image to use as input (original or generated)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_canvas", ["canvasId"])
    .index("by_user", ["userId"])
    .index("by_connected_agent", ["connectedAgentId"]),
  sharedCanvases: defineTable({
    originalCanvasId: v.id("canvases"),
    sharedWithUserId: v.string(),
    sharedByUserId: v.string(),
    joinedAt: v.number(),
    isActive: v.boolean(),
  })
    .index("by_shared_with_user", ["sharedWithUserId", "isActive"])
    .index("by_original_canvas", ["originalCanvasId", "isActive"])
    .index("by_shared_by_user", ["sharedByUserId"]),
}); 