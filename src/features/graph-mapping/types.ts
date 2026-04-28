import type { Edge, Node } from '@xyflow/react'

export type EntityValueNodeData = {
  label: string
  entity_id: string
  entity_name: string
  column: string
  value: string
  node_type: 'entity_value'
}

export type BuilderRoot = {
  entityId: string
  column: string
  value: string
  label: string
}

export type ChildLayer = {
  entityId: string
  column: string
  values: string[]
}

export type BuilderState = {
  root: BuilderRoot | null
  relatedEntityId: string
  relatedColumn: string
  relatedValues: string[]
  childrenByRelatedValue: Record<string, ChildLayer>
}

export type GraphNode = Node<EntityValueNodeData>
export type GraphEdge = Edge & { edge_type?: 'manual' }
