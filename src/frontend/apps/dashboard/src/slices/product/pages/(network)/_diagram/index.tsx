import { useMemo } from 'react';
import { RiShieldCheckLine } from '@remixicon/react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import styled from 'styled-components';

let GRID_LAYOUT = {
  originX: 420,
  originY: 90,
  colWidth: 420,
  rowHeight: 130
};

let HIGHLIGHT_COLORS: Record<string, string> = {
  gateway: '#fd9644',
  protoguard: '#f7b731',
  firewall: '#a55eea',
  runtime: '#0099ff',
  platform: '#20bf6b',
  vault: '#7d8597'
};

let getNodeWidth = (kind: string) => (kind === 'runtime' ? 520 : 280);

let getNodeHeight = (kind: string) => {
  if (kind === 'runtime') return 128;
  if (kind === 'platform') return 112;
  return 84;
};

let getDiagramNetworks = (p: { ipAddress: string; region: string; apiHost: string }) => [
  {
    id: 'metorial-network-eu1',
    components: [
      {
        id: 'gateway',
        kind: 'gateway',
        row: 0,
        col: 0,
        name: 'Magic Gateway',
        scope: 'Global',
        ipAddress: p.ipAddress
      },
      {
        id: 'firewall',
        kind: 'firewall',
        row: 1,
        col: 0,
        name: 'Magic Firewall',
        scope: p.region
      },
      {
        id: 'runtime',
        kind: 'runtime',
        row: 2,
        col: 0,
        name: 'Metorial Runtime',
        scope: p.region,
        enclaves: [1, 2, 3, 4, 5]
      },
      {
        id: 'protoguard',
        kind: 'protoguard',
        row: 1,
        col: 1,
        name: 'Protoguard',
        scope: p.region
      },
      {
        id: 'vault',
        kind: 'vault',
        row: 2,
        col: 1,
        yOffset: -45,
        name: 'Metorial Vault',
        scope: p.region
      }
    ],
    platform: {
      name: 'Metorial Platform',
      scope: p.apiHost,
      footer: 'Control Plane',
      controllers: [1, 2, 3, 4, 5]
    },
    connections: [
      { source: 'gateway', target: 'firewall' },
      { source: 'firewall', target: 'runtime' },
      { source: 'firewall', target: 'protoguard' },
      { source: 'vault', target: 'runtime', sourceHandle: 'out-bottom' }
    ]
  }
];

let getEdgeHandles = (sourceComponent: any, targetComponent: any) => {
  let rowDiff = targetComponent.row - sourceComponent.row;
  let colDiff = targetComponent.col - sourceComponent.col;

  if (Math.abs(colDiff) > Math.abs(rowDiff)) {
    if (colDiff >= 0) return { sourceHandle: 'out-right', targetHandle: 'in-left' };
    return { sourceHandle: 'out-left', targetHandle: 'in-right' };
  }

  if (rowDiff >= 0) return { sourceHandle: 'out-bottom', targetHandle: 'in-top' };
  return { sourceHandle: 'out-top', targetHandle: 'in-bottom' };
};

