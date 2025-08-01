import { Hono } from 'hono';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import type { Env, HonoVariables } from './types';

const videoApi = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// Helper function to update agent status
async function updateAgentStatus(
  convexUrl: string,
  agentId: string,
  status: 'idle' | 'processing' | 'success' | 'failed'
) {
  try {
    const convex = new ConvexHttpClient(convexUrl);
    await convex.mutation(api.agents.updateAgentStatus, {
      agentId: agentId as any, // Cast to handle Convex ID type
      status,
    });
    console.log(`✅ Set agent status to ${status}:`, agentId);
  } catch (error) {
    console.error(`❌ Failed to update agent status to ${status}:`, error);
  }
}

// Helper function to update both agent video and status in one call
async function updateAgentVideoAndStatus(
  convexUrl: string,
  agentId: string,
  videoUrl: string,
  status: 'success' | 'failed'
) {
  try {
    const convex = new ConvexHttpClient(convexUrl);
    await convex.mutation(api.agents.updateAgentVideo, {
      agentId: agentId as any, // Cast to handle Convex ID type
      videoUrl,
    });
    console.log(`✅ Updated agent video and status to ${status}:`, agentId);
  } catch (error) {
    console.error(`❌ Failed to update agent video and status:`, agentId, error);
  }
}

// Generate video using queue and webhooks
videoApi.post('/', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let agentId; // Declare agentId in outer scope

  try {
    const data = await c.req.json();
    const {
      prompt,
      model = 'normal',
      aspectRatio = '16:9',
      duration = '8s',
      negativePrompt,
      enhancePrompt = true,
      generateAudio = true,
      seed
    } = data;
    agentId = data.agentId; // Assign to outer scope variable

    if (!prompt) {
      return c.json({ error: 'Prompt is required' }, 400);
    }

    // Check environment bindings
    if (!c.env.FAL_KEY) {
      console.error('❌ FAL_KEY not found');
      return c.json({ error: 'FAL AI service not configured' }, 500);
    }

    if (!c.env.CONVEX_URL) {
      console.error('❌ CONVEX_URL not found');
      return c.json({ error: 'Database service not configured' }, 500);
    }

    // Get the current request URL to build webhook URL
    const url = new URL(c.req.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const webhookUrl = `${baseUrl}/api/video/webhook`;

    console.log(`🎬 Starting video generation with webhook: ${webhookUrl}`);

    // Update agent status to 'processing'
    if (agentId && c.env.CONVEX_URL) {
      await updateAgentStatus(c.env.CONVEX_URL, agentId, 'processing');
    }

    // Submit to fal.ai queue with webhook
    const falResponse = await fetch(
      `https://queue.fal.run/fal-ai/veo3/fast?fal_webhook=${encodeURIComponent(webhookUrl)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Key ${c.env.FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          aspect_ratio: aspectRatio,
          duration,
          negative_prompt: negativePrompt,
          enhance_prompt: enhancePrompt,
          generate_audio: generateAudio,
          seed: seed || undefined,
        }),
      }
    );

    if (!falResponse.ok) {
      const errorText = await falResponse.text();
      console.error('❌ FAL AI queue error:', errorText);

      // Set agent status to failed if agentId is provided
      if (agentId && c.env.CONVEX_URL) {
        await updateAgentStatus(c.env.CONVEX_URL, agentId, 'failed');
      }

      return c.json({ error: 'FAL AI video queue submission failed' }, 500);
    }

    const queueResult = await falResponse.json() as { request_id: string; gateway_request_id: string };
    console.log(`✅ Video queued with request_id: ${queueResult.request_id}`);

    // Store request_id with agent for webhook matching
    if (agentId && c.env.CONVEX_URL) {
      const convex = new ConvexHttpClient(c.env.CONVEX_URL);
      await convex.mutation(api.agents.updateAgentRequestId, {
        agentId: agentId as any,
        requestId: queueResult.request_id,
      });
    }

    return c.json({
      success: true,
      request_id: queueResult.request_id,
      status: 'processing'
    });
  } catch (error) {
    console.error('❌ Video generation error:', error);

    // Set agent status to failed if agentId is provided
    if (agentId && c.env.CONVEX_URL) {
      await updateAgentStatus(c.env.CONVEX_URL, agentId, 'failed');
    }

    return c.json({
      error: 'Failed to generate video',
      details: error.message,
      type: error.constructor.name
    }, 500);
  }
});

// Webhook endpoint to receive video results
videoApi.post('/webhook', async (c) => {
  try {
    const webhookData = await c.req.json();
    const { request_id, status, payload, error } = webhookData;

    console.log(`🎬 Webhook received for request_id: ${request_id}, status: ${status}`);

    if (!c.env.CONVEX_URL) {
      console.error('❌ CONVEX_URL not found in webhook');
      return c.json({ error: 'Database service not configured' }, 500);
    }

    // Find agent by request_id
    const convex = new ConvexHttpClient(c.env.CONVEX_URL);
    const agent = await convex.query(api.agents.getAgentByRequestId, {
      requestId: request_id
    });

    if (!agent) {
      console.error(`❌ No agent found for request_id: ${request_id}`);
      return c.json({ error: 'Agent not found' }, 404);
    }

    if (status === 'OK' && payload?.video?.url) {
      // Use fal.ai URL directly - no need to store in R2
      const videoUrl = payload.video.url;
      console.log(`✅ Video completed successfully: ${videoUrl}`);

      // Update agent with success and video URL
      await updateAgentVideoAndStatus(c.env.CONVEX_URL, agent._id, videoUrl, 'success');
    } else {
      console.error(`❌ Video failed for agent ${agent._id}:`, error || 'Unknown error');

      // Update agent with failure
      await updateAgentStatus(c.env.CONVEX_URL, agent._id, 'failed');
    }

    return c.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return c.json({
      error: 'Failed to process webhook',
      details: error.message
    }, 500);
  }
});

// Internal function for video generation (no HTTP layer, but still uses webhooks)
export async function generateVideoInternal(
  env: Env,
  userId: string,
  prompt: string,
  model: string = 'normal',
  aspectRatio: string = '16:9',
  duration: string = '8s',
  agentId?: string,
  baseUrl?: string
) {
  try {
    if (!env.FAL_KEY) {
      throw new Error('FAL AI service not configured');
    }

    if (!env.CONVEX_URL) {
      throw new Error('Database service not configured');
    }

    // We need the base URL to construct the webhook URL
    if (!baseUrl) {
      throw new Error('Base URL required for webhook construction');
    }

    const webhookUrl = `${baseUrl}/api/video/webhook`;

    // Update agent status to 'processing'
    if (agentId) {
      await updateAgentStatus(env.CONVEX_URL, agentId, 'processing');
    }

    // Submit to fal.ai queue with webhook (same as the original endpoint)
    const falResponse = await fetch(
      `https://queue.fal.run/fal-ai/veo3/fast?fal_webhook=${encodeURIComponent(webhookUrl)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Key ${env.FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          aspect_ratio: aspectRatio,
          duration,
          enhance_prompt: true,
          generate_audio: true,
        }),
      }
    );

    if (!falResponse.ok) {
      const errorText = await falResponse.text();
      console.error('❌ FAL AI queue error:', errorText);

      // Set agent status to failed if agentId is provided
      if (agentId) {
        await updateAgentStatus(env.CONVEX_URL, agentId, 'failed');
      }

      throw new Error('FAL AI video queue submission failed');
    }

    const queueResult = await falResponse.json() as { request_id: string; gateway_request_id: string };
    console.log(`✅ Video queued with request_id: ${queueResult.request_id}`);

    // Store request_id with agent for webhook matching
    if (agentId) {
      const convex = new ConvexHttpClient(env.CONVEX_URL);
      await convex.mutation(api.agents.updateAgentRequestId, {
        agentId: agentId as any,
        requestId: queueResult.request_id,
      });
    }

    return {
      success: true,
      request_id: queueResult.request_id,
      status: 'processing'
    };
  } catch (error) {
    // Update agent status to failed if provided
    if (agentId && env.CONVEX_URL) {
      await updateAgentStatus(env.CONVEX_URL, agentId, 'failed');
    }
    throw error;
  }
}

export default videoApi;
