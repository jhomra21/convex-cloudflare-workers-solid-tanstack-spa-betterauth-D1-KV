import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getTasks = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const createTask = mutation({
  args: {
    text: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("tasks", {
      text: args.text,
      isCompleted: false,
      userId: args.userId,
    });
  },
});

export const updateTaskStatus = mutation({
  args: {
    taskId: v.id("tasks"),
    isCompleted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    await ctx.db.patch(args.taskId, { isCompleted: args.isCompleted });
  },
});

export const updateTaskText = mutation({
  args: {
    taskId: v.id("tasks"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.text.trim()) {
      throw new Error("Task text cannot be empty");
    }

    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    await ctx.db.patch(args.taskId, { text: args.text });
  },
});

export const deleteTask = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    await ctx.db.delete(args.taskId);
  },
}); 