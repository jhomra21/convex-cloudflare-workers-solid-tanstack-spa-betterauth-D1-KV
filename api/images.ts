import { Hono } from 'hono';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import type { Env, HonoVariables } from './types';

const imagesApi = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

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

// Helper function to update both agent image and status in one call
async function updateAgentImageAndStatus(
  convexUrl: string,
  agentId: string,
  imageUrl: string,
  status: 'success' | 'failed'
) {
  try {
    const convex = new ConvexHttpClient(convexUrl);
    await convex.mutation(api.agents.updateAgentImage, {
      agentId: agentId as any, // Cast to handle Convex ID type
      imageUrl,
    });
  } catch (error) {
    console.error(`❌ Failed to update agent image and status:`, agentId, error);
  }
}

// Edit an image using input image + prompt
imagesApi.post('/edit', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let agentId; // Declare agentId in outer scope

  try {
    const data = await c.req.json();
    const { prompt, inputImageUrl, model = "fal-ai/flux-kontext/dev", steps = 28 } = data;
    agentId = data.agentId; // Assign to outer scope variable

    if (!prompt) {
      return c.json({ error: 'Prompt is required' }, 400);
    }

    if (!inputImageUrl) {
      return c.json({ error: 'Input image URL is required for editing' }, 400);
    }

    // Check environment bindings
    if (!c.env.FAL_KEY) {
      console.error('❌ FAL_KEY not found');
      return c.json({ error: 'FAL AI service not configured' }, 500);
    }

    if (!c.env.convex_cf_workers_images_test) {
      console.error('❌ R2 bucket binding not found');
      return c.json({ error: 'Storage service not available' }, 500);
    }

    if (!c.env.CONVEX_URL) {
      console.error('❌ CONVEX_URL not found');
      return c.json({ error: 'Database service not configured' }, 500);
    }


    let imageBuffer;
    let base64Image;

    try {
      // Use FLUX Kontext model for image editing - specialized for context-aware editing
      const editModel = 'fal-ai/flux-kontext/dev';

      const falResponse = await fetch('https://fal.run/' + editModel, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${c.env.FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          image_url: inputImageUrl,
          num_inference_steps: steps || 28,
          guidance_scale: 2.5,
          sync_mode: true,
          num_images: 1,
          enable_safety_checker: false,
          output_format: "png",
          acceleration: "none",
          resolution_mode: "match_input"
        }),
      });

      if (!falResponse.ok) {
        const errorText = await falResponse.text();
        console.error('❌ FAL AI error:', errorText);

        // Set agent status to failed if agentId is provided
        if (agentId && c.env.CONVEX_URL) {
          await updateAgentStatus(c.env.CONVEX_URL, agentId, 'failed');
        }

        return c.json({ error: 'FAL AI editing failed' }, 500);
      }

      const falResult = await falResponse.json() as any;

      // Extract image data from FAL response

      if (falResult.images && falResult.images.length > 0) {
        const imageData = falResult.images[0];
        const imageDataUri = imageData.url;

        console.log('🔍 Image Data URI type:', typeof imageDataUri);
        console.log('🔍 Image Data URI preview:', imageDataUri.substring(0, 100) + '...');

        // Check if it's a data URI (base64)
        if (imageDataUri.startsWith('data:image/')) {
          // Extract base64 data from data URI
          const base64Data = imageDataUri.split(',')[1];
          if (!base64Data) {
            throw new Error('Invalid base64 data in data URI');
          }
          base64Image = base64Data;
          imageBuffer = Buffer.from(base64Data, 'base64');
          console.log('✅ Processed base64 image, buffer size:', imageBuffer.length);
        } else {
          // Fallback: download from URL (in case it's still a remote URL)
          console.log('🔄 Downloading image from URL:', imageDataUri);
          const imageResponse = await fetch(imageDataUri);
          if (!imageResponse.ok) {
            throw new Error(`Failed to download edited image from FAL: ${imageResponse.status} ${imageResponse.statusText}`);
          }

          imageBuffer = await imageResponse.arrayBuffer();
          base64Image = Buffer.from(imageBuffer).toString('base64');
          console.log('✅ Downloaded image, buffer size:', imageBuffer.byteLength);
        }
      } else {
        console.error('❌ No images in FAL editing response:', falResult);
        return c.json({ error: 'No images generated by FAL AI editing' }, 500);
      }
    } catch (error) {
      console.error('❌ FAL AI editing error:', error);

      // Set agent status to failed if agentId is provided
      if (agentId && c.env.CONVEX_URL) {
        await updateAgentStatus(c.env.CONVEX_URL, agentId, 'failed');
      }

      return c.json({ error: 'Failed to edit image with FAL AI', details: error.message }, 500);
    }

    // Create unique filename
    const filename = `edited-${user.id}-${Date.now()}.png`;

    // Store in R2
    await c.env.convex_cf_workers_images_test.put(filename, imageBuffer, {
      httpMetadata: {
        contentType: 'image/png',
      },
    });

    // Verify the file was actually stored
    try {
      const verification = await c.env.convex_cf_workers_images_test.head(filename);
    } catch (verifyError) {
    }

    // Create a public URL using R2 public domain
    const imageUrl = `https://pub-1d414b448981415486cf93fcfcaf636d.r2.dev/${filename}`;

    // Save directly to Convex from Hono API (more efficient)
    const convex = new ConvexHttpClient(c.env.CONVEX_URL);
    await convex.mutation(api.images.addImage, {
      imageUrl,
      prompt,
      model,
      steps,
      userId: user.id,
    });

    // Update agent with both image and success status if agentId is provided  
    if (agentId) {
      await updateAgentImageAndStatus(c.env.CONVEX_URL, agentId, imageUrl, 'success');
    }

    return c.json({
      success: true,
      image: {
        url: imageUrl,
        prompt,
        model,
        steps,
        inputImageUrl,
        // Include base64 for immediate display
        base64: `data:image/png;base64,${base64Image}`,
      }
    });
  } catch (error) {
    // Set agent status to failed if agentId is provided
    if (agentId && c.env.CONVEX_URL) {
      await updateAgentStatus(c.env.CONVEX_URL, agentId, 'failed');
    }

    return c.json({
      error: 'Failed to edit image',
      details: error.message,
      type: error.constructor.name
    }, 500);
  }
});

