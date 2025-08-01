import { Hono } from 'hono';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import type { Env, HonoVariables } from './types';

// Import internal generation functions
import { generateImageInternal, editImageInternal } from './images';
import { generateVoiceInternal } from './voice';
import { generateVideoInternal } from './video';

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

Context handling:
- When users reference existing agents, create image-edit agents that connect to those agents
- When users upload images, create image-edit agents with those uploaded images
- For bulk operations like "remove background from 5 images", create multiple image-edit agents
- For chaining like "create landscape then add fog", create connected agents

Current context:
- Referenced agents: ${JSON.stringify(referencedAgents)} (${referencedAgents.length} agents)
- Uploaded files: ${uploadedFiles.length} files${uploadedFiles.length > 0 ? `\n- Uploaded file URLs: ${JSON.stringify(uploadedFiles)}` : ''}
- User message: "${message}"

If the user has referenced agents or uploaded files, prioritize creating image-edit agents that work with this context.
When creating image-edit agents for uploaded files, use the exact URLs provided in the uploaded file URLs list.`;

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
                        fileUrl: { type: 'string', description: 'For uploaded_file type, use the exact URL from the uploaded file URLs list provided in context' },
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

    // Skip fallback AI model and go directly to rule-based parsing
    // This avoids additional AI quota usage when the service is having issues
    console.log('Falling back to rule-based intent parsing due to AI service issues');
    return parseIntentWithRules(message, uploadedFiles.length, referencedAgents.length, uploadedFiles, referencedAgents.map(agent => agent._id));
  }
}

// Rule-based intent parsing as final fallback
function parseIntentWithRules(message: string, uploadedFileCount: number, referencedAgentCount: number = 0, uploadedFileUrls: string[] = [], referencedAgentIds: string[] = []): IntentAnalysisResult {
  const lowerMessage = message.toLowerCase();

  // Handle uploaded files - create edit agents
  if (uploadedFileCount > 0) {
    return {
      intent: 'create_agents',
      confidence: 0.8,
      operations: Array(uploadedFileCount).fill(null).map((_, i) => ({
        type: 'image-edit' as const,
        prompt: message,
        model: 'normal' as const,
        inputSource: {
          type: 'uploaded_file' as const,
          fileUrl: uploadedFileUrls[i] || `uploaded-file-${i}`
        }
      })),
      response: `I'll create ${uploadedFileCount} image editing agent(s) to process your uploaded images with the prompt: "${message}"`,
      autoGenerate: true
    };
  }

  // Handle referenced agents - create edit agents that connect to them
  if (referencedAgentCount > 0) {
    return {
      intent: 'create_agents',
      confidence: 0.8,
      operations: Array(referencedAgentCount).fill(null).map((_, i) => ({
        type: 'image-edit' as const,
        prompt: message,
        model: 'normal' as const,
        inputSource: {
          type: 'agent_connection' as const,
          sourceAgentId: referencedAgentIds[i] || `referenced-agent-${i}` // Use actual agent ID if available
        }
      })),
      response: `I'll create ${referencedAgentCount} image editing agent(s) to modify your referenced agents with: "${message}"`,
      autoGenerate: true
    };
  }

  // Enhanced keyword-based detection for new agents
  const imageKeywords = ['image', 'picture', 'photo', 'drawing', 'artwork', 'visual', 'graphic'];
  const voiceKeywords = ['voice', 'speech', 'audio', 'sound', 'speak', 'say', 'talk'];
  const videoKeywords = ['video', 'movie', 'clip', 'animation', 'motion'];
  const createKeywords = ['create', 'generate', 'make', 'build', 'produce', 'design'];
  const editKeywords = ['edit', 'modify', 'change', 'alter', 'adjust', 'transform', 'convert'];

  const hasCreateKeyword = createKeywords.some(keyword => lowerMessage.includes(keyword));
  const hasEditKeyword = editKeywords.some(keyword => lowerMessage.includes(keyword));
  const hasImageKeyword = imageKeywords.some(keyword => lowerMessage.includes(keyword));
  const hasVoiceKeyword = voiceKeywords.some(keyword => lowerMessage.includes(keyword));
  const hasVideoKeyword = videoKeywords.some(keyword => lowerMessage.includes(keyword));

  // Determine agent type based on keywords
  if (hasCreateKeyword || hasEditKeyword) {
    if (hasImageKeyword) {
      return {
        intent: 'create_agents',
        confidence: 0.7,
        operations: [{
          type: 'image-generate',
          prompt: message,
          model: 'normal'
        }],
        response: `I'll create an image generation agent for: "${message}"`,
        autoGenerate: true
      };
    } else if (hasVoiceKeyword) {
      return {
        intent: 'create_agents',
        confidence: 0.7,
        operations: [{
          type: 'voice-generate',
          prompt: message,
          model: 'normal'
        }],
        response: `I'll create a voice generation agent for: "${message}"`,
        autoGenerate: true
      };
    } else if (hasVideoKeyword) {
      return {
        intent: 'create_agents',
        confidence: 0.7,
        operations: [{
          type: 'video-generate',
          prompt: message,
          model: 'normal'
        }],
        response: `I'll create a video generation agent for: "${message}"`,
        autoGenerate: true
      };
    } else {
      // Default to image if no specific type is mentioned
      return {
        intent: 'create_agents',
        confidence: 0.6,
        operations: [{
          type: 'image-generate',
          prompt: message,
          model: 'normal'
        }],
        response: `I'll create an image generation agent for: "${message}"`,
        autoGenerate: true
      };
    }
  }

  return {
    intent: 'general_chat',
    confidence: 0.5,
    operations: [],
    response: "I can help you create AI agents for image generation, image editing, voice generation, and video generation. You can also reference existing agents or upload images to create editing agents. What would you like to create?",
    autoGenerate: false
  };
}

