import { Hono } from 'hono';
import type { Env, HonoVariables } from './types';

const feedbackApi = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// KV cache keys and TTL (seconds)
const FEEDBACK_ALL_CACHE_KEY = 'feedback:all';
const userCacheKey = (userId: string) => `feedback:user:${userId}`;
const FEEDBACK_CACHE_TTL = 60 * 5;

// Helper function to check if user is admin
async function isUserAdmin(c: any): Promise<boolean> {
  const user = c.get('user');

  if (!user) {
    return false;
  }

  try {
    const result = await c.env.DB.prepare(`
      SELECT email FROM user WHERE id = ?
    `).bind(user.id).first();

    // Only jhonra121@gmail.com is admin
    return result?.email === 'jhonra121@gmail.com';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

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

    // Invalidate caches (no-op if FEEDBACK_CACHE not configured)
    await Promise.all([
      c.env.FEEDBACK_CACHE?.delete(FEEDBACK_ALL_CACHE_KEY),
      c.env.FEEDBACK_CACHE?.delete(userCacheKey(user.id))
    ]);
    console.log('Caches invalidated');

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
    // Try KV cache first (if configured)
    const key = userCacheKey(user.id);
    const cached = await c.env.FEEDBACK_CACHE?.get(key);
    if (cached) {
      try {
        console.log('Cache HIT');
        return c.json(JSON.parse(cached));
      } catch {}
    }

    const result = await c.env.DB.prepare(`
      SELECT id, type, message, status, createdAt, updatedAt
      FROM feedback
      WHERE userId = ?
      ORDER BY createdAt DESC
      LIMIT 50
    `).bind(user.id).all();

    const payload = {
      success: true,
      feedback: result.results
    };
    console.log('Cache MISS');
    await c.env.FEEDBACK_CACHE?.put(key, JSON.stringify(payload), { expirationTtl: FEEDBACK_CACHE_TTL });
    console.log('Cache UPDATED');
    return c.json(payload);

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
    // Try KV cache first (if configured)
    const cached = await c.env.FEEDBACK_CACHE?.get(FEEDBACK_ALL_CACHE_KEY);
    if (cached) {
      try {
        console.log('Cache HIT');
        return c.json(JSON.parse(cached));
      } catch {}
    }

    const result = await c.env.DB.prepare(`
      SELECT f.id, f.type, f.message, f.status, f.createdAt, f.updatedAt,
             u.name as userName, u.email as userEmail
      FROM feedback f
      LEFT JOIN user u ON f.userId = u.id
      ORDER BY f.createdAt DESC
      LIMIT 100
    `).all();

    const payload = {
      success: true,
      feedback: result.results
    };
    console.log('Cache MISS');
    await c.env.FEEDBACK_CACHE?.put(FEEDBACK_ALL_CACHE_KEY, JSON.stringify(payload), { expirationTtl: FEEDBACK_CACHE_TTL });
    console.log('Cache UPDATED');
    return c.json(payload);

  } catch (error) {
    console.error('Error fetching all feedback:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Check if user is admin (non-blocking endpoint)
feedbackApi.get('/admin-check', async (c) => {
  try {
    const isAdmin = await isUserAdmin(c);
    return c.json({ isAdmin });
  } catch (error) {
    console.error('Error checking admin status:', error);
    return c.json({ isAdmin: false });
  }
});

// Update feedback status (admin only)
feedbackApi.patch('/:id/status', async (c) => {
  // Check if user is admin
  const isAdmin = await isUserAdmin(c);
  if (!isAdmin) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const feedbackId = c.req.param('id');
    const body = await c.req.json();
    const { status } = body;

    // Validate status
    if (!status || !['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      return c.json({ error: 'Invalid status. Must be one of: open, in_progress, resolved, closed' }, 400);
    }

    const now = new Date().toISOString();

    // Find owner for targeted cache invalidation
    const owner = await c.env.DB.prepare(`
      SELECT userId FROM feedback WHERE id = ?
    `).bind(feedbackId).first();
    // Update feedback status
    const result = await c.env.DB.prepare(`
      UPDATE feedback 
      SET status = ?, updatedAt = ?
      WHERE id = ?
    `).bind(status, now, feedbackId).run();

    if (!result.success) {
      console.error('Failed to update feedback status:', result.error);
      return c.json({ error: 'Failed to update feedback status' }, 500);
    }

    if (result.meta.changes === 0) {
      return c.json({ error: 'Feedback not found' }, 404);
    }

    // Invalidate caches (no-op if FEEDBACK_CACHE not configured)
    await c.env.FEEDBACK_CACHE?.delete(FEEDBACK_ALL_CACHE_KEY);
    if (owner && (owner as any).userId) {
      await c.env.FEEDBACK_CACHE?.delete(userCacheKey((owner as any).userId));
    }
    console.log('Caches invalidated');

    return c.json({
      success: true,
      feedback: {
        id: feedbackId,
        status,
        updatedAt: now
      }
    });

  } catch (error) {
    console.error('Error updating feedback status:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete feedback (admin only)
feedbackApi.delete('/:id', async (c) => {
  // Check if user is admin
  const isAdmin = await isUserAdmin(c);
  if (!isAdmin) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const feedbackId = c.req.param('id');

    // Find owner for targeted cache invalidation
    const owner = await c.env.DB.prepare(`
      SELECT userId FROM feedback WHERE id = ?
    `).bind(feedbackId).first();
    // Delete feedback
    const result = await c.env.DB.prepare(`
      DELETE FROM feedback WHERE id = ?
    `).bind(feedbackId).run();

    if (!result.success) {
      console.error('Failed to delete feedback:', result.error);
      return c.json({ error: 'Failed to delete feedback' }, 500);
    }

    if (result.meta.changes === 0) {
      return c.json({ error: 'Feedback not found' }, 404);
    }

    // Invalidate caches (no-op if FEEDBACK_CACHE not configured)
    await c.env.FEEDBACK_CACHE?.delete(FEEDBACK_ALL_CACHE_KEY);
    if (owner && (owner as any).userId) {
      await c.env.FEEDBACK_CACHE?.delete(userCacheKey((owner as any).userId));
    }
    console.log('Caches invalidated');

    return c.json({ success: true });

  } catch (error) {
    console.error('Error deleting feedback:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default feedbackApi;