// Upload user image to R2
imagesApi.post('/upload', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const formData = await c.req.formData();
    const fileEntry = formData.get('image');

    if (!fileEntry) {
      return c.json({ error: 'No image file provided' }, 400);
    }

    // Ensure it's a File object, not a string
    if (typeof fileEntry === 'string') {
      return c.json({ error: 'Invalid file data' }, 400);
    }

    const file = fileEntry as File;

    if (!file.type.startsWith('image/')) {
      return c.json({ error: 'File must be an image' }, 400);
    }

    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return c.json({ error: 'File size must be less than 10MB' }, 400);
    }

    if (!c.env.convex_cf_workers_images_test) {
      console.error('❌ R2 bucket binding not found');
      return c.json({ error: 'Storage service not available' }, 500);
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop() || 'png';
    const filename = `uploaded-${user.id}-${Date.now()}.${fileExtension}`;

    // Convert file to buffer
    const imageBuffer = await file.arrayBuffer();

    // Store in R2
    await c.env.convex_cf_workers_images_test.put(filename, imageBuffer, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000', // 1 year
      },
      customMetadata: {
        uploadedBy: user.id,
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });

    // Create a public URL using R2 public domain
    const imageUrl = `https://pub-1d414b448981415486cf93fcfcaf636d.r2.dev/${filename}`;

    console.log(`✅ Image uploaded successfully: ${imageUrl}`);

    return c.json({
      success: true,
      imageUrl,
      filename
    });

  } catch (error) {
    console.error('❌ Upload failed:', error);
    return c.json({ error: 'Upload failed' }, 500);
  }
});

