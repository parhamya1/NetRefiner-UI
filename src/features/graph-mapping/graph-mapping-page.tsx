import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { toast } from 'sonner'
import { getEntities } from '@/lib/api/entities'
import {
  createGraphMapping,
  deleteGraphMapping,
  getGraphMapping,
  getGraphMappings,
  updateGraphMapping,
} from '@/lib/api/graph-mappings'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { GraphMappingEdge, GraphMappingNode, GraphMappingPayload } from '@/types/api'
import { GraphPreview } from './components/graph-preview'
import { MappingList } from './components/mapping-list'
import { RelationshipBuilder } from './components/relationship-builder'
import type { BuilderState, GraphEdge, GraphNode } from './types'

const EMPTY_BUILDER: BuilderState = {
  root: null,
  relatedEntityId: '',
  relatedColumn: '',
  relatedValues: [],
  childrenByRelatedValue: {},
}

function makeNodeId(entityId: string, column: string, value: string) {
  return `${entityId}::${column}::${value}`
}

function buildGeneratedGraph(
  builder: BuilderState,
  entityNameById: Map<string, string>
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (!builder.root) return { nodes: [], edges: [] }

  const rootId = makeNodeId(builder.root.entityId, builder.root.column, builder.root.value)
  const nodes: GraphNode[] = [
    {
      id: rootId,
      position: { x: 0, y: 120 },
      data: {
        label: builder.root.label,
        entity_id: builder.root.entityId,
        entity_name: entityNameById.get(builder.root.entityId) ?? 'Entity',
        column: builder.root.column,
        value: builder.root.value,
        node_type: 'entity_value',
      },
    },
  ]
  const edges: GraphEdge[] = []

  builder.relatedValues.forEach((relatedValue, relatedIndex) => {
    const relatedId = makeNodeId(builder.relatedEntityId, builder.relatedColumn, relatedValue)
    nodes.push({
      id: relatedId,
      position: { x: 300, y: 40 + relatedIndex * 120 },
      data: {
        label: relatedValue,
        entity_id: builder.relatedEntityId,
        entity_name: entityNameById.get(builder.relatedEntityId) ?? 'Entity',
        column: builder.relatedColumn,
        value: relatedValue,
        node_type: 'entity_value',
      },
    })

    edges.push({
      id: `edge-${rootId}-${relatedId}`,
      source: rootId,
      target: relatedId,
      label: '',
      edge_type: 'manual',
    })

    const childLayer = builder.childrenByRelatedValue[relatedValue]
    if (!childLayer) return
    childLayer.values.forEach((childValue, childIndex) => {
      const childId = makeNodeId(childLayer.entityId, childLayer.column, `${relatedValue}:${childValue}`)
      nodes.push({
        id: childId,
        position: { x: 600, y: 20 + relatedIndex * 120 + childIndex * 50 },
        data: {
          label: childValue,
          entity_id: childLayer.entityId,
          entity_name: entityNameById.get(childLayer.entityId) ?? 'Entity',
          column: childLayer.column,
          value: childValue,
          node_type: 'entity_value',
        },
      })
      edges.push({
        id: `edge-${relatedId}-${childId}`,
        source: relatedId,
        target: childId,
        label: '',
        edge_type: 'manual',
      })
    })
  })

  return { nodes, edges }
}

function tryHydrateBuilder(mappingNodes: GraphNode[], mappingEdges: GraphEdge[]): BuilderState | null {
  const incoming = new Map<string, number>()
  mappingEdges.forEach((edge) => {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1)
  })
  const rootNode = mappingNodes.find((node) => !incoming.has(node.id))
  if (!rootNode) return null

  const outgoingFromRoot = mappingEdges.filter((edge) => edge.source === rootNode.id)
  const relatedValues: string[] = []
  const childrenByRelatedValue: BuilderState['childrenByRelatedValue'] = {}

  outgoingFromRoot.forEach((edge) => {
    const relatedNode = mappingNodes.find((node) => node.id === edge.target)
    if (!relatedNode) return
    relatedValues.push(relatedNode.data.value)
    const childEdges = mappingEdges.filter((item) => item.source === relatedNode.id)
    if (childEdges.length === 0) return
    const childNodes = childEdges
      .map((item) => mappingNodes.find((node) => node.id === item.target))
      .filter((item): item is GraphNode => !!item)

    if (childNodes.length === 0) return
    childrenByRelatedValue[relatedNode.data.value] = {
      entityId: childNodes[0].data.entity_id,
      column: childNodes[0].data.column,
      values: childNodes.map((item) => item.data.value),
    }
  })

  return {
    root: {
      entityId: rootNode.data.entity_id,
      column: rootNode.data.column,
      value: rootNode.data.value,
      label: rootNode.data.label,
    },
    relatedEntityId: outgoingFromRoot.length > 0
      ? mappingNodes.find((node) => node.id === outgoingFromRoot[0].target)?.data.entity_id ?? ''
      : '',
    relatedColumn: outgoingFromRoot.length > 0
      ? mappingNodes.find((node) => node.id === outgoingFromRoot[0].target)?.data.column ?? ''
      : '',
    relatedValues,
    childrenByRelatedValue,
  }
}

