import { useCallback } from 'react'
import ReactFlow, {
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

type GraphPreviewProps = {
  generatedNodes: Node[]
  generatedEdges: Edge[]
  onNodesUpdate?: (nodes: Node[]) => void
}

export function GraphPreview({ generatedNodes, generatedEdges, onNodesUpdate }: GraphPreviewProps) {
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const nextNodes = applyNodeChanges(changes, generatedNodes)
      onNodesUpdate?.(nextNodes)
    },
    [generatedNodes, onNodesUpdate]
  )

  return (
    <div className='w-full overflow-x-auto rounded-md border'>
      <div className='h-[600px] min-w-[1000px]'>
        <ReactFlow
          nodes={generatedNodes}
          edges={generatedEdges}
          onNodesChange={onNodesChange}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  )
}
