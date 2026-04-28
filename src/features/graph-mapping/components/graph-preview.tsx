import ReactFlow, {
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from '@xyflow/react'

type GraphPreviewProps = {
  nodes: Node[]
  edges: Edge[]
  onNodesUpdate?: (nodes: Node[]) => void
}

export function GraphPreview({ nodes, edges, onNodesUpdate }: GraphPreviewProps) {
  const [flowNodes, setFlowNodes] = useNodesState(nodes)
  const [flowEdges, , onEdgesChange] = useEdgesState(edges)

  return (
    <div className='min-h-[640px]'>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={(changes) => {
          setFlowNodes((current) => {
            const next = applyNodeChanges(changes, current)
            onNodesUpdate?.(next)
            return next
          })
        }}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background />
      </ReactFlow>
    </div>
  )
}