let buildFlowFromNetwork = (
  network: ReturnType<typeof getDiagramNetworks>[number],
  xOffset = 0,
  yOffset = 0
) => {
  let byId = new Map(network.components.map(component => [component.id, component]));
  let positionedComponents = network.components.map(component => ({
    ...component,
    x: GRID_LAYOUT.originX + component.col * GRID_LAYOUT.colWidth + xOffset,
    y:
      GRID_LAYOUT.originY +
      component.row * GRID_LAYOUT.rowHeight +
      (component.yOffset ?? 0) +
      yOffset
  }));

  let managedComponents = positionedComponents.filter(
    component => component.kind !== 'platform'
  );
  let managedLeft = Math.min(
    ...managedComponents.map(component => component.x - getNodeWidth(component.kind) / 2)
  );
  let managedRight = Math.max(
    ...managedComponents.map(component => component.x + getNodeWidth(component.kind) / 2)
  );
  let managedTop = Math.min(...managedComponents.map(component => component.y));
  let managedBottom = Math.max(
    ...managedComponents.map(component => component.y + getNodeHeight(component.kind))
  );
  let zonePaddingX = 36;
  let zonePaddingTop = 56;
  let zonePaddingBottom = 24;
  let zoneWidth = managedRight - managedLeft + zonePaddingX * 2;
  let zoneHeight = managedBottom - managedTop + zonePaddingTop + zonePaddingBottom;
  let platformHeight = getNodeHeight('platform');
  let platformX = (managedLeft + managedRight) / 2;
  let platformY = managedTop - platformHeight - 104;

  let nodes = [
    {
      id: `${network.id}-managed-zone`,
      type: 'managedZone',
      draggable: false,
      selectable: false,
      zIndex: -1,
      position: { x: (managedLeft + managedRight) / 2, y: managedTop - zonePaddingTop },
      style: { width: zoneWidth, height: zoneHeight },
      data: { label: 'Metorial Magic Network' }
    },
    {
      id: `${network.id}-platform`,
      type: 'infrastructure',
      draggable: false,
      selectable: false,
      position: { x: platformX, y: platformY },
      data: {
        kind: 'platform',
        name: network.platform.name,
        scope: network.platform.scope,
        controllers: network.platform.controllers,
        footer: network.platform.footer,
        width: zoneWidth
      }
    },
    ...positionedComponents.map(component => ({
      id: `${network.id}-${component.id}`,
      type: 'infrastructure',
      draggable: false,
      selectable: false,
      position: { x: component.x, y: component.y },
      data: { ...component }
    }))
  ];

  let edgeBase = {
    animated: true,
    className: 'traffic-edge',
    markerEnd: { type: MarkerType.ArrowClosed, color: '#999999' },
    style: { strokeWidth: 1.75, stroke: '#999999' },
    type: 'smoothstep'
  };

  let edges = network.connections.map(connection => {
    let sourceComponent = byId.get(connection.source);
    let targetComponent = byId.get(connection.target);
    let handles = getEdgeHandles(sourceComponent, targetComponent);

    return {
      ...edgeBase,
      id: `${network.id}-${connection.source}-${connection.target}`,
      source: `${network.id}-${connection.source}`,
      target: `${network.id}-${connection.target}`,
      sourceHandle: connection.sourceHandle ?? handles.sourceHandle,
      targetHandle: (connection as any).targetHandle ?? handles.targetHandle
    };
  });

  let controlEdge = {
    id: `${network.id}-control-platform-network`,
    source: `${network.id}-platform`,
    target: `${network.id}-managed-zone`,
    sourceHandle: 'out-bottom',
    targetHandle: 'in-top',
    className: 'control-edge',
    markerEnd: { type: MarkerType.ArrowClosed, color: '#888888' },
    style: { stroke: '#888888', strokeWidth: 1.75 },
    animated: true,
    type: 'smoothstep'
  };

  return { nodes, edges: [...edges, controlEdge] };
};

let hiddenHandleStyle = {
  width: 1,
  height: 1,
  opacity: 0,
  border: 'none',
  background: 'transparent'
};

