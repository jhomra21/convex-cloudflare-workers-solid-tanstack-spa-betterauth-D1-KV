import { Hono } from 'hono';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import type { Env, HonoVariables } from './types';

export const aiChatApi = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// Interface for AI intent analysis result
interface IntentAnalysisResult {
  intent: 'create_agents' | 'modify_agents' | 'general_chat';
  confidence: number;
  operations?: AgentCreationSpec[];
  response: string;
  autoGenerate: boolean;
}

interface AgentCreationSpec {
  type: 'image-generate' | 'image-edit' | 'voice-generate' | 'video-generate';
  prompt: string;
  model?: 'normal' | 'pro';
  inputSource?: {
    type: 'uploaded_file' | 'agent_connection';
    fileUrl?: string;
    sourceAgentId?: string;
  };
}

// AI Intent Analysis using Cloudflare Workers AI
async function analyzeUserIntent({
  message,
  referencedAgents = [],
  uploadedFiles = [],
  ai
}: {
  message: string;
  referencedAgents: any[];
  uploadedFiles: string[];
  ai: any;
}): Promise<IntentAnalysisResult> {
  const systemPrompt = `You are an AI assistant that helps users create and manage AI agents on a canvas.

Available agent types:
- image-generate: Creates images from text prompts (no input needed)
- image-edit: Edits existing images with prompts (needs input image)
- voice-generate: Creates speech from text (standalone)
- video-generate: Creates videos from text prompts (standalone)

Connection rules:
- Only image agents can connect to each other
- image-edit agents can connect to image-generate or other image-edit agents
- image-generate agents cannot connect to anything (they don't need input)
- voice and video agents are standalone

For bulk operations like "remove background from 5 images", create multiple image-edit agents.
For chaining like "create landscape then add fog", create connected agents.

Context:
- Referenced agents: ${JSON.stringify(referencedAgents)}
- Uploaded files: ${uploadedFiles.length} files
- User message: "${message}"`;

  try {
    const result = await ai.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'create_agents',
          description: 'Create AI agents based on user request',
          parameters: {
            type: 'object',
            required: ['intent', 'operations', 'response', 'autoGenerate'],
            properties: {
              intent: {
                type: 'string',
                enum: ['create_agents', 'modify_agents', 'general_chat'],
                description: 'The type of action to perform'
              },
              operations: {
                type: 'array',
                description: 'Array of agent creation specifications',
                items: {
                  type: 'object',
                  required: ['type', 'prompt'],
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['image-generate', 'image-edit', 'voice-generate', 'video-generate']
                    },
                    prompt: { type: 'string', description: 'The prompt for the agent' },
                    inputSource: {
                      type: 'object',
                      properties: {
                        type: { type: 'string', enum: ['uploaded_file', 'agent_connection'] },
                        fileUrl: { type: 'string' },
                        sourceAgentId: { type: 'string' }
                      }
                    },
                    model: { type: 'string', enum: ['normal', 'pro'] }
                  }
                }
              },
              response: {
                type: 'string',
                description: 'Friendly explanation of what will be done'
              },
              autoGenerate: {
                type: 'boolean',
                description: 'Whether to immediately start generation'
              }
            }
          }
        }
      }],
      temperature: 0.3, // Lower temperature for more consistent output
      max_tokens: 2048
    });

    // Extract function call result
    if (result.tool_calls && result.tool_calls.length > 0) {
      const toolCall = result.tool_calls[0];
      if (toolCall.function && toolCall.function.name === 'create_agents') {
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          return {
            intent: parsed.intent,
            confidence: 0.9,
            operations: parsed.operations || [],
            response: parsed.response,
            autoGenerate: parsed.autoGenerate || false
          };
        } catch (error) {
          console.error('Failed to parse function call arguments:', error);
        }
      }
    }

    // Fallback if function calling fails
    return {
      intent: 'general_chat',
      confidence: 0.1,
      operations: [],
      response: "I'm having trouble understanding your request. Could you please rephrase it?",
      autoGenerate: false
    };
  } catch (error) {
    console.error('AI analysis failed:', error);

    // Try fallback model
    try {
      const fallbackResult = await ai.run('@hf/nousresearch/hermes-2-pro-mistral-7b', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.3,
        max_tokens: 1024
      });

      // Simple rule-based parsing for fallback
      return parseIntentWithRules(message, uploadedFiles.length);
    } catch (fallbackError) {
      console.error('Fallback AI model also failed:', fallbackError);
      return parseIntentWithRules(message, uploadedFiles.length);
    }
  }
}

