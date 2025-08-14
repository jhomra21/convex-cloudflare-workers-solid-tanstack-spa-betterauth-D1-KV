/**
 * Agent validation middleware for Hono
 * Validates that agentId exists in Convex and belongs to the requesting user
 */

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import type { Env, HonoVariables, ValidatedAgent } from './types';

export interface AgentValidationOptions {
  /**
   * Valid agent types for this endpoint
   * If not provided, any agent type is allowed
   */
  allowedTypes?: string[];
  
  /**
   * Whether agentId is required
   * If false, validation is skipped when agentId is not provided
   */
  required?: boolean;
}

/**
 * Middleware to validate agent exists and belongs to user
 */
export function validateAgent(options: AgentValidationOptions = {}) {
  const { allowedTypes, required = true } = options;

  return async (c: { 
    get: <K extends keyof HonoVariables>(key: K) => HonoVariables[K];
    set: <K extends keyof HonoVariables>(key: K, value: HonoVariables[K]) => void;
    req: any;
    env: Env;
    json: (data: any, status?: number) => Response;
  }, next: () => Promise<void>) => {
    const user = c.get('user');
    
    // User must be authenticated
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Parse request body to get agentId
    let body;
    try {
      body = await c.req.json();
    } catch (error) {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const agentId = body.agentId;

    // Store parsed body for handlers to use
    c.set('parsedBody', body);

    // Check if agentId is required
    if (!agentId) {
      if (required) {
        return c.json({ error: 'Agent ID is required' }, 400);
      }
      // If not required and not provided, skip validation
      return await next();
    }

    // Check environment
    if (!c.env.CONVEX_URL) {
      console.error('❌ CONVEX_URL not configured');
      return c.json({ error: 'Database service not configured' }, 500);
    }

    const convex = new ConvexHttpClient(c.env.CONVEX_URL);
    let agent;

    try {
      // Try to get the agent - this will fail if agentId is not a valid Convex ID
      agent = await convex.query(api.agents.getAgentById, {
        agentId: agentId as any
      });
    } catch (error) {
      // Log security event - invalid agent ID format (likely UUID)
      console.warn('🚨 SECURITY: Invalid agent ID format', {
        userId: user.id,
        agentId,
        ip: c.req.header('cf-connecting-ip') || 'unknown',
        userAgent: c.req.header('user-agent') || 'unknown',
        endpoint: c.req.path,
        timestamp: new Date().toISOString()
      });
      
      return c.json({ error: 'Invalid agent ID format' }, 400);
    }

    // Check if agent exists
    if (!agent) {
      console.warn('🚨 SECURITY: Agent not found', {
        userId: user.id,
        agentId,
        ip: c.req.header('cf-connecting-ip') || 'unknown',
        endpoint: c.req.path,
        timestamp: new Date().toISOString()
      });
      
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Check if agent belongs to user
    if (agent.userId !== user.id) {
      console.warn('🚨 SECURITY: Agent access denied', {
        requestingUserId: user.id,
        agentOwnerId: agent.userId,
        agentId,
        ip: c.req.header('cf-connecting-ip') || 'unknown',
        endpoint: c.req.path,
        timestamp: new Date().toISOString()
      });
      
      return c.json({ error: 'Access denied' }, 403);
    }

    // Check if agent type is allowed for this endpoint
    if (allowedTypes && !allowedTypes.includes(agent.type)) {
      console.warn('🚨 SECURITY: Invalid agent type for endpoint', {
        userId: user.id,
        agentId,
        agentType: agent.type,
        allowedTypes,
        endpoint: c.req.path,
        timestamp: new Date().toISOString()
      });
      
      return c.json({ 
        error: `Invalid agent type. Expected one of: ${allowedTypes.join(', ')}, got: ${agent.type}` 
      }, 400);
    }

    console.log('✅ Agent validation passed', {
      userId: user.id,
      agentId,
      agentType: agent.type,
      endpoint: c.req.path
    });

    // Store validated agent in context for use by handlers
    c.set('validatedAgent', agent as ValidatedAgent);

    return await next();
  };
}