let InfrastructureNode = ({ data }: { data: any }) => (
  <NodeCard $kind={data.kind} $width={data.width}>
    <Handle type="target" id="in-top" position={Position.Top} />
    <Handle type="target" id="in-right" position={Position.Right} />
    <Handle type="target" id="in-bottom" position={Position.Bottom} />
    <Handle type="target" id="in-left" position={Position.Left} />
    <Handle type="source" id="out-top" position={Position.Top} />
    <Handle type="source" id="out-right" position={Position.Right} />
    <Handle type="source" id="out-bottom" position={Position.Bottom} />
    <Handle type="source" id="out-left" position={Position.Left} />
    <NodeHeader $hasBadge={data.kind === 'gateway'}>
      <NodeIcon $kind={data.kind} />
      <div>
        <NodeTitle>{data.name}</NodeTitle>
        {data.scope && <NodeScope>{data.scope}</NodeScope>}
      </div>
      {data.kind === 'runtime' && (
        <EnclaveWrap aria-label="Runtime enclaves">
          {data.enclaves.map((_: unknown, index: number) => (
            <Enclave key={`enclave-${index}`} $tone="runtime" aria-hidden="true" />
          ))}
        </EnclaveWrap>
      )}
      {data.kind === 'platform' && (
        <EnclaveWrap aria-label="Platform controllers">
          {data.controllers.map((_: unknown, index: number) => (
            <Enclave key={`controller-${index}`} $tone="platform" aria-hidden="true" />
          ))}
        </EnclaveWrap>
      )}
      {data.kind === 'gateway' && <IpBadge aria-label="Gateway IP">{data.ipAddress}</IpBadge>}
    </NodeHeader>
    {data.kind === 'runtime' && (
      <RuntimeFooter>
        <span>Auto Scaling</span>
        <span>Metorial Enclaves</span>
      </RuntimeFooter>
    )}
    {data.kind === 'platform' && <PlatformFooter>{data.footer}</PlatformFooter>}
  </NodeCard>
);

let ManagedZoneNode = ({ data }: { data: any }) => (
  <ManagedZoneWrap>
    <Handle type="target" id="in-top" position={Position.Top} style={hiddenHandleStyle} />
    <ManagedZone>{data.label}</ManagedZone>
  </ManagedZoneWrap>
);

let nodeTypes = {
  infrastructure: InfrastructureNode,
  managedZone: ManagedZoneNode
};

export let NetworkDiagram = (p: { ipAddress: string; region: string; apiHost: string }) => {
  let { nodes, edges } = useMemo(() => {
    let networks = getDiagramNetworks(p);

    return networks.reduce(
      (acc, network, index) => {
        let built = buildFlowFromNetwork(network, 0, index * 460);
        acc.nodes.push(...(built.nodes as any));
        acc.edges.push(...(built.edges as any));
        return acc;
      },
      { nodes: [] as any[], edges: [] as any[] }
    );
  }, [p]);

  return (
    <CanvasFrame>
      <LegendBar>
        <StatusPill>Production</StatusPill>
        <StatusPill>{p.region}</StatusPill>
      </LegendBar>
      <RightLegendBar>
        <StatusPill $tone="green" aria-label="Protected">
          <RiShieldCheckLine />
          Operating Normally
        </StatusPill>
      </RightLegendBar>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        proOptions={{ hideAttribution: true }}
        nodeOrigin={[0.5, 0]}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
      >
        <Background variant={BackgroundVariant.Dots} color="#b6b6b6" size={1.5} gap={18} />
      </ReactFlow>
    </CanvasFrame>
  );
};

let LegendBar = styled.div`
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 5;
  display: flex;
  gap: 10px;
  pointer-events: none;
`;

let RightLegendBar = styled(LegendBar)`
  left: auto;
  right: 12px;
`;

let StatusPill = styled.span<{ $tone?: 'green' }>`
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: ${({ $tone }) => ($tone === 'green' ? '#15803d' : '#374151')};
  background: ${({ $tone }) => ($tone === 'green' ? '#f0fdf4' : '#f8f8f8')};
  border: 1px solid ${({ $tone }) => ($tone === 'green' ? '#86efac' : '#d4d4d8')};

  ${({ $tone }) =>
    $tone === 'green'
      ? `
    &::before {
      content: '';
      position: absolute;
      inset: -4px;
      z-index: -1;
      border-radius: inherit;
      border: 1px solid #22c55e;
      animation: green-ripple 1.8s ease-out infinite;
    }
  `
      : ''}

  > svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
`;

