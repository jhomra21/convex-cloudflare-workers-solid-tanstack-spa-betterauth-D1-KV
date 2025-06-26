import { Hono } from 'hono';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import type { Env, HonoVariables } from './types';

const imagesApi = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// Generate and store an image
imagesApi.post('/', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const data = await c.req.json();
    const { prompt, model = "@cf/black-forest-labs/flux-1-schnell", steps = 4, seed } = data;

    if (!prompt) {
      return c.json({ error: 'Prompt is required' }, 400);
    }

    console.log('🎨 Starting image generation:', { prompt, model, steps });

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

    // Generate image using Workers AI
    console.log('🤖 Calling Workers AI...');
    const result = await c.env.AI.run(model, {
      prompt,
      num_steps: steps,
      seed: seed || Math.floor(Math.random() * 4294967295),
    });
    console.log('✅ Workers AI raw response type:', typeof result, result.constructor.name);

    // Handle different response formats from Workers AI
    let imageBuffer;
    if (result instanceof ReadableStream) {
      console.log('🔄 Processing ReadableStream...');
      const response = new Response(result);
      imageBuffer = await response.arrayBuffer();
      console.log('✅ Got image buffer from stream, size:', imageBuffer.byteLength);
    } else if (result && result.image) {
      console.log('🔄 Processing base64 response (single image)...');
      imageBuffer = Buffer.from(result.image, 'base64');
      console.log('✅ Got image buffer from base64, size:', imageBuffer.length);
    } else if (result && result.images && result.images.length > 0) {
      console.log('🔄 Processing base64 response (image array)...');
      imageBuffer = Buffer.from(result.images[0], 'base64');
      console.log('✅ Got image buffer from base64 array, size:', imageBuffer.length);
    } else {
      console.error('❌ Unexpected result format:', result);
      return c.json({ error: 'Failed to generate image - unexpected response format' }, 500);
    }
    
    // Create unique filename
    const filename = `${user.id}-${Date.now()}.png`;
    console.log('📁 Generated filename:', filename);
    
    // Store in R2
    console.log('☁️ Storing in R2...');
    await c.env.convex_cf_workers_images_test.put(filename, imageBuffer, {
      httpMetadata: {
        contentType: 'image/png',
      },
    });
    console.log('✅ Stored in R2 successfully');
    
    // Verify the file was actually stored
    try {
      const verification = await c.env.convex_cf_workers_images_test.head(filename);
      console.log('🔍 R2 verification - file exists:', !!verification, 'size:', verification?.size);
    } catch (verifyError) {
      console.log('❌ R2 verification failed:', verifyError.message);
    }

    // Create a public URL using R2 public domain
    const imageUrl = `https://pub-1d414b448981415486cf93fcfcaf636d.r2.dev/${filename}`;
    console.log('🔗 Generated image URL:', imageUrl);

    // Save directly to Convex from Hono API (more efficient)
    console.log('💾 Saving to Convex...');
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
    console.log('✅ Saved to Convex successfully');

    return c.json({
      success: true,
      image: {
        url: imageUrl,
        prompt,
        model,
        steps,
        seed: finalSeed,
        // Include base64 for immediate display
        base64: `data:image/png;base64,${result.image}`,
      }
    });
  } catch (error) {
    console.error('❌ Error generating image:', error);
    return c.json({ 
      error: 'Failed to generate image', 
      details: error.message,
      type: error.constructor.name
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

export default imagesApi;