// Generate and store an image
imagesApi.post('/', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let agentId; // Declare agentId in outer scope

  try {
    const data = await c.req.json();
    const { prompt, model = "@cf/black-forest-labs/flux-1-schnell", steps = 4, seed } = data;
    agentId = data.agentId; // Assign to outer scope variable

    if (!prompt) {
      return c.json({ error: 'Prompt is required' }, 400);
    }

    // Note: Client handles optimistic "processing" status for instant feedback
    // Server only handles final success/failed status for reliability


    // Check environment bindings
    if (!c.env.AI) {
      console.error('❌ AI binding not found');
      return c.json({ error: 'AI service not available' }, 500);
    }

    if (!c.env.convex_cf_workers_images_test) {
      console.error('❌ R2 bucket binding not found');
      return c.json({ error: 'Storage service not available' }, 500);
    }

    if (!c.env.CONVEX_URL) {
      console.error('❌ CONVEX_URL not found');
      return c.json({ error: 'Database service not configured' }, 500);
    }

    let imageBuffer;
    let base64Image;

    // Determine which AI service to use based on model
    if (model.startsWith('fal-ai/')) {
      // Use FAL AI for Pro models
      if (!c.env.FAL_KEY) {
        console.error('❌ FAL_KEY not found');
        return c.json({ error: 'FAL AI service not configured' }, 500);
      }


      try {
        const falResponse = await fetch('https://fal.run/' + model, {
          method: 'POST',
          headers: {
            'Authorization': `Key ${c.env.FAL_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            // seed: seed || Math.floor(Math.random() * 4294967295),
            enable_safety_checker: false,
            sync_mode: true,
            num_inference_steps: 20,
            guidance_scale: 2.5,
          }),
        });

        if (!falResponse.ok) {
          const errorText = await falResponse.text();
          console.error('❌ FAL AI error:', errorText);

          // Set agent status to failed if agentId is provided
          if (agentId && c.env.CONVEX_URL) {
            await updateAgentStatus(c.env.CONVEX_URL, agentId, 'failed');
          }

          return c.json({ error: 'FAL AI generation failed' }, 500);
        }

        const falResult = await falResponse.json() as any;
        // console.log('✅ FAL AI response:', falResult);

        // Extract image data from FAL response
        if (falResult.images && falResult.images.length > 0) {
          const imageDataUri = falResult.images[0].url;

          // Check if it's a data URI (base64)
          if (imageDataUri.startsWith('data:image/')) {
            // Extract base64 data from data URI
            const base64Data = imageDataUri.split(',')[1];
            base64Image = base64Data;
            imageBuffer = Buffer.from(base64Data, 'base64');
          } else {
            // Fallback: download from URL (in case it's still a remote URL)
            const imageResponse = await fetch(imageDataUri);
            if (!imageResponse.ok) {
              throw new Error('Failed to download image from FAL');
            }

            imageBuffer = await imageResponse.arrayBuffer();
            base64Image = Buffer.from(imageBuffer).toString('base64');
          }
        } else {
          console.error('❌ No images in FAL response:', falResult);
          return c.json({ error: 'No images generated by FAL AI' }, 500);
        }
      } catch (error) {
        console.error('❌ FAL AI error:', error);
        return c.json({ error: 'Failed to generate image with FAL AI', details: error.message }, 500);
      }
    } else {
      // Use Workers AI for default models
      console.log('🤖 Using Workers AI for model:', model);

      const result = await c.env.AI.run(model as any, {
        prompt,
        num_steps: steps,
        seed: seed || Math.floor(Math.random() * 4294967295),
      });

      // Handle different response formats from Workers AI
      if (result instanceof ReadableStream) {
        const response = new Response(result);
        imageBuffer = await response.arrayBuffer();
        base64Image = Buffer.from(imageBuffer).toString('base64');
      } else if (result instanceof Uint8Array) {
        imageBuffer = result;
        base64Image = Buffer.from(result).toString('base64');
      } else if (result && typeof result === 'object' && 'image' in result) {
        base64Image = (result as any).image;
        imageBuffer = Buffer.from((result as any).image, 'base64');
      } else if (result && typeof result === 'object' && 'images' in result && Array.isArray((result as any).images)) {
        base64Image = (result as any).images[0];
        imageBuffer = Buffer.from((result as any).images[0], 'base64');
      } else {
        console.error('❌ Unexpected result format:', result);
        return c.json({ error: 'Failed to generate image - unexpected response format' }, 500);
      }
    }

    // Create unique filename
    const filename = `${user.id}-${Date.now()}.png`;

    // Store in R2
    await c.env.convex_cf_workers_images_test.put(filename, imageBuffer, {
      httpMetadata: {
        contentType: 'image/png',
      },
    });

    // Verify the file was actually stored
    try {
      const verification = await c.env.convex_cf_workers_images_test.head(filename);
    } catch (verifyError) {
    }

    // Create a public URL using R2 public domain
    const imageUrl = `https://pub-1d414b448981415486cf93fcfcaf636d.r2.dev/${filename}`;

    // Save directly to Convex from Hono API (more efficient)
    const convex = new ConvexHttpClient(c.env.CONVEX_URL);
    const finalSeed = seed || Math.floor(Math.random() * 4294967295);
    await convex.mutation(api.images.addImage, {
      imageUrl,
      prompt,
      model,
      seed: finalSeed,
      steps,
      userId: user.id,
    });

    // Update agent with both image and success status if agentId is provided  
    if (agentId) {
      await updateAgentImageAndStatus(c.env.CONVEX_URL, agentId, imageUrl, 'success');
    }

    return c.json({
      success: true,
      image: {
        url: imageUrl,
        prompt,
        model,
        steps,
        seed: finalSeed,
        // Include base64 for immediate display
        base64: `data:image/png;base64,${base64Image}`,
      }
    });
  } catch (error) {
    // Set agent status to failed if agentId is provided
    if (agentId && c.env.CONVEX_URL) {
      await updateAgentStatus(c.env.CONVEX_URL, agentId, 'failed');
    }

    return c.json({
      error: 'Failed to generate image',
      details: error.message,
      type: error.constructor.name
    }, 500);
  }
});

// Delete an image by ID
imagesApi.delete('/:imageId', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const imageId = c.req.param('imageId');

    if (!c.env.CONVEX_URL) {
      console.error('❌ CONVEX_URL not found');
      return c.json({ error: 'Database service not configured' }, 500);
    }

    // First, get the image data from Convex to find the filename
    const convex = new ConvexHttpClient(c.env.CONVEX_URL);

    // Get the image record to extract filename from URL
    const imageToDelete = await convex.query(api.images.getImageById, { imageId: imageId as any });

    if (!imageToDelete) {
      console.error('❌ Image not found for user');
      return c.json({ error: 'Image not found' }, 404);
    }

    // Extract filename from URL (last part after the last slash)
    const filename = imageToDelete.imageUrl.split('/').pop();

    // Delete from R2 first
    if (filename && c.env.convex_cf_workers_images_test) {
      await c.env.convex_cf_workers_images_test.delete(filename);
    }

    // Delete from Convex
    await convex.mutation(api.images.deleteImage, { imageId: imageId as any });

    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting image:', error);
    return c.json({
      error: 'Failed to delete image',
      details: error.message
    }, 500);
  }
});

// Get an image by filename (R2 object)
imagesApi.get('/:filename', async (c) => {
  const filename = c.req.param('filename');
  try {
    const object = await c.env.convex_cf_workers_images_test.get(filename);

    if (!object) {
      return c.json({ error: 'Image not found' }, 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);

    return new Response(object.body, {
      headers,
    });
  } catch (error) {
    console.error('Error retrieving image:', error);
    return c.json({ error: 'Failed to retrieve image' }, 500);
  }
});

// Internal function for image generation (no HTTP layer)
export async function generateImageInternal(
  env: Env,
  userId: string,
  prompt: string,
  model: string = "@cf/black-forest-labs/flux-1-schnell",
  steps: number = 4,
  seed?: number,
  agentId?: string
) {
  try {
    let imageBuffer;
    let base64Image;

    // Determine which AI service to use based on model
    if (model.startsWith('fal-ai/')) {
      // Use FAL AI for Pro models
      if (!env.FAL_KEY) {
        throw new Error('FAL AI service not configured');
      }

      const falResponse = await fetch('https://fal.run/' + model, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${env.FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          enable_safety_checker: false,
          sync_mode: true,
          num_inference_steps: 20,
          guidance_scale: 2.5,
        }),
      });

      if (!falResponse.ok) {
        const errorText = await falResponse.text();
        console.error('❌ FAL AI error:', errorText);
        throw new Error('FAL AI generation failed');
      }

      const falResult = await falResponse.json() as any;

      if (falResult.images && falResult.images.length > 0) {
        const imageDataUri = falResult.images[0].url;

        if (imageDataUri.startsWith('data:image/')) {
          const base64Data = imageDataUri.split(',')[1];
          base64Image = base64Data;
          imageBuffer = Buffer.from(base64Data, 'base64');
        } else {
          const imageResponse = await fetch(imageDataUri);
          if (!imageResponse.ok) {
            throw new Error('Failed to download image from FAL');
          }
          imageBuffer = await imageResponse.arrayBuffer();
          base64Image = Buffer.from(imageBuffer).toString('base64');
        }
      } else {
        throw new Error('No images generated by FAL AI');
      }
    } else {
      // Use Workers AI for default models
      const result = await env.AI.run(model as any, {
        prompt,
        num_steps: steps,
        seed: seed || Math.floor(Math.random() * 4294967295),
      });

      if (result instanceof ReadableStream) {
        const response = new Response(result);
        imageBuffer = await response.arrayBuffer();
        base64Image = Buffer.from(imageBuffer).toString('base64');
      } else if (result instanceof Uint8Array) {
        imageBuffer = result;
        base64Image = Buffer.from(result).toString('base64');
      } else if (result && typeof result === 'object' && 'image' in result) {
        base64Image = (result as any).image;
        imageBuffer = Buffer.from((result as any).image, 'base64');
      } else if (result && typeof result === 'object' && 'images' in result && Array.isArray((result as any).images)) {
        base64Image = (result as any).images[0];
        imageBuffer = Buffer.from((result as any).images[0], 'base64');
      } else {
        throw new Error('Failed to generate image - unexpected response format');
      }
    }

    // Create unique filename and store in R2
    const filename = `${userId}-${Date.now()}.png`;
    await env.convex_cf_workers_images_test.put(filename, imageBuffer, {
      httpMetadata: { contentType: 'image/png' },
    });

    const imageUrl = `https://pub-1d414b448981415486cf93fcfcaf636d.r2.dev/${filename}`;

    // Save to Convex
    const convex = new ConvexHttpClient(env.CONVEX_URL);
    const finalSeed = seed || Math.floor(Math.random() * 4294967295);
    await convex.mutation(api.images.addImage, {
      imageUrl,
      prompt,
      model,
      seed: finalSeed,
      steps,
      userId,
    });

    // Update agent if provided
    if (agentId) {
      await convex.mutation(api.agents.updateAgentImage, {
        agentId: agentId as any,
        imageUrl,
      });
    }

    return {
      success: true,
      imageUrl,
      base64: `data:image/png;base64,${base64Image}`,
    };
  } catch (error) {
    // Update agent status to failed if provided
    if (agentId && env.CONVEX_URL) {
      await updateAgentStatus(env.CONVEX_URL, agentId, 'failed');
    }
    throw error;
  }
}

// Internal function for image editing (no HTTP layer, uses async queue with webhooks)
export async function editImageInternal(
  env: Env,
  userId: string,
  prompt: string,
  inputImageUrl: string,
  model: string = "fal-ai/flux-kontext/dev",
  steps: number = 28,
  agentId?: string,
  baseUrl?: string
) {
  console.log('🔄 editImageInternal called with:', { userId, prompt, inputImageUrl, model, steps, agentId });
  try {
    if (!env.FAL_KEY) {
      console.error('❌ FAL_KEY not found in editImageInternal');
      throw new Error('FAL AI service not configured');
    }

    console.log('🔄 Making FAL AI request for image editing...');
    console.log('🔄 FAL AI URL:', 'https://fal.run/' + model);
    console.log('🔄 Request params:', { prompt: prompt.substring(0, 50), inputImageUrl, steps });

    let falResponse;
    try {
      console.log('🔄 Starting fetch request...');
      falResponse = await fetch('https://fal.run/' + model, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${env.FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          image_url: inputImageUrl,
          num_inference_steps: steps || 28,
          guidance_scale: 2.5,
          sync_mode: true,
          num_images: 1,
          enable_safety_checker: false,
          output_format: "png",
          acceleration: "none",
          resolution_mode: "match_input"
        })
      });

      console.log('✅ Fetch request completed, status:', falResponse.status);

      if (!falResponse.ok) {
        const errorText = await falResponse.text();
        console.error('❌ FAL AI error:', errorText);
        console.error('❌ FAL AI response status:', falResponse.status);
        throw new Error('FAL AI editing failed');
      }

      console.log('✅ FAL AI response received successfully');
    } catch (fetchError) {
      console.error('❌ FAL AI fetch error:', fetchError);
      throw fetchError;
    }

    const falResult = await falResponse.json() as any;
    let imageBuffer;
    let base64Image;

    if (falResult.images && falResult.images.length > 0) {
      const imageData = falResult.images[0];
      const imageDataUri = imageData.url;

      if (imageDataUri.startsWith('data:image/')) {
        const base64Data = imageDataUri.split(',')[1];
        if (!base64Data) {
          throw new Error('Invalid base64 data in data URI');
        }
        base64Image = base64Data;
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        const imageResponse = await fetch(imageDataUri);
        if (!imageResponse.ok) {
          throw new Error(`Failed to download edited image from FAL: ${imageResponse.status}`);
        }
        imageBuffer = await imageResponse.arrayBuffer();
        base64Image = Buffer.from(imageBuffer).toString('base64');
      }
    } else {
      throw new Error('No images generated by FAL AI editing');
    }

    // Create unique filename and store in R2
    const filename = `edited-${userId}-${Date.now()}.png`;
    await env.convex_cf_workers_images_test.put(filename, imageBuffer, {
      httpMetadata: { contentType: 'image/png' },
    });

    const imageUrl = `https://pub-1d414b448981415486cf93fcfcaf636d.r2.dev/${filename}`;

    // Save to Convex
    const convex = new ConvexHttpClient(env.CONVEX_URL);
    await convex.mutation(api.images.addImage, {
      imageUrl,
      prompt,
      model,
      steps,
      userId,
    });

    // Update agent if provided
    if (agentId) {
      await convex.mutation(api.agents.updateAgentImage, {
        agentId: agentId as any,
        imageUrl,
      });
    }

    return {
      success: true,
      imageUrl,
      base64: `data:image/png;base64,${base64Image}`,
    };
  } catch (error) {
    // Update agent status to failed if provided
    if (agentId && env.CONVEX_URL) {
      await updateAgentStatus(env.CONVEX_URL, agentId, 'failed');
    }
    throw error;
  }
}

export default imagesApi;
