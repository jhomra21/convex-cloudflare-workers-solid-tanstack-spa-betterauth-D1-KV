import { Hono } from 'hono';
import type { Env, HonoVariables } from './types';

const feedbackApi = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// Submit feedback
feedbackApi.post('/', async (c) => {
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const body = await c.req.json();
    const { type, message } = body;

    // Validate input
    if (!type || !['bug', 'feedback'].includes(type)) {
      return c.json({ error: 'Invalid feedback type. Must be "bug" or "feedback"' }, 400);
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return c.json({ error: 'Message is required' }, 400);
    }

    if (message.trim().length > 2000) {
      return c.json({ error: 'Message must be less than 2000 characters' }, 400);
    }

    // Generate unique ID
    const feedbackId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Insert feedback into database
    const result = await c.env.DB.prepare(`
      INSERT INTO feedback (id, userId, type, message, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 'open', ?, ?)
    `).bind(
      feedbackId,
      user.id,
      type,
      message.trim(),
      now,
      now
    ).run();

    if (!result.success) {
      console.error('Failed to insert feedback:', result.error);
      return c.json({ error: 'Failed to submit feedback' }, 500);
    }

    return c.json({
      success: true,
      feedback: {
        id: feedbackId,
        type,
        message: message.trim(),
        status: 'open',
        createdAt: now
      }
    });

  } catch (error) {
    console.error('Error submitting feedback:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get user's feedback (optional - for future use)
feedbackApi.get('/', async (c) => {
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const result = await c.env.DB.prepare(`
      SELECT id, type, message, status, createdAt, updatedAt
      FROM feedback
      WHERE userId = ?
      ORDER BY createdAt DESC
      LIMIT 50
    `).bind(user.id).all();

    return c.json({
      success: true,
      feedback: result.results
    });

  } catch (error) {
    console.error('Error fetching feedback:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get all feedback for admin/board view
feedbackApi.get('/all', async (c) => {
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const result = await c.env.DB.prepare(`
      SELECT f.id, f.type, f.message, f.status, f.createdAt, f.updatedAt,
             u.name as userName, u.email as userEmail
      FROM feedback f
      LEFT JOIN user u ON f.userId = u.id
      ORDER BY f.createdAt DESC
      LIMIT 100
    `).all();

    return c.json({
      success: true,
      feedback: result.results
    });

  } catch (error) {
    console.error('Error fetching all feedback:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default feedbackApi;