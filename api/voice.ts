import { Hono } from 'hono';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import type { Env, HonoVariables } from './types';
import { validateAgent } from './agent-validation';

const voiceApi = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

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

// Helper function to update both agent audio and status in one call
async function updateAgentAudioAndStatus(
  convexUrl: string, 
  agentId: string, 
  audioUrl: string,
  status: 'success' | 'failed'
) {
  try {
    const convex = new ConvexHttpClient(convexUrl);
    await convex.mutation(api.agents.updateAgentAudio, {
      agentId: agentId as any, // Cast to handle Convex ID type
      audioUrl,
    });
  } catch (error) {
    console.error(`❌ Failed to update agent audio and status:`, agentId, error);
  }
}

// Generate TTS audio using queue and webhooks
voiceApi.post('/', validateAgent({ 
  allowedTypes: ['voice-generate'],
  required: true 
}), async (c) => {
  const user = c.get('user');
  const validatedAgent = c.get('validatedAgent');
  const data = c.get('parsedBody'); // Get parsed body from middleware

  let agentId; // Declare agentId in outer scope
  
  try {
    const { 
      prompt, 
      voice = "Aurora" as VoiceType,
      audioSampleUrl,
      exaggeration = 1.5,
      model = 'normal',
      cfg = 0.5,
      temperature = 0.8,
      highQualityAudio = false,
      seed = 0
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
    const webhookUrl = `${baseUrl}/api/voice/webhook`;

    // console.log(`🎤 Starting TTS generation with webhook: ${webhookUrl}`);

    // Update agent status to 'processing' and voice settings in one atomic call
    if (agentId && c.env.CONVEX_URL) {
      const convex = new ConvexHttpClient(c.env.CONVEX_URL);
      
      await convex.mutation(api.agents.startVoiceGeneration, {
        agentId: agentId as any,
        status: "processing",
        voice: audioSampleUrl ? undefined : voice, // Only save voice if not using custom audio
        audioSampleUrl: audioSampleUrl || undefined,
      });
    }

    // Submit to fal.ai queue with webhook
    const falResponse = await fetch(
      `https://queue.fal.run/resemble-ai/chatterboxhd/text-to-speech?fal_webhook=${encodeURIComponent(webhookUrl)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Key ${c.env.FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: prompt,
          voice: audioSampleUrl ? undefined : voice, // Use voice only if no custom audio
          audio_url: audioSampleUrl, // For zero-shot voice cloning
          exaggeration,
          cfg,
          temperature,
          high_quality_audio: model === 'pro' ? true : highQualityAudio,
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
      
      return c.json({ error: 'FAL AI TTS queue submission failed' }, 500);
    }

    const queueResult = await falResponse.json() as { request_id: string; gateway_request_id: string };
    console.log(`✅ TTS queued with request_id: ${queueResult.request_id} \n
                 🎤 Starting TTS generation with webhook: ${webhookUrl}`);

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
    console.error('❌ TTS generation error:', error);
    
    // Set agent status to failed if agentId is provided
    if (agentId && c.env.CONVEX_URL) {
      await updateAgentStatus(c.env.CONVEX_URL, agentId, 'failed');
    }

    return c.json({ 
      error: 'Failed to generate TTS audio', 
      details: error.message,
      type: error.constructor.name
    }, 500);
  }
});

// Webhook endpoint to receive TTS results
voiceApi.post('/webhook', async (c) => {
  try {
    const webhookData = await c.req.json();
    const { request_id, status, payload, error } = webhookData;
    
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

    if (status === 'OK' && payload?.audio?.url) {
      // Use fal.ai URL directly - no need to store in R2
      const audioUrl = payload.audio.url;
      console.log(`✅ TTS completed successfully: ${audioUrl}`);
      
      // Update agent with success and audio URL
      await updateAgentAudioAndStatus(c.env.CONVEX_URL, agent._id, audioUrl, 'success');
    } else {
      console.error(`❌ TTS failed for agent ${agent._id}:`, error || 'Unknown error');
      
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

// Define the valid voice types
type VoiceType = "Aurora" | "Blade" | "Britney" | "Carl" | "Cliff" | "Richard" | "Rico" | "Siobhan" | "Vicky";

// Internal function for voice generation (no HTTP layer, but still uses webhooks)
export async function generateVoiceInternal(
  env: Env,
  userId: string,
  prompt: string,
  voice: VoiceType = "Aurora",
  audioSampleUrl?: string,
  model: string = 'normal',
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

    const webhookUrl = `${baseUrl}/api/voice/webhook`;

    // Update agent status to 'processing' and voice settings
    if (agentId) {
      const convex = new ConvexHttpClient(env.CONVEX_URL);
      await convex.mutation(api.agents.startVoiceGeneration, {
        agentId: agentId as any,
        status: "processing",
        voice: audioSampleUrl ? undefined : voice,
        audioSampleUrl: audioSampleUrl || undefined,
      });
    }

    // Submit to fal.ai queue with webhook (same as the original endpoint)
    const falResponse = await fetch(
      `https://queue.fal.run/resemble-ai/chatterboxhd/text-to-speech?fal_webhook=${encodeURIComponent(webhookUrl)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Key ${env.FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: prompt,
          voice: audioSampleUrl ? undefined : voice,
          audio_url: audioSampleUrl,
          exaggeration: 1.5,
          cfg: 0.5,
          temperature: 0.8,
          high_quality_audio: model === 'pro',
          seed: undefined,
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
      
      throw new Error('FAL AI TTS queue submission failed');
    }

    const queueResult = await falResponse.json() as { request_id: string; gateway_request_id: string };
    console.log(`✅ TTS queued with request_id: ${queueResult.request_id}`);

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

export default voiceApi;
