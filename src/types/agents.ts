/**
 * Comprehensive type definitions for the Agent system
 * Eliminates 'any' types and provides proper TypeScript interfaces
 */

import type { Id } from '../../convex/_generated/dataModel';

// Base agent types from schema
export type AgentStatus = 'idle' | 'processing' | 'success' | 'failed';
export type AgentModel = 'normal' | 'pro';
export type AgentType = 'image-generate' | 'image-edit' | 'voice-generate' | 'video-generate';

// Voice-specific types
export type VoiceOption = 'Aurora' | 'Blade' | 'Britney' | 'Carl' | 'Cliff' | 'Richard' | 'Rico' | 'Siobhan' | 'Vicky';

// Core agent interface matching Convex schema
export interface AgentData {
    _id: Id<'agents'>;
    _creationTime: number;
    canvasId: Id<'canvases'>;
    userId: string;
    userName?: string;
    prompt: string;
    positionX: number;
    positionY: number;
    width: number;
    height: number;
    imageUrl?: string;
    audioUrl?: string;
    videoUrl?: string;
    voice?: VoiceOption;
    audioSampleUrl?: string;
    requestId?: string;
    model: AgentModel;
    status: AgentStatus;
    type: AgentType;
    connectedAgentId?: Id<'agents'>;
    uploadedImageUrl?: string;
    activeImageUrl?: string;
    createdAt: number;
    updatedAt: number;
}

// Frontend agent class interface (matches current Agent class)
export interface Agent {
    id: string;
    userId: string;
    userName?: string;
    prompt: string;
    position: {
        x: number;
        y: number;
    };
    size: {
        width: number;
        height: number;
    };
    generatedImage: string;
    generatedAudio?: string;
    generatedVideo?: string;
    voice?: VoiceOption;
    audioSampleUrl?: string;
    requestId?: string;
    status: AgentStatus;
    model: AgentModel;
    type: AgentType;
    connectedAgentId?: string;
    uploadedImageUrl?: string;
    activeImageUrl?: string;
    _version: number;
}

// Agent connection interface
export interface AgentConnection {
    source: Agent;
    target: Agent;
}

// Agent creation parameters
export interface CreateAgentParams {
    canvasId: Id<'canvases'>;
    userId: string;
    userName?: string;
    prompt: string;
    positionX: number;
    positionY: number;
    width: number;
    height: number;
    model?: AgentModel;
    type?: AgentType;
    connectedAgentId?: Id<'agents'>;
    uploadedImageUrl?: string;
}

// Agent update parameters (all optional except ID)
export interface UpdateAgentParams {
    agentId: Id<'agents'>;
    prompt?: string;
    positionX?: number;
    positionY?: number;
    width?: number;
    height?: number;
    imageUrl?: string;
    model?: AgentModel;
    status?: AgentStatus;
    type?: AgentType;
    connectedAgentId?: Id<'agents'>;
    uploadedImageUrl?: string;
    activeImageUrl?: string;
}

// Agent transform parameters (position and size)
export interface AgentTransformParams {
    agentId: Id<'agents'>;
    positionX: number;
    positionY: number;
    width: number;
    height: number;
}

// Agent connection parameters
export interface ConnectAgentsParams {
    sourceAgentId: Id<'agents'>;
    targetAgentId: Id<'agents'>;
}

// Agent query result types
export interface AgentQueryResult {
    data: AgentData[] | undefined;
    isLoading: boolean;
    error: Error | null;
}

export interface SingleAgentQueryResult {
    data: AgentData | null | undefined;
    isLoading: boolean;
    error: Error | null;
}

// Agent state validation types
export interface AgentStatusTransition {
    from: AgentStatus;
    to: AgentStatus;
    allowed: boolean;
    reason?: string;
}

export interface AgentConnectionRule {
    sourceType: AgentType;
    targetType: AgentType;
    allowed: boolean;
    reason?: string;
}

// Available agents for connection (simplified)
export interface AvailableAgent {
    id: string;
    prompt: string;
    imageUrl: string;
    type: AgentType;
}

// Agent metrics and statistics
export interface AgentMetrics {
    totalAgents: number;
    agentsByType: Record<AgentType, number>;
    agentsByStatus: Record<AgentStatus, number>;
    agentsByModel: Record<AgentModel, number>;
    connections: number;
}

// Type guards for runtime validation
export function isAgentData(obj: unknown): obj is AgentData {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        typeof (obj as AgentData)._id === 'string' &&
        typeof (obj as AgentData).canvasId === 'string' &&
        typeof (obj as AgentData).userId === 'string' &&
        (typeof (obj as AgentData).userName === 'string' || typeof (obj as AgentData).userName === 'undefined') &&
        typeof (obj as AgentData).prompt === 'string' &&
        typeof (obj as AgentData).positionX === 'number' &&
        typeof (obj as AgentData).positionY === 'number' &&
        ['idle', 'processing', 'success', 'failed'].includes((obj as AgentData).status) &&
        ['normal', 'pro'].includes((obj as AgentData).model) &&
        ['image-generate', 'image-edit', 'voice-generate', 'video-generate'].includes((obj as AgentData).type)
    );
}

export function isValidAgentStatus(status: string): status is AgentStatus {
    return ['idle', 'processing', 'success', 'failed'].includes(status);
}

export function isValidAgentModel(model: string): model is AgentModel {
    return ['normal', 'pro'].includes(model);
}

export function isValidAgentType(type: string): type is AgentType {
    return ['image-generate', 'image-edit', 'voice-generate', 'video-generate'].includes(type);
}

// Utility functions for agent operations
export function agentDataToAgent(agentData: AgentData): Agent {
    return {
        id: agentData._id,
        userId: agentData.userId,
        userName: agentData.userName,
        prompt: agentData.prompt,
        position: {
            x: agentData.positionX,
            y: agentData.positionY,
        },
        size: {
            width: agentData.width,
            height: agentData.height,
        },
        generatedImage: agentData.imageUrl || '',
        generatedAudio: agentData.audioUrl,
        generatedVideo: agentData.videoUrl,
        voice: agentData.voice,
        audioSampleUrl: agentData.audioSampleUrl,
        requestId: agentData.requestId,
        status: agentData.status,
        model: agentData.model,
        type: agentData.type,
        connectedAgentId: agentData.connectedAgentId,
        uploadedImageUrl: agentData.uploadedImageUrl,
        activeImageUrl: agentData.activeImageUrl,
        _version: 0, // Reset version for frontend use
    };
}

export function createAgentMetrics(agents: AgentData[]): AgentMetrics {
    const metrics: AgentMetrics = {
        totalAgents: agents.length,
        agentsByType: { 'image-generate': 0, 'image-edit': 0, 'voice-generate': 0, 'video-generate': 0 },
        agentsByStatus: { idle: 0, processing: 0, success: 0, failed: 0 },
        agentsByModel: { normal: 0, pro: 0 },
        connections: 0,
    };

    agents.forEach(agent => {
        metrics.agentsByType[agent.type]++;
        metrics.agentsByStatus[agent.status]++;
        metrics.agentsByModel[agent.model]++;
        if (agent.connectedAgentId) {
            metrics.connections++;
        }
    });

    // Connections are bidirectional, so divide by 2
    metrics.connections = Math.floor(metrics.connections / 2);

    return metrics;
}