// Rule-based intent parsing as final fallback
function parseIntentWithRules(message: string, uploadedFileCount: number): IntentAnalysisResult {
  const lowerMessage = message.toLowerCase();

  // Simple keyword-based detection
  if (lowerMessage.includes('create') || lowerMessage.includes('generate') || lowerMessage.includes('make')) {
    if (lowerMessage.includes('image') || lowerMessage.includes('picture') || lowerMessage.includes('photo')) {
      return {
        intent: 'create_agents',
        confidence: 0.7,
        operations: [{
          type: 'image-generate',
          prompt: message,
          model: 'normal'
        }],
        response: "I'll create an image generator for you.",
        autoGenerate: true
      };
    }
  }

  if (lowerMessage.includes('edit') && uploadedFileCount > 0) {
    return {
      intent: 'create_agents',
      confidence: 0.7,
      operations: Array(uploadedFileCount).fill(null).map((_, i) => ({
        type: 'image-edit' as const,
        prompt: message,
        model: 'normal' as const,
        inputSource: {
          type: 'uploaded_file' as const,
          fileUrl: `uploaded-file-${i}`
        }
      })),
      response: `I'll create ${uploadedFileCount} image editing agents for your uploaded files.`,
      autoGenerate: true
    };
  }

  return {
    intent: 'general_chat',
    confidence: 0.5,
    operations: [],
    response: "I can help you create AI agents for image generation, image editing, voice generation, and video generation. What would you like to create?",
    autoGenerate: false
  };
}

// Process file uploads to R2
async function processFileUploads(files: File[], env: Env): Promise<string[]> {
  if (!files || files.length === 0) return [];

  const uploadedUrls: string[] = [];

  for (const file of files) {
    try {
      const filename = `ai-chat-uploads/${Date.now()}-${file.name}`;
      const buffer = await file.arrayBuffer();

      await env.convex_cf_workers_images_test.put(filename, buffer, {
        httpMetadata: { contentType: file.type }
      });

      // For now, use a placeholder URL - in production, this should be the actual R2 public URL
      const url = `https://pub-1d414b448981415486cf93fcfcaf636d.r2.dev/${filename}`;
      uploadedUrls.push(url);
    } catch (error) {
      console.error('Failed to upload file:', error);
    }
  }

  return uploadedUrls;
}

// Get referenced agent data from Convex
async function getReferencedAgents(agentIds: string[], convexUrl: string): Promise<any[]> {
  if (!agentIds || agentIds.length === 0) return [];

  try {
    const convex = new ConvexHttpClient(convexUrl);
    const agents = await Promise.all(
      agentIds.map(id => convex.query(api.agents.getCanvasAgents, { canvasId: id as any }))
    );
    return agents.flat().filter(Boolean);
  } catch (error) {
    console.error('Failed to get referenced agents:', error);
    return [];
  }
}

// Create agents based on AI analysis
async function createAgentsFromAnalysis(
  operations: AgentCreationSpec[],
  canvasId: string,
  userId: string,
  userName: string,
  convexUrl: string
): Promise<any[]> {
  if (!operations || operations.length === 0) return [];

  const convex = new ConvexHttpClient(convexUrl);

  // Smart positioning for multiple agents
  const baseX = 100;
  const baseY = 100;
  const stepX = 340; // Agent width + padding
  const stepY = 404; // Agent height + padding

  // Create all agents in parallel for faster response
  const agentCreationPromises = operations.map(async (operation, i) => {
    try {
      const agentId = await convex.mutation(api.agents.createAgent, {
        canvasId: canvasId as any,
        userId,
        userName,
        prompt: operation.prompt,
        type: operation.type,
        model: operation.model || 'normal',
        positionX: baseX + (i % 3) * stepX, // 3 agents per row
        positionY: baseY + Math.floor(i / 3) * stepY,
        width: operation.type === 'video-generate' ? 320 : 320,
        height: operation.type === 'video-generate' ? 450 : 384,
        uploadedImageUrl: operation.inputSource?.fileUrl,
        connectedAgentId: operation.inputSource?.sourceAgentId as any,
      });

      return agentId;
    } catch (error) {
      console.error('Failed to create agent:', error);
      return null;
    }
  });

  // Wait for all agents to be created
  const agentResults = await Promise.all(agentCreationPromises);

  // Filter out failed creations and maintain proper typing
  const createdAgents = agentResults.filter((agentId) => agentId !== null);

  return createdAgents;
}

// Update chat history in Convex
async function updateChatHistory(
  chatAgentId: string,
  userMessage: string,
  assistantResponse: string,
  convexUrl: string,
  metadata?: any
): Promise<void> {
  try {
    const convex = new ConvexHttpClient(convexUrl);
    await convex.mutation(api.agents.updateChatHistory, {
      chatAgentId: chatAgentId as any,
      messages: [
        {
          role: 'user' as const,
          content: userMessage,
          timestamp: Date.now(),
          metadata
        },
        {
          role: 'assistant' as const,
          content: assistantResponse,
          timestamp: Date.now()
        }
      ]
    });
  } catch (error) {
    console.error('Failed to update chat history:', error);
  }
}

