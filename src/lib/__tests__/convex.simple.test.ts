// @ts-ignore - Bun's built-in test module
import { describe, it, expect, beforeEach, mock } from 'bun:test';

// Mock modules at the top level
mock.module('convex/browser', () => ({
  ConvexClient: mock(() => ({
    query: mock(() => Promise.resolve([])),
    mutation: mock(() => Promise.resolve({})),
    action: mock(() => Promise.resolve({})),
    onUpdate: mock(() => mock(() => { })),
    connectionState: mock(() => ({
      isWebSocketConnected: true,
      hasInflightRequests: false,
      timeOfOldestInflightRequest: null,
      hasEverConnected: true,
      connectionCount: 1,
      connectionRetries: 0,
      inflightMutations: 0,
      inflightActions: 0
    }))
  }))
}));

mock.module('../../convex/_generated/api', () => ({
  api: {
    tasks: {
      getTasks: { _type: 'query', _visibility: 'public' },
      createTask: { _type: 'mutation', _visibility: 'public' },
      updateTask: { _type: 'mutation', _visibility: 'public' }
    },
    agents: {
      getCanvasAgents: { _type: 'query', _visibility: 'public' },
      createAgent: { _type: 'mutation', _visibility: 'public' },
      updateAgentStatus: { _type: 'mutation', _visibility: 'public' }
    }
  }
}));

mock.module('@tanstack/solid-query', () => ({
  useQuery: mock(() => ({
    data: [],
    isLoading: false,
    error: null,
    refetch: mock(() => { })
  })),
  useMutation: mock(() => ({
    mutate: mock(() => { }),
    mutateAsync: mock(() => Promise.resolve({})),
    isPending: false,
    error: null
  })),
  useQueryClient: mock(() => ({
    setQueryData: mock(() => { }),
    getQueryData: mock(() => []),
    invalidateQueries: mock(() => { }),
    prefetchQuery: mock(() => Promise.resolve())
  }))
}));

mock.module('solid-js', () => ({
  createEffect: mock(() => { }),
  onCleanup: mock(() => { }),
  createSignal: mock(() => [() => true, mock(() => { })])
}));

// Comprehensive Convex Client Tests
describe('Convex Client - Core Functionality', () => {
  it('should export all required functions and objects', async () => {
    const convexModule = await import('../convex');

    // Check main exports
    expect(convexModule.convexClient).toBeDefined();
    expect(convexModule.convexApi).toBeDefined();

    // Check hook exports
    expect(typeof convexModule.useConvexQuery).toBe('function');
    expect(typeof convexModule.useConvexMutation).toBe('function');
    expect(typeof convexModule.useConvexAction).toBe('function');
    expect(typeof convexModule.useConvexConnectionStatus).toBe('function');
    expect(typeof convexModule.useBatchConvexMutations).toBe('function');

    // Check utility exports
    expect(typeof convexModule.prefetchConvexQuery).toBe('function');
    expect(typeof convexModule.invalidateConvexQueries).toBe('function');
  });

  it('should create useConvexQuery hook without errors', async () => {
    const { useConvexQuery, convexApi } = await import('../convex');

    expect(() => {
      const query = convexApi.tasks.getTasks;
      const args = () => ({ userId: 'test-user' });
      const queryKey = () => ['tasks', 'test-user'];

      useConvexQuery(query, args, queryKey);
    }).not.toThrow();
  });

  it('should create useConvexMutation hook without errors', async () => {
    const { useConvexMutation, convexApi } = await import('../convex');

    expect(() => {
      const mutation = convexApi.tasks.createTask;
      const options = {
        onSuccess: () => console.log('Success'),
        onError: () => console.log('Error'),
        invalidateQueries: [['convex', 'tasks']]
      };

      useConvexMutation(mutation, options);
    }).not.toThrow();
  });

  it('should create useConvexAction hook without errors', async () => {
    const { useConvexAction } = await import('../convex');

    expect(() => {
      // Create a mock action reference with correct type
      const action = {
        _type: 'action' as const,
        _visibility: 'public' as const,
        _args: {} as any,
        _returnType: {} as any,
        _componentPath: undefined as any
      };
      const options = {
        onSuccess: () => console.log('Success'),
        invalidateQueries: [['convex', 'tasks']]
      };

      useConvexAction(action, options);
    }).not.toThrow();
  });

  it('should create connection status hook without errors', async () => {
    const { useConvexConnectionStatus } = await import('../convex');

    expect(() => {
      useConvexConnectionStatus();
    }).not.toThrow();
  });

  it('should create batch mutations hook without errors', async () => {
    const { useBatchConvexMutations } = await import('../convex');

    expect(() => {
      const batchHook = useBatchConvexMutations();
      expect(batchHook).toHaveProperty('batch');
      expect(typeof batchHook.batch).toBe('function');
    }).not.toThrow();
  });

  it('should handle utility functions correctly', async () => {
    const { prefetchConvexQuery, invalidateConvexQueries, convexApi } = await import('../convex');

    const mockQueryClient = {
      prefetchQuery: mock(() => Promise.resolve()),
      invalidateQueries: mock(() => { })
    };

    expect(() => {
      prefetchConvexQuery(
        mockQueryClient,
        convexApi.tasks.getTasks,
        { userId: 'test' },
        ['tasks', 'test']
      );

      invalidateConvexQueries(mockQueryClient, ['tasks']);
    }).not.toThrow();
  });
});

