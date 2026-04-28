import { useCallback, useMemo, useRef, useState } from 'react'

export type Node<T = Record<string, unknown>> = {
  id: string
  position: { x: number; y: number }
  data: T
}

export type Edge = {
  id: string
  source: string
  target: string
  label?: string
}

export type Connection = {
  source: string
  target: string
}

export type NodeChange = {
  id: string
  type: 'position'
  position: { x: number; y: number }
}

export type EdgeChange = {
  id: string
  type: 'remove'
}

export function addEdge(connection: Connection, edges: Edge[]): Edge[] {
  return [
    ...edges,
    {
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      source: connection.source,
      target: connection.target,
    },
  ]
}

export function applyNodeChanges<T>(changes: NodeChange[], nodes: Node<T>[]): Node<T>[] {
  if (changes.length === 0) return nodes

  return nodes.map((node) => {
    const change = changes.find((item) => item.id === node.id)
    if (!change || change.type !== 'position') return node
    return { ...node, position: change.position }
  })
}

export function applyEdgeChanges(changes: EdgeChange[], edges: Edge[]): Edge[] {
  if (changes.length === 0) return edges
  const removedIds = new Set(changes.filter((change) => change.type === 'remove').map((change) => change.id))
  return edges.filter((edge) => !removedIds.has(edge.id))
}

export function useNodesState<T>(initialNodes: Node<T>[]): [
  Node<T>[],
  React.Dispatch<React.SetStateAction<Node<T>[]>>,
  (changes: NodeChange[]) => void,
] {
  const [nodes, setNodes] = useState<Node<T>[]>(initialNodes)
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((current) => applyNodeChanges(changes, current))
  }, [])

  return [nodes, setNodes, onNodesChange]
}

export function useEdgesState(initialEdges: Edge[]): [
  Edge[],
  React.Dispatch<React.SetStateAction<Edge[]>>,
  (changes: EdgeChange[]) => void,
] {
  const [edges, setEdges] = useState<Edge[]>(initialEdges)
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((current) => applyEdgeChanges(changes, current))
  }, [])

  return [edges, setEdges, onEdgesChange]
}

type ReactFlowProps = {
  nodes: Node[]
  edges: Edge[]
  onNodesChange?: (changes: NodeChange[]) => void
  onEdgesChange?: (changes: EdgeChange[]) => void
  onConnect?: (connection: Connection) => void
  children?: React.ReactNode
  fitView?: boolean
}

export default function ReactFlow({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  children,
}: ReactFlowProps) {
  void onEdgesChange
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [pendingSource, setPendingSource] = useState<string | null>(null)

  const nodesById = useMemo(() => {
    const map = new Map<string, Node>()
    nodes.forEach((node) => map.set(node.id, node))
    return map
  }, [nodes])

  function startDrag(event: React.MouseEvent, node: Node) {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    dragRef.current = {
      id: node.id,
      offsetX: event.clientX - rect.left - node.position.x,
      offsetY: event.clientY - rect.top - node.position.y,
    }
  }

  function handleMouseMove(event: React.MouseEvent) {
    if (!dragRef.current || !containerRef.current || !onNodesChange) return
    const rect = containerRef.current.getBoundingClientRect()
    const nextX = event.clientX - rect.left - dragRef.current.offsetX
    const nextY = event.clientY - rect.top - dragRef.current.offsetY
    onNodesChange([
      {
        id: dragRef.current.id,
        type: 'position',
        position: { x: Math.max(0, nextX), y: Math.max(0, nextY) },
      },
    ])
  }

  function handleMouseUp() {
    dragRef.current = null
  }

  function connectFrom(nodeId: string) {
    setPendingSource(nodeId)
  }

  function connectTo(nodeId: string) {
    if (!pendingSource || !onConnect || pendingSource === nodeId) {
      setPendingSource(null)
      return
    }
    onConnect({ source: pendingSource, target: nodeId })
    setPendingSource(null)
  }

  return (
    <div
      ref={containerRef}
      className='relative h-full w-full overflow-hidden rounded-md border bg-background'
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg className='pointer-events-none absolute inset-0 h-full w-full'>
        {edges.map((edge) => {
          const source = nodesById.get(edge.source)
          const target = nodesById.get(edge.target)
          if (!source || !target) return null
          const x1 = source.position.x + 180
          const y1 = source.position.y + 38
          const x2 = target.position.x
          const y2 = target.position.y + 38
          return (
            <line
              key={edge.id}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke='currentColor'
              strokeOpacity={0.5}
              strokeWidth={2}
            />
          )
        })}
      </svg>

      {nodes.map((node) => (
        <div
          key={node.id}
          className='absolute min-w-[180px] max-w-[260px] cursor-move whitespace-pre-wrap break-words rounded-md border bg-card p-3 text-xs leading-4 shadow-sm'
          style={{ left: node.position.x, top: node.position.y }}
          onMouseDown={(event) => startDrag(event, node)}
        >
          <button
            type='button'
            className='absolute -left-2 top-1/2 size-3 -translate-y-1/2 rounded-full border bg-muted'
            onClick={(event) => {
              event.stopPropagation()
              connectTo(node.id)
            }}
            aria-label='Connect target'
          />
          <button
            type='button'
            className='absolute -right-2 top-1/2 size-3 -translate-y-1/2 rounded-full border bg-muted'
            onClick={(event) => {
              event.stopPropagation()
              connectFrom(node.id)
            }}
            aria-label='Connect source'
          />
          {String(node.data.label ?? node.id)}
        </div>
      ))}

      {pendingSource ? (
        <div className='absolute right-2 top-2 rounded bg-muted px-2 py-1 text-xs'>
          Connecting from {pendingSource}
        </div>
      ) : null}

      {children}
    </div>
  )
}

export function Controls() {
  return <div className='absolute right-2 top-2 rounded border bg-background px-2 py-1 text-xs'>Controls</div>
}

export function Background() {
  return null
}

export function MiniMap() {
  return <div className='absolute bottom-2 right-2 rounded border bg-background px-2 py-1 text-xs'>MiniMap</div>
}