// Main processing endpoint
aiChatApi.post('/process', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const {
      message,
      referencedAgents = [],
      uploadedFiles = [],
      chatAgentId,
      canvasId
    } = await c.req.json();

    if (!message || !chatAgentId || !canvasId) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // 1. Process file uploads to R2
    const uploadedUrls = await processFileUploads(uploadedFiles, c.env);

    // 2. Get referenced agent data from Convex
    const referencedAgentData = await getReferencedAgents(referencedAgents, c.env.CONVEX_URL);

    // 3. AI Intent Analysis using Workers AI
    const analysisResult = await analyzeUserIntent({
      message,
      referencedAgents: referencedAgentData,
      uploadedFiles: uploadedUrls,
      ai: c.env.AI
    });

    // 4. Create agents based on analysis
    const createdAgents = await createAgentsFromAnalysis(
      analysisResult.operations || [],
      canvasId,
      user.id,
      user.name || 'Unknown User',
      c.env.CONVEX_URL
    );

    // 5. Update chat history
    await updateChatHistory(
      chatAgentId,
      message,
      analysisResult.response,
      c.env.CONVEX_URL,
      {
        referencedAgents,
        uploadedFiles: uploadedUrls,
        createdAgents: createdAgents as any[]
      }
    );

    // 6. Auto-trigger media generation if enabled
    if (analysisResult.autoGenerate && createdAgents.length > 0) {
      // First, set all agents to "processing" status in parallel
      const convex = new ConvexHttpClient(c.env.CONVEX_URL);
      const statusUpdatePromises = createdAgents.map(async (agentId) => {
        try {
          await convex.mutation(api.agents.updateAgentStatus, {
            agentId: agentId as any,
            status: 'processing'
          });
        } catch (error) {
          console.error('Failed to set agent status to processing:', agentId, error);
        }
      });

      // Wait for all status updates to complete
      await Promise.all(statusUpdatePromises);

      // Then trigger generation for all agents in parallel
      const baseUrl = new URL(c.req.url).origin;
      const generationPromises = createdAgents.map(async (agentId, index) => {
        const operation = analysisResult.operations?.[index];
        if (!operation) return;

        try {
          if (operation.type === 'image-generate') {
            const response = await fetch(`${baseUrl}/api/images`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                // Forward all original headers for proper authentication
                ...Object.fromEntries(c.req.raw.headers.entries())
              },
              body: JSON.stringify({
                prompt: operation.prompt,
                model: (operation.model === 'pro')
                  ? 'fal-ai/flux-kontext-lora/text-to-image'
                  : '@cf/black-forest-labs/flux-1-schnell',
                agentId
              })
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error('Failed to trigger image generation:', errorText);
            } else {
              console.log('✅ Successfully triggered image generation for agent:', agentId);
            }
          } else if (operation.type === 'image-edit') {
            const response = await fetch(`${baseUrl}/api/images/edit`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                // Forward all original headers for proper authentication
                ...Object.fromEntries(c.req.raw.headers.entries())
              },
              body: JSON.stringify({
                prompt: operation.prompt,
                inputImageUrl: operation.inputSource?.fileUrl,
                agentId
              })
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error('Failed to trigger image edit:', errorText);
            } else {
              console.log('✅ Successfully triggered image edit for agent:', agentId);
            }
          } else if (operation.type === 'voice-generate') {
            const response = await fetch(`${baseUrl}/api/voice`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(c.req.raw.headers.entries())
              },
              body: JSON.stringify({
                prompt: operation.prompt,
                voice: 'Aurora', // Default voice, could be made configurable
                agentId
              })
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error('Failed to trigger voice generation:', errorText);
            } else {
              console.log('✅ Successfully triggered voice generation for agent:', agentId);
            }
          } else if (operation.type === 'video-generate') {
            const response = await fetch(`${baseUrl}/api/video`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(c.req.raw.headers.entries())
              },
              body: JSON.stringify({
                prompt: operation.prompt,
                agentId
              })
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error('Failed to trigger video generation:', errorText);
            } else {
              console.log('✅ Successfully triggered video generation for agent:', agentId);
            }
          }
        } catch (error) {
          console.error('Failed to trigger generation for agent:', agentId, error);
        }
      });

      // Fire all generation requests in parallel (don't wait for them to complete)
      // This allows the chat response to return immediately while generations happen in background
      // Each agent will update its status independently as generation completes
      Promise.all(generationPromises).catch(error => {
        console.error('Some generation requests failed:', error);
      });
    }

    return c.json({
      success: true,
      response: analysisResult.response,
      createdAgents,
      operations: analysisResult.operations || [],
      intent: analysisResult.intent,
      confidence: analysisResult.confidence
    });

  } catch (error) {
    console.error('AI Chat processing failed:', error);
    return c.json({
      error: 'Failed to process chat request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Status polling endpoint
aiChatApi.get('/status/:chatAgentId', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const chatAgentId = c.req.param('chatAgentId');
    const convex = new ConvexHttpClient(c.env.CONVEX_URL);

    const chatAgent = await convex.query(api.agents.getChatAgent, {
      canvasId: chatAgentId as any, // This should be the canvas ID, not agent ID
      userId: user.id
    });

    return c.json({
      success: true,
      activeOperations: chatAgent?.activeOperations || [],
      chatHistory: chatAgent?.chatHistory || []
    });
  } catch (error) {
    console.error('Failed to get chat status:', error);
    return c.json({ error: 'Failed to get status' }, 500);
  }
});

export default aiChatApi;