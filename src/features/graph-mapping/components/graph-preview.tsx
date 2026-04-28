import ReactFlow, { Background, Controls, MiniMap, type Edge, type Node } from '@xyflow/react'

type GraphPreviewProps = {
  nodes: Node[]
  edges: Edge[]
}

export function GraphPreview({ nodes, edges }: GraphPreviewProps) {
  return (
    <div className='h-[520px]'>
      <ReactFlow nodes={nodes} edges={edges}>
        <Controls />
        <MiniMap />
        <Background />
      </ReactFlow>
    </div>
  )
}