export function GraphMappingPage() {
  const [selectedMappingId, setSelectedMappingId] = useState<string | null>(null)
  const [mappingName, setMappingName] = useState('')
  const [mappingDescription, setMappingDescription] = useState('')
  const [builder, setBuilder] = useState<BuilderState>(EMPTY_BUILDER)
  const [loadedGraph, setLoadedGraph] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null)
  const [builderHydrated, setBuilderHydrated] = useState(true)
  const [focusNameTick, setFocusNameTick] = useState(0)

  const mappingsQuery = useQuery({
    queryKey: ['graph-mappings', 'list'],
    queryFn: getGraphMappings,
  })

  const entitiesQuery = useQuery({
    queryKey: ['graph-mappings', 'entities'],
    queryFn: getEntities,
  })

  const entityNameById = useMemo(() => {
    const map = new Map<string, string>()
    ;(entitiesQuery.data ?? []).forEach((entity) => map.set(entity.id, entity.name))
    return map
  }, [entitiesQuery.data])

  const generatedGraph = useMemo(
    () => buildGeneratedGraph(builder, entityNameById),
    [builder, entityNameById]
  )

  const previewGraph = builderHydrated ? generatedGraph : loadedGraph ?? { nodes: [], edges: [] }
  const hasMinimumBuilderSelections = Boolean(
    builder.root &&
    builder.relatedValues.length > 0 &&
    generatedGraph.nodes.length > 0 &&
    generatedGraph.edges.length > 0
  )

  function toPersistedNodes(nodes: GraphNode[]): GraphMappingNode[] {
    return nodes.map((node) => ({
      id: node.id,
      entity_id: node.data.entity_id,
      column: node.data.column,
      value: node.data.value,
      label: node.data.label,
      node_type: 'entity_value',
      position: node.position,
    }))
  }

  function toPersistedEdges(edges: GraphEdge[]): GraphMappingEdge[] {
    return edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label ?? null,
      edge_type: 'manual',
    }))
  }

  function toPreviewNodes(nodes: GraphMappingNode[]): GraphNode[] {
    return nodes.map((node) => ({
      id: node.id,
      position: node.position,
      data: {
        label: node.label,
        entity_id: node.entity_id,
        entity_name: entityNameById.get(node.entity_id) ?? 'Entity',
        column: node.column,
        value: node.value,
        node_type: 'entity_value',
      },
    }))
  }

  function toPreviewEdges(edges: GraphMappingEdge[]): GraphEdge[] {
    return edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label ?? '',
      edge_type: 'manual',
    }))
  }

  const openMutation = useMutation({
    mutationFn: async (mappingId: string) => getGraphMapping(mappingId),
    onSuccess: (mapping) => {
      setSelectedMappingId(mapping.id)
      setMappingName(mapping.name)
      setMappingDescription(mapping.description ?? '')

      const previewNodes = toPreviewNodes(mapping.nodes as GraphMappingNode[])
      const previewEdges = toPreviewEdges(mapping.edges as GraphMappingEdge[])
      const hydrated = tryHydrateBuilder(previewNodes, previewEdges)
      if (hydrated) {
        setBuilder(hydrated)
        setBuilderHydrated(true)
        setLoadedGraph(null)
      } else {
        setBuilder(EMPTY_BUILDER)
        setBuilderHydrated(false)
        setLoadedGraph({
          nodes: previewNodes,
          edges: previewEdges,
        })
      }
    },
    onError: () => toast.error('Failed to open mapping.'),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (mappingName.trim().length === 0) {
        throw new Error('Mapping name is required before saving.')
      }
      if (builderHydrated && !hasMinimumBuilderSelections) {
        throw new Error('Choose root and at least one related value before saving.')
      }

      const payload: GraphMappingPayload = {
        name: mappingName.trim(),
        description: mappingDescription.trim() || undefined,
        nodes: toPersistedNodes(previewGraph.nodes),
        edges: toPersistedEdges(previewGraph.edges),
      }
      // eslint-disable-next-line no-console
      console.log('GRAPH MAPPING SAVE PAYLOAD', payload)

      if (selectedMappingId) {
        return updateGraphMapping(selectedMappingId, payload)
      }
      return createGraphMapping(payload)
    },
    onSuccess: async (result) => {
      toast.success('Graph mapping saved.')
      setSelectedMappingId(result.id)
      await mappingsQuery.refetch()
    },
    onError: (error) => {
      const axiosError = error as AxiosError<{ detail?: unknown }>
      // eslint-disable-next-line no-console
      console.log('GRAPH MAPPING SAVE ERROR', axiosError.response?.data ?? error)
      const detail = axiosError.response?.data?.detail ?? axiosError.response?.data
      toast.error(detail ? JSON.stringify(detail, null, 2) : error instanceof Error ? error.message : 'Failed to save mapping.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (mappingId: string) => deleteGraphMapping(mappingId),
    onSuccess: async () => {
      toast.success('Mapping deleted.')
      if (selectedMappingId) {
        setSelectedMappingId(null)
        setMappingName('')
        setMappingDescription('')
        setBuilder(EMPTY_BUILDER)
        setLoadedGraph(null)
        setBuilderHydrated(true)
      }
      await mappingsQuery.refetch()
    },
    onError: () => toast.error('Failed to delete mapping.'),
  })

  function createDraft() {
    setSelectedMappingId(null)
    setMappingName('')
    setMappingDescription('')
    setBuilder(EMPTY_BUILDER)
    setLoadedGraph(null)
    setBuilderHydrated(true)
    setFocusNameTick((current) => current + 1)
    toast.message('Draft started. Set mapping name, root, and related values.')
  }

  return (
    <>
      <Header>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main fixed className='overflow-y-auto'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Relationship Builder</h1>
          <p className='text-muted-foreground'>Guided flow: root → related values → child values.</p>
        </div>

        <div className='grid gap-4 xl:grid-cols-[340px_1fr]'>
          <MappingList
            mappings={mappingsQuery.data ?? []}
            selectedMappingId={selectedMappingId}
            onCreate={createDraft}
            onOpen={(mappingId) => openMutation.mutate(mappingId)}
            onDelete={(mappingId) => deleteMutation.mutate(mappingId)}
          />

          <div className='space-y-4'>
            {!builderHydrated ? (
              <Card>
                <CardHeader>
                  <CardTitle>Loaded mapping</CardTitle>
                </CardHeader>
                <CardContent className='text-sm text-muted-foreground'>
                  This saved mapping could not be fully reconstructed into guided form fields. Showing metadata and graph preview without modifying node structure.
                </CardContent>
              </Card>
            ) : null}

            <RelationshipBuilder
              entities={entitiesQuery.data ?? []}
              mappingName={mappingName}
              mappingDescription={mappingDescription}
              builder={builder}
              saveDisabled={
                saveMutation.isPending ||
                mappingName.trim().length === 0 ||
                (builderHydrated && !hasMinimumBuilderSelections)
              }
              saveLabel={saveMutation.isPending ? 'Saving...' : 'Save Mapping'}
              onChangeName={setMappingName}
              onChangeDescription={setMappingDescription}
              onChangeBuilder={setBuilder}
              onSave={() => saveMutation.mutate()}
              focusNameTick={focusNameTick}
            />

            <Card>
              <CardHeader>
                <CardTitle>Graph preview</CardTitle>
              </CardHeader>
              <CardContent>
                <GraphPreview nodes={previewGraph.nodes} edges={previewGraph.edges} />
              </CardContent>
            </Card>
          </div>
        </div>
      </Main>
    </>
  )
}