// Check if a file is already a public URL that doesn't need re-uploading
function isPublicUrl(filename: string): boolean {
  const publicDomains = [
    'pub-1d414b448981415486cf93fcfcaf636d.r2.dev', // Our R2 bucket
    'fal.media', // FAL AI generated images
    'storage.googleapis.com', // Google Cloud Storage
    'amazonaws.com', // AWS S3
    'cloudflare.com', // Cloudflare domains
    'cdn.', // Common CDN patterns
  ];

  try {
    const url = new URL(filename);
    return publicDomains.some(domain => url.hostname.includes(domain));
  } catch {
    // If it's not a valid URL, it's probably a filename that needs uploading
    return false;
  }
}

// Process file uploads to R2
async function processFileUploads(files: File[], env: Env): Promise<string[]> {
  if (!files || files.length === 0) return [];

  const uploadedUrls: string[] = [];

  for (const file of files) {
    try {
      // Check if the file name is already a public URL
      if (isPublicUrl(file.name)) {
        console.log('Skipping upload for existing public URL:', file.name);
        uploadedUrls.push(file.name);
        continue;
      }

      const filename = `ai-chat-uploads/${Date.now()}-${file.name}`;
      const buffer = await file.arrayBuffer();

      await env.convex_cf_workers_images_test.put(filename, buffer, {
        httpMetadata: { contentType: file.type }
      });

      // Create the public R2 URL
      const url = `https://pub-1d414b448981415486cf93fcfcaf636d.r2.dev/${filename}`;
      uploadedUrls.push(url);
      console.log('✅ Successfully uploaded file to R2:', filename);
    } catch (error) {
      console.error('Failed to upload file:', error);
    }
  }

  return uploadedUrls;
}

