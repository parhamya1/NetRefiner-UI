import { useCallback, useEffect } from 'react'
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

type GraphPreviewProps = {
  generatedNodes: Node[]
  generatedEdges: Edge[]
  onNodesUpdate?: (nodes: Node[]) => void
}

export function GraphPreview({ generatedNodes, generatedEdges, onNodesUpdate }: GraphPreviewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(generatedNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(generatedEdges)

  useEffect(() => {
    setNodes(generatedNodes)
  }, [generatedNodes, setNodes])

  useEffect(() => {
    setEdges(generatedEdges)
  }, [generatedEdges, setEdges])

  useEffect(() => {
    onNodesUpdate?.(nodes)
  }, [nodes, onNodesUpdate])

  const onConnect = useCallback(
    (connection: { source: string; target: string }) => {
      setEdges((eds) => addEdge({ ...connection, type: 'smoothstep' }, eds))
    },
    [setEdges]
  )

  return (
    <div className='h-[600px] w-full rounded-md border'>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}
