# Convex Client Tests

This directory contains comprehensive tests for our custom Convex client implementation using **Bun's built-in test runner**.

## Test Files

### `convex.simple.test.ts`
Comprehensive tests for the core Convex client functionality:

#### **Core Functionality Tests**
- ✅ All exports (`convexClient`, `convexApi`, hooks, utilities)
- ✅ `useConvexQuery` - Real-time query subscriptions with TanStack Query
- ✅ `useConvexMutation` - Optimistic updates and error handling
- ✅ `useConvexAction` - Action execution
- ✅ `useConvexConnectionStatus` - Connection monitoring
- ✅ `useBatchConvexMutations` - Batch operations
- ✅ Utility functions (`prefetchConvexQuery`, `invalidateConvexQueries`)

#### **Images Actions - Retry Logic Tests**
- ✅ Hook creation without errors
- ✅ Workers AI capacity error identification for normal models
- ✅ No retry logic for Pro models (FAL AI) - cost conscious
- ✅ Proper error type detection (capacity vs validation errors)
- ✅ Better error messages for different scenarios

#### **Basic Functionality Tests**
- ✅ Environment variable handling
- ✅ Error handling scenarios

## Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test src/lib/__tests__/convex.simple.test.ts

# Run tests in watch mode
bun test --watch

# Run tests with verbose output
bun test --reporter=verbose
```

## Test Coverage

The tests cover:

### ✅ Core Functionality
- Real-time subscriptions with automatic cache updates
- Optimistic mutations with error recovery
- Connection status monitoring
- Batch operations
- Type safety and error handling

### ✅ Integration Scenarios
- SolidJS reactivity integration
- TanStack Query cache management
- Component lifecycle (mount/unmount)
- Error boundaries and recovery

### ✅ Edge Cases
- Network failures and retries
- Subscription errors and cleanup
- Invalid arguments handling
- Connection state changes

### ✅ Performance Features
- Optimistic updates for instant UI feedback
- Smart retry logic for capacity errors
- Efficient batch operations
- Connection-aware operations

## Mock Strategy

The tests use **Bun's built-in mocking system** to isolate functionality:

- **ConvexClient**: Mocked using `mock.module()` to control responses
- **TanStack Query**: Mocked to verify correct integration patterns
- **SolidJS**: Mocked to test reactive behavior without DOM dependencies
- **Network**: Mocked `global.fetch` for testing retry logic
- **External Libraries**: All external dependencies mocked at module level

## TypeScript Support

To resolve TypeScript errors with `bun:test`, we use:
- **@ts-ignore comment**: Simple suppression of the `bun:test` module error
- **Type casting**: Cast mocks to proper types (e.g., `as typeof fetch`)
- **Minimal approach**: No separate type declaration files needed

## Key Test Patterns

### Module Mocking with Bun
```typescript
// Mock external dependencies at module level
mock.module('convex/browser', () => ({
  ConvexClient: mock(() => ({
    query: mock(() => Promise.resolve([])),
    mutation: mock(() => Promise.resolve({})),
    onUpdate: mock(() => mock(() => {}))
  }))
}));
```

### Hook Testing
```typescript
// Test hook creation without errors
expect(() => {
  const query = convexApi.tasks.getTasks;
  const args = () => ({ userId: 'test-user' });
  const queryKey = () => ['tasks', 'test-user'];
  
  useConvexQuery(query, args, queryKey);
}).not.toThrow();
```

### Retry Logic Testing
```typescript
// Test error identification logic
const error = {
  type: 'InferenceUpstreamError',
  details: '3040: Capacity temporarily exceeded, please try again.'
};

const isWorkersAICapacityError = 
  error.type === 'InferenceUpstreamError' && 
  error.details?.includes('Capacity temporarily exceeded') &&
  (!model || model === '@cf/black-forest-labs/flux-1-schnell');

expect(isWorkersAICapacityError).toBe(true);
```

## Adding New Tests

When adding new functionality to the Convex client:

1. **Unit Tests**: Add to `convex.test.ts` for core functionality
2. **Integration Tests**: Add to `convex.integration.test.ts` for SolidJS integration
3. **Feature Tests**: Create new test files for specific features (like `images-actions.test.ts`)

### Test Structure Template
```typescript
describe('New Feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup mocks
  });

  it('should handle normal case', () => {
    // Test implementation
  });

  it('should handle error case', () => {
    // Test error scenarios
  });

  it('should cleanup properly', () => {
    // Test cleanup/unmount
  });
});
```

## Debugging Tests

For debugging failing tests:

```bash
# Run with verbose output
bun test --reporter=verbose

# Run single test with debugging
bun test --reporter=verbose src/lib/__tests__/convex.test.ts -t "specific test name"

# Enable console logs in tests
// Remove console mocking in setup.ts temporarily
```

## Continuous Integration

These tests are designed to run in CI environments and provide:
- Fast execution with comprehensive mocking
- Deterministic results with controlled timing
- Clear error messages for debugging failures
- Coverage reporting for code quality metrics