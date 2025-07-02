/**
 * Agent validation utilities for state transitions and business rules
 */

import type { 
  AgentStatus, 
  AgentType, 
  AgentStatusTransition,
  AgentConnectionRule 
} from '~/types/agents';

// Valid agent status transitions
const VALID_STATUS_TRANSITIONS: AgentStatusTransition[] = [
  // From idle
  { from: 'idle', to: 'processing', allowed: true },
  { from: 'idle', to: 'idle', allowed: true }, // Allow staying idle
  
  // From processing
  { from: 'processing', to: 'success', allowed: true },
  { from: 'processing', to: 'failed', allowed: true },
  { from: 'processing', to: 'idle', allowed: false, reason: 'Cannot go from processing to idle without completing' },
  
  // From success
  { from: 'success', to: 'processing', allowed: true }, // Allow regeneration
  { from: 'success', to: 'idle', allowed: true }, // Allow reset
  { from: 'success', to: 'success', allowed: true }, // Allow staying success
  
  // From failed
  { from: 'failed', to: 'processing', allowed: true }, // Allow retry
  { from: 'failed', to: 'idle', allowed: true }, // Allow reset
  { from: 'failed', to: 'success', allowed: false, reason: 'Cannot go directly from failed to success' },
];

// Valid agent connection rules - explicit allow/deny list
const VALID_CONNECTION_RULES: AgentConnectionRule[] = [
  // ✅ ALLOWED CONNECTIONS
  
  // Generate agents can connect to edit agents (main workflow: generate → edit)
  { 
    sourceType: 'image-generate', 
    targetType: 'image-edit', 
    allowed: true 
  },
  
  // Edit agents can connect to other edit agents (chaining workflows)
  { 
    sourceType: 'image-edit', 
    targetType: 'image-edit', 
    allowed: true 
  },
  
  // ❌ FORBIDDEN CONNECTIONS
  
  // Edit agents should NOT connect to generate agents (wrong workflow direction)
  { 
    sourceType: 'image-edit', 
    targetType: 'image-generate', 
    allowed: false, 
    reason: 'Edit agents cannot connect to Generate agents. Workflow flows from Generate → Edit' 
  },
  
  // Generate agents should NOT connect to other generate agents (no use case)
  { 
    sourceType: 'image-generate', 
    targetType: 'image-generate', 
    allowed: false, 
    reason: 'Generate agents cannot connect to other Generate agents' 
  },
];

/**
 * Validate if a status transition is allowed
 */
export function validateStatusTransition(
  fromStatus: AgentStatus, 
  toStatus: AgentStatus
): { allowed: boolean; reason?: string } {
  const transition = VALID_STATUS_TRANSITIONS.find(
    t => t.from === fromStatus && t.to === toStatus
  );
  
  if (!transition) {
    return { 
      allowed: false, 
      reason: `Invalid transition from ${fromStatus} to ${toStatus}` 
    };
  }
  
  return { 
    allowed: transition.allowed, 
    reason: transition.reason 
  };
}

/**
 * Validate if an agent connection is allowed
 */
export function validateAgentConnection(
  sourceType: AgentType, 
  targetType: AgentType
): { allowed: boolean; reason?: string } {
  const rule = VALID_CONNECTION_RULES.find(
    r => r.sourceType === sourceType && r.targetType === targetType
  );
  
  if (!rule) {
    return { 
      allowed: false, 
      reason: `No connection rule defined for ${sourceType} → ${targetType}` 
    };
  }
  
  return { 
    allowed: rule.allowed, 
    reason: rule.reason 
  };
}

/**
 * Get all valid status transitions from a given status
 */
export function getValidStatusTransitions(fromStatus: AgentStatus): AgentStatus[] {
  return VALID_STATUS_TRANSITIONS
    .filter(t => t.from === fromStatus && t.allowed)
    .map(t => t.to);
}

/**
 * Get all valid target types for connections from a given agent type
 */
export function getValidConnectionTargets(sourceType: AgentType): AgentType[] {
  return VALID_CONNECTION_RULES
    .filter(r => r.sourceType === sourceType && r.allowed)
    .map(r => r.targetType);
}

/**
 * Check if an agent can currently transition to processing status
 * (useful for UI to disable/enable generate buttons)
 */
export function canStartProcessing(currentStatus: AgentStatus): boolean {
  return validateStatusTransition(currentStatus, 'processing').allowed;
}

/**
 * Check if an agent type can connect to another agent type
 */
export function canConnectAgentTypes(sourceType: AgentType, targetType: AgentType): boolean {
  return validateAgentConnection(sourceType, targetType).allowed;
}

/**
 * Validation error class for agent operations
 */
export class AgentValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'AgentValidationError';
  }
}

/**
 * Create a validation error for status transitions
 */
export function createStatusTransitionError(
  fromStatus: AgentStatus, 
  toStatus: AgentStatus,
  reason?: string
): AgentValidationError {
  return new AgentValidationError(
    `Invalid status transition from ${fromStatus} to ${toStatus}${reason ? `: ${reason}` : ''}`,
    'INVALID_STATUS_TRANSITION',
    { fromStatus, toStatus, reason }
  );
}

/**
 * Create a validation error for agent connections
 */
export function createConnectionValidationError(
  sourceType: AgentType, 
  targetType: AgentType,
  reason?: string
): AgentValidationError {
  return new AgentValidationError(
    `Invalid agent connection from ${sourceType} to ${targetType}${reason ? `: ${reason}` : ''}`,
    'INVALID_AGENT_CONNECTION',
    { sourceType, targetType, reason }
  );
}
