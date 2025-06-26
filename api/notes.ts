import { Hono } from 'hono'
import type { Env, HonoVariables } from './types';

const notesApi = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// GET all notes
notesApi.get('/', async (c) => {
    const user = c.get('user');
    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    try {
        const { results } = await c.env.DB.prepare(
            'SELECT * FROM note WHERE userId = ? ORDER BY updatedAt DESC'
        ).bind(user.id).all();

        return c.json({ notes: results });
    } catch (error) {
        console.error('Error fetching notes:', error);
        return c.json({ error: 'Failed to fetch notes' }, 500);
    }
});

// GET a single note by ID
notesApi.get('/:id', async (c) => {
    const user = c.get('user');
    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');

    try {
        const note = await c.env.DB.prepare(
            'SELECT * FROM note WHERE id = ? AND userId = ?'
        ).bind(id, user.id).first();

        if (!note) {
            return c.json({ error: 'Note not found' }, 404);
        }

        return c.json(note);
    } catch (error) {
        console.error('Error fetching note:', error);
        return c.json({ error: 'Failed to fetch note' }, 500);
    }
});

// POST to create a new note
notesApi.post('/', async (c) => {
    const user = c.get('user');
    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    try {
        const noteData = await c.req.json();
        const { title, content } = noteData;

        if (!title) {
            return c.json({ error: 'Title is required' }, 400);
        }

        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        await c.env.DB.prepare(
            'INSERT INTO note (id, userId, title, content, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(id, user.id, title, content || '', 'active', now, now).run();

        return c.json({
            id,
            userId: user.id,
            title,
            content: content || '',
            status: 'active',
            createdAt: now,
            updatedAt: now
        }, 201);
    } catch (error) {
        console.error('Error creating note:', error);
        return c.json({ error: 'Failed to create note' }, 500);
    }
});

// PUT to update a note
notesApi.put('/:id', async (c) => {
    const user = c.get('user');
    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');

    try {
        // Check if note exists and belongs to user
        const note = await c.env.DB.prepare(
            'SELECT * FROM note WHERE id = ? AND userId = ?'
        ).bind(id, user.id).first();

        if (!note) {
            return c.json({ error: 'Note not found' }, 404);
        }

        const data = await c.req.json();
        const { title, content, status } = data;
        const now = new Date().toISOString();

        await c.env.DB.prepare(
            'UPDATE note SET title = ?, content = ?, status = ?, updatedAt = ? WHERE id = ? AND userId = ?'
        ).bind(
            title || note.title,
            content !== undefined ? content : note.content,
            status || note.status,
            now,
            id,
            user.id
        ).run();

        return c.json({
            ...note,
            title: title || note.title,
            content: content !== undefined ? content : note.content,
            status: status || note.status,
            updatedAt: now
        });
    } catch (error) {
        console.error('Error updating note:', error);
        return c.json({ error: 'Failed to update note' }, 500);
    }
});

// DELETE a note
notesApi.delete('/:id', async (c) => {
    const user = c.get('user');
    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');

    try {
        // Check if note exists and belongs to user
        const note = await c.env.DB.prepare(
            'SELECT * FROM note WHERE id = ? AND userId = ?'
        ).bind(id, user.id).first();

        if (!note) {
            return c.json({ error: 'Note not found' }, 404);
        }

        await c.env.DB.prepare(
            'DELETE FROM note WHERE id = ? AND userId = ?'
        ).bind(id, user.id).run();

        return c.json({ success: true });
    } catch (error) {
        console.error('Error deleting note:', error);
        return c.json({ error: 'Failed to delete note' }, 500);
    }
});

export default notesApi; 