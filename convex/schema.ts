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
  }).index("by_userId", ["userId"]),
  agents: defineTable({
    canvasId: v.id("canvases"),
    userId: v.string(),
    prompt: v.string(),
    positionX: v.number(),
    positionY: v.number(),
    width: v.number(),
    height: v.number(),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_canvas", ["canvasId"])
    .index("by_user", ["userId"]),
}); 