// Get referenced agent data from Convex
async function getReferencedAgents(agentIds: string[], canvasId: string, convexUrl: string): Promise<any[]> {
  if (!agentIds || agentIds.length === 0) return [];

  try {
    const convex = new ConvexHttpClient(convexUrl);
    // Get all agents from the canvas and filter by referenced IDs
    const allAgents = await convex.query(api.agents.getCanvasAgents, { canvasId: canvasId as any });
    const referencedAgents = allAgents.filter(agent => agentIds.includes(agent._id));
    return referencedAgents;
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
  canvasId: string,
  userId: string,
  userMessage: string,
  assistantResponse: string,
  convexUrl: string,
  metadata?: any
): Promise<void> {
  try {
    const convex = new ConvexHttpClient(convexUrl);

    // First, get or create the chat agent for this canvas/user
    const chatAgent = await convex.mutation(api.agents.createOrGetChatAgent, {
      canvasId: canvasId as any,
      userId,
      userName: 'User' // Default name, could be improved
    });

    // Then update the chat history
    await convex.mutation(api.agents.updateChatHistory, {
      chatAgentId: chatAgent,
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
    let message: string;
    let referencedAgents: string[] = [];
    let uploadedFiles: File[] = [];
    let chatAgentId: string;
    let canvasId: string;

    // Handle both JSON and FormData requests
    const contentType = c.req.header('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // Handle FormData (with file uploads)
      const formData = await c.req.formData();
      message = formData.get('message') as string;
      chatAgentId = formData.get('chatAgentId') as string;
      canvasId = formData.get('canvasId') as string;

      const referencedAgentsStr = formData.get('referencedAgents') as string;
      if (referencedAgentsStr) {
        referencedAgents = JSON.parse(referencedAgentsStr);
      }

      // Get uploaded files - handle the fact that Cloudflare Workers may return different types
      const files = formData.getAll('uploadedFiles');
      const fileEntries: File[] = [];

      // Type guard function to check if entry is a File-like object
      const isFileEntry = (entry: any): entry is File => {
        return entry != null &&
          typeof entry === 'object' &&
          'name' in entry &&
          'size' in entry &&
          'type' in entry &&
          typeof entry.arrayBuffer === 'function';
      };

      for (const entry of files) {
        if (isFileEntry(entry)) {
          fileEntries.push(entry);
        }
      }

      uploadedFiles = fileEntries;
    } else {
      // Handle JSON (text-only messages)
      const jsonData = await c.req.json();
      message = jsonData.message;
      referencedAgents = jsonData.referencedAgents || [];
      uploadedFiles = []; // JSON requests don't contain actual File objects
      chatAgentId = jsonData.chatAgentId;
      canvasId = jsonData.canvasId;
    }

    if (!message || !chatAgentId || !canvasId) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // 1. Process file uploads to R2
    const uploadedUrls = await processFileUploads(uploadedFiles, c.env);

    // 2. Get referenced agent data from Convex
    const referencedAgentData = await getReferencedAgents(referencedAgents, canvasId, c.env.CONVEX_URL);

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
      canvasId,
      user.id,
      message,
      analysisResult.response,
      c.env.CONVEX_URL,
      {
        referencedAgents: referencedAgents as any[], // These are already the correct agent IDs
        uploadedFiles: uploadedUrls,
        createdAgents: createdAgents as any[]
      }
    );

    // 6. Auto-trigger media generation if enabled
    console.log('🔄 Checking auto-generation:', { autoGenerate: analysisResult.autoGenerate, createdAgentsCount: createdAgents.length });
    if (analysisResult.autoGenerate && createdAgents.length > 0) {
      console.log('✅ Starting auto-generation for', createdAgents.length, 'agents');
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
      console.log('✅ All agent statuses updated to processing');

      // Then trigger generation for all agents in parallel using internal functions
      console.log('🔄 Creating generation promises for', createdAgents.length, 'agents');
      const generationPromises = createdAgents.map(async (agentId, index) => {
        const operation = analysisResult.operations?.[index];
        if (!operation) {
          console.log('❌ No operation found for agent:', agentId, 'at index:', index);
          return;
        }

        console.log('🔄 Processing operation for agent:', agentId, 'type:', operation.type);

        try {
          if (operation.type === 'image-generate') {
            // Use HTTP endpoint for local development, internal function for production
            if (c.env.NODE_ENV === 'development') {
              const baseUrl = new URL(c.req.url).origin;
              const response = await fetch(`${baseUrl}/api/images`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
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
                console.error('❌ Failed to trigger image generation:', errorText);
              }
            } else {
              await generateImageInternal(
                c.env,
                user.id,
                operation.prompt,
                (operation.model === 'pro')
                  ? 'fal-ai/flux-kontext-lora/text-to-image'
                  : '@cf/black-forest-labs/flux-1-schnell',
                4, // steps
                undefined, // seed
                agentId
              );
            }
            console.log('✅ Successfully triggered image generation for agent:', agentId);
          } else if (operation.type === 'image-edit') {
            console.log('🔄 Processing image-edit operation');
            console.log('🔄 Operation inputSource:', operation.inputSource);
            console.log('🔄 Referenced agent data:', referencedAgentData.map(a => ({ id: a._id, imageUrl: a.imageUrl })));
            
            let inputImageUrl = operation.inputSource?.fileUrl;

            // If it's an agent connection, get the image URL from the referenced agent
            if (operation.inputSource?.type === 'agent_connection' && operation.inputSource?.sourceAgentId) {
              console.log('🔄 Looking for referenced agent with ID:', operation.inputSource.sourceAgentId);
              const referencedAgent = referencedAgentData.find(agent => agent._id === operation.inputSource?.sourceAgentId);
              console.log('🔄 Found referenced agent:', referencedAgent ? { id: referencedAgent._id, imageUrl: referencedAgent.imageUrl } : 'NOT FOUND');

              if (referencedAgent && referencedAgent.imageUrl) {
                inputImageUrl = referencedAgent.imageUrl;
                console.log('✅ Using referenced agent image URL:', inputImageUrl);
              } else {
                console.log('❌ Referenced agent not found or has no image URL');
                // Set agent to failed status
                const convex = new ConvexHttpClient(c.env.CONVEX_URL);
                await convex.mutation(api.agents.updateAgentStatus, {
                  agentId: agentId as any,
                  status: 'failed'
                });
                return; // Skip this agent
              }
            }

            if (!inputImageUrl) {
              console.log('❌ No input image URL found');
              // Set agent to failed status
              const convex = new ConvexHttpClient(c.env.CONVEX_URL);
              await convex.mutation(api.agents.updateAgentStatus, {
                agentId: agentId as any,
                status: 'failed'
              });
              return; // Skip this agent
            }

            console.log('🔄 Starting image edit for agent:', agentId, 'with inputImageUrl:', inputImageUrl);
            // Use HTTP endpoint for local development, internal function for production
            if (c.env.NODE_ENV === 'development') {
              const baseUrl = new URL(c.req.url).origin;
              const response = await fetch(`${baseUrl}/api/images/edit`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...Object.fromEntries(c.req.raw.headers.entries())
                },
                body: JSON.stringify({
                  prompt: operation.prompt,
                  inputImageUrl,
                  agentId
                })
              });

              if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Failed to trigger image edit:', errorText);
              }
            } else {
              await editImageInternal(
                c.env,
                user.id,
                operation.prompt,
                inputImageUrl,
                "fal-ai/flux-kontext/dev",
                28, // steps
                agentId
              );
            }
            console.log('✅ Successfully triggered image edit for agent:', agentId);
          } else if (operation.type === 'voice-generate') {
            // Use HTTP endpoint for local development, internal function for production
            const baseUrl = new URL(c.req.url).origin;
            if (c.env.NODE_ENV === 'development') {
              const response = await fetch(`${baseUrl}/api/voice`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...Object.fromEntries(c.req.raw.headers.entries())
                },
                body: JSON.stringify({
                  prompt: operation.prompt,
                  voice: 'Aurora',
                  agentId
                })
              });

              if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Failed to trigger voice generation:', errorText);
              }
            } else {
              await generateVoiceInternal(
                c.env,
                user.id,
                operation.prompt,
                'Aurora' as const,
                undefined, // audioSampleUrl
                operation.model || 'normal',
                agentId,
                baseUrl
              );
            }
            console.log('✅ Successfully triggered voice generation for agent:', agentId);
          } else if (operation.type === 'video-generate') {
            // Use HTTP endpoint for local development, internal function for production
            const baseUrl = new URL(c.req.url).origin;
            if (c.env.NODE_ENV === 'development') {
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
                console.error('❌ Failed to trigger video generation:', errorText);
              }
            } else {
              await generateVideoInternal(
                c.env,
                user.id,
                operation.prompt,
                operation.model || 'normal',
                '16:9', // aspectRatio
                '8s', // duration
                agentId,
                baseUrl
              );
            }
            console.log('✅ Successfully triggered video generation for agent:', agentId);
          }
        } catch (error) {
          console.error('❌ Failed to trigger generation for agent:', agentId, error);
          console.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown error');
          console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        }
      });

      // Fire all generation requests in parallel (don't wait for them to complete)
      // This allows the chat response to return immediately while generations happen in background
      // Each agent will update its status independently as generation completes
      console.log('🔄 Firing', generationPromises.length, 'generation promises');
      Promise.all(generationPromises).catch(error => {
        console.error('❌ Some generation requests failed:', error);
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



export default aiChatApi;