let CanvasFrame = styled.section`
  width: 100%;
  height: 640px;
  position: relative;
  border: 0.5px solid #d4d4d8;
  border-radius: 16px;
  overflow: hidden;
  background: #fbfbfb;

  .react-flow__edge.traffic-edge .react-flow__edge-path,
  .react-flow__edge.control-edge .react-flow__edge-path {
    stroke-dasharray: 8 10;
    animation: dash-traffic 0.75s linear infinite;
  }

  @keyframes dash-traffic {
    to {
      stroke-dashoffset: -18;
    }
  }

  @keyframes green-ripple {
    0% {
      opacity: 0.45;
      transform: scale(1);
    }

    100% {
      opacity: 0;
      transform: scale(1.18);
    }
  }
`;

let NodeCard = styled.article<{ $kind: string; $width?: number }>`
  width: ${({ $width, $kind }) => ($width ? `${$width}px` : `${getNodeWidth($kind)}px`)};
  border-radius: 14px;
  border: 0.5px solid #d4d4d8;
  background: linear-gradient(
    to bottom,
    ${({ $kind }) => HIGHLIGHT_COLORS[$kind] ?? '#a1a1aa'} 0 3px,
    #ffffff 3px
  );
  box-shadow:
    0 8px 20px rgba(31, 41, 55, 0.08),
    0 0 0 1px ${({ $kind }) => `${HIGHLIGHT_COLORS[$kind] ?? '#a1a1aa'}22`} inset;
  padding: 14px;
  position: relative;
  overflow: visible;

  .react-flow__handle {
    width: 1px;
    height: 1px;
    opacity: 0;
    border: none;
    background: transparent;
  }
`;

let ManagedZoneWrap = styled.div`
  width: 100%;
  height: 100%;
`;

let ManagedZone = styled.div`
  width: 100%;
  height: 100%;
  border: 1px dashed #0099ff;
  border-radius: 18px;
  background: #0099ff0d;
  color: #0d6fb8;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.01em;
  padding: 8px 12px;
  pointer-events: none;
`;

let NodeHeader = styled.div<{ $hasBadge?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding-right: ${({ $hasBadge }) => ($hasBadge ? '100px' : '0')};
`;

let NodeIcon = styled.span<{ $kind: string }>`
  width: 28px;
  height: 28px;
  border-radius: 8px;
  flex-shrink: 0;
  background: ${({ $kind }) => `${HIGHLIGHT_COLORS[$kind] ?? '#a1a1aa'}22`};
  border: 1px solid ${({ $kind }) => HIGHLIGHT_COLORS[$kind] ?? '#a1a1aa'};
`;

let NodeTitle = styled.p`
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #27272a;
`;

let NodeScope = styled.p`
  margin: 2px 0 0;
  font-size: 12px;
  color: #71717a;
`;

let IpBadge = styled.span`
  position: absolute;
  top: -10px;
  right: -10px;
  z-index: 2;
  border-radius: 999px;
  border: 0.5px solid #a3a3a3;
  background: #ffffff;
  color: #52525b;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 700;
  box-shadow: 0 8px 12px rgba(31, 41, 55, 0.12);
`;

let EnclaveWrap = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
`;

let Enclave = styled.span<{ $tone: 'runtime' | 'platform' }>`
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 0.5px solid ${({ $tone }) => ($tone === 'platform' ? '#20bf6b' : '#0099ff')};
  background: ${({ $tone }) => ($tone === 'platform' ? '#20bf6b14' : '#0099ff14')};
  display: block;
`;

let RuntimeFooter = styled.div`
  margin: 12px -14px -14px;
  padding: 10px 14px;
  border-top: 0.5px solid #d4d4d8;
  background: #fafafa;
  border-radius: 0 0 14px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 11px;
  font-weight: 700;
  color: #52525b;
  letter-spacing: 0.02em;
`;

let PlatformFooter = styled.p`
  margin: 12px -14px -14px;
  padding: 10px 14px;
  border-top: 0.5px solid #d4d4d8;
  background: #fafafa;
  border-radius: 0 0 14px 14px;
  font-size: 11px;
  font-weight: 700;
  color: #52525b;
  letter-spacing: 0.02em;
  text-align: left;
`;
