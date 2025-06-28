/**
 * Renders a visual connection line between two agents
 * Shows the data flow from one agent to another with an arrow and source indicator
 */

export interface AgentConnectionProps { 
  sourcePosition: { x: number; y: number };
  targetPosition: { x: number; y: number };
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  sourceId: string;
  targetId: string;
}

export function AgentConnection(props: AgentConnectionProps) {
  const markerId = `arrowhead-${props.sourceId}-${props.targetId}`;
  
  return (
    <svg 
      class="absolute top-0 left-0 w-full h-full pointer-events-none z-0" 
      style={{ "overflow": "visible" }}
    >
      <defs>
        <marker
          id={markerId}
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
        </marker>
      </defs>
      <line
        x1={props.sourcePosition.x + props.sourceWidth / 2}
        y1={props.sourcePosition.y + props.sourceHeight / 2}
        x2={props.targetPosition.x + props.targetWidth / 2}
        y2={props.targetPosition.y + props.targetHeight / 2}
        stroke="currentColor"
        stroke-width="2"
        stroke-dasharray="4"
        class="text-blue-500"
        marker-end={`url(#${markerId})`}
      />
      <circle
        cx={props.sourcePosition.x + props.sourceWidth / 2}
        cy={props.sourcePosition.y + props.sourceHeight / 2}
        r="4"
        class="fill-blue-500"
      />
    </svg>
  );
} 