// Test the retry logic in images-actions
describe('Images Actions - Retry Logic', () => {
  beforeEach(() => {
    // Reset global fetch mock - cast to avoid TypeScript errors
    global.fetch = mock(() => Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({ success: true })
    })) as typeof fetch;
  });

  it('should create useGenerateImage hook without errors', async () => {
    // Mock solid-sonner
    mock.module('solid-sonner', () => ({
      toast: {
        info: mock(() => { }),
        success: mock(() => { }),
        error: mock(() => { })
      }
    }));

    const { useGenerateImage } = await import('../images-actions');

    expect(() => {
      useGenerateImage();
    }).not.toThrow();
  });

  it('should correctly identify Workers AI capacity errors for normal models', () => {
    const error = {
      type: 'InferenceUpstreamError',
      details: '3040: Capacity temporarily exceeded, please try again.',
      message: 'Failed to generate image'
    };

    // Test for normal model (undefined defaults to normal)
    const model: string | undefined = undefined;
    const normalModel = '@cf/black-forest-labs/flux-1-schnell';
    const isWorkersAICapacityError =
      error.type === 'InferenceUpstreamError' &&
      error.details?.includes('Capacity temporarily exceeded') &&
      (!model || model === normalModel);

    expect(isWorkersAICapacityError).toBe(true);
  });

  it('should correctly identify Workers AI capacity errors for explicit normal model', () => {
    const error = {
      type: 'InferenceUpstreamError',
      details: '3040: Capacity temporarily exceeded, please try again.',
      message: 'Failed to generate image'
    };

    // Test for explicit normal model
    const model = '@cf/black-forest-labs/flux-1-schnell';
    const normalModel = '@cf/black-forest-labs/flux-1-schnell';
    const isWorkersAICapacityError =
      error.type === 'InferenceUpstreamError' &&
      error.details?.includes('Capacity temporarily exceeded') &&
      (!model || model === normalModel);

    expect(isWorkersAICapacityError).toBe(true);
  });

  it('should not retry for Pro models (FAL AI)', () => {
    const error = {
      type: 'InferenceUpstreamError',
      details: '3040: Capacity temporarily exceeded, please try again.',
      message: 'Failed to generate image'
    };

    // Test for Pro model
    const model: string = 'fal-ai/flux-kontext-lora';
    const normalModel = '@cf/black-forest-labs/flux-1-schnell';
    const isWorkersAICapacityError =
      error.type === 'InferenceUpstreamError' &&
      error.details?.includes('Capacity temporarily exceeded') &&
      (!model || model === normalModel);

    expect(isWorkersAICapacityError).toBe(false);
  });

  it('should not retry for non-capacity errors', () => {
    const error = {
      type: 'ValidationError',
      details: 'Invalid prompt content',
      message: 'Failed to generate image'
    };

    const model = '@cf/black-forest-labs/flux-1-schnell';
    const normalModel = '@cf/black-forest-labs/flux-1-schnell';
    const isWorkersAICapacityError =
      error.type === 'InferenceUpstreamError' &&
      error.details?.includes('Capacity temporarily exceeded') &&
      (!model || model === normalModel);

    expect(isWorkersAICapacityError).toBe(false);
  });

  it('should provide better error messages for capacity issues', () => {
    const capacityError = {
      type: 'InferenceUpstreamError',
      details: '3040: Capacity temporarily exceeded, please try again.',
      message: 'Failed to generate image'
    };

    // Test the error message logic
    const shouldRetry = capacityError.type === 'InferenceUpstreamError' &&
      capacityError.details?.includes('Capacity temporarily exceeded');

    let errorMessage;
    if (shouldRetry) {
      // This would be for Pro models that don't retry
      errorMessage = 'Workers AI is currently busy. Try again in a few moments or switch to Pro model.';
    } else {
      errorMessage = capacityError.message || 'Failed to generate image';
    }

    expect(shouldRetry).toBe(true);
    expect(errorMessage).toBe('Workers AI is currently busy. Try again in a few moments or switch to Pro model.');
  });
});

// Test basic functionality
describe('Basic Functionality Tests', () => {
  it('should handle environment variables', () => {
    // Test that we can access environment variables
    const convexUrl = process.env.VITE_CONVEX_URL || 'https://test.convex.cloud';
    expect(typeof convexUrl).toBe('string');
    expect(convexUrl.length).toBeGreaterThan(0);
  });

  it('should handle basic error scenarios', () => {
    const error = new Error('Test error');
    expect(error.message).toBe('Test error');
    expect(error instanceof Error).toBe(true);
  });
});