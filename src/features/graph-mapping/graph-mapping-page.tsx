import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import ReactFlow, {
  addEdge,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node,
} from '@xyflow/react'
import { toast } from 'sonner'
import { getEntities, getEntityDistinctValues } from '@/lib/api/entities'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import type { Entity, GraphMapping, GraphMappingPayload } from '@/types/api'

type GraphNodeData = {
  label: string
  entity_id: string
  entity_name: string
  column: string
  value: string
}

function toNodeLabel(entityName: string, column: string, value: string) {
  return `${value}\n${entityName}\n${column}`
}

export function GraphMappingPage() {
  const [selectedMappingId, setSelectedMappingId] = useState<string | null>(null)
  const [mappingName, setMappingName] = useState('')
  const [mappingDescription, setMappingDescription] = useState('')
  const [nodes, setNodes] = useState<Node<GraphNodeData>[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [nodeEntityId, setNodeEntityId] = useState('')
  const [nodeColumn, setNodeColumn] = useState('')
  const [nodeValue, setNodeValue] = useState('')
  const [nodeValueSearch, setNodeValueSearch] = useState('')
  const [nodeLabel, setNodeLabel] = useState('')

  const mappingsQuery = useQuery({
    queryKey: ['graph-mappings', 'list'],
    queryFn: getGraphMappings,
  })

  const entitiesQuery = useQuery({
    queryKey: ['graph-mappings', 'entities'],
    queryFn: getEntities,
  })

  const selectedEntity = useMemo(
    () => (entitiesQuery.data ?? []).find((entity) => entity.id === nodeEntityId) ?? null,
    [entitiesQuery.data, nodeEntityId]
  )

  const distinctValuesQuery = useQuery({
    queryKey: ['graph-mappings', 'distinct-values', nodeEntityId, nodeColumn, nodeValueSearch],
    queryFn: () =>
      getEntityDistinctValues(nodeEntityId, {
        column: nodeColumn,
        search: nodeValueSearch,
        limit: 20,
      }),
    enabled: nodeEntityId.length > 0 && nodeColumn.length > 0,
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (mappingName.trim().length === 0) {
        throw new Error('Mapping name is required.')
      }

      const payload: GraphMappingPayload = {
        name: mappingName.trim(),
        description: mappingDescription.trim(),
        nodes: nodes as GraphMapping['nodes'],
        edges: edges as GraphMapping['edges'],
      }

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
      toast.error(error instanceof Error ? error.message : 'Failed to save graph mapping.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (mappingId: string) => deleteGraphMapping(mappingId),
    onSuccess: async () => {
      toast.success('Graph mapping deleted.')
      if (selectedMappingId) {
        setSelectedMappingId(null)
        setMappingName('')
        setMappingDescription('')
        setNodes([])
        setEdges([])
      }
      await mappingsQuery.refetch()
    },
    onError: () => toast.error('Failed to delete graph mapping.'),
  })

  const openMutation = useMutation({
    mutationFn: async (mappingId: string) => getGraphMapping(mappingId),
    onSuccess: (mapping) => {
      setSelectedMappingId(mapping.id)
      setMappingName(mapping.name)
      setMappingDescription(mapping.description ?? '')
      setNodes(mapping.nodes as Node<GraphNodeData>[])
      setEdges(mapping.edges as Edge[])
    },
    onError: () => toast.error('Failed to load graph mapping.'),
  })

  function addNodeToCanvas() {
    if (!selectedEntity || nodeColumn.trim().length === 0 || nodeValue.trim().length === 0) {
      toast.error('Entity, column, and value are required.')
      return
    }

    const duplicate = nodes.some((node) => {
      const data = node.data
      return (
        data.entity_id === selectedEntity.id &&
        data.column === nodeColumn &&
        data.value === nodeValue
      )
    })
    if (duplicate) {
      toast.error('This entity/column/value is already added.')
      return
    }

    const nextNode: Node<GraphNodeData> = {
      id: `node-${Date.now()}`,
      position: { x: 40 + nodes.length * 40, y: 40 + nodes.length * 20 },
      data: {
        label: toNodeLabel(selectedEntity.name, nodeColumn, nodeLabel.trim() || nodeValue),
        entity_id: selectedEntity.id,
        entity_name: selectedEntity.name,
        column: nodeColumn,
        value: nodeValue,
      },
    }

    setNodes((current) => [...current, nextNode])
    setNodeValue('')
    setNodeLabel('')
  }

  function startNewMapping() {
    setSelectedMappingId(null)
    setMappingName('')
    setMappingDescription('')
    setNodes([])
    setEdges([])
  }

  const distinctValues = distinctValuesQuery.data?.values ?? []
  const entityColumns = (selectedEntity?.columns ?? []).map((column) => column.name)

  return (
    <>
      <Header>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main fixed>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Graph Mapping</h1>
            <p className='text-muted-foreground'>Build relationship maps from entity values.</p>
          </div>
          <Button onClick={startNewMapping}>Create Mapping</Button>
        </div>

        <div className='grid gap-4 lg:grid-cols-[380px_1fr]'>
          <Card>
            <CardHeader>
              <CardTitle>Mappings</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className='text-right'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(mappingsQuery.data ?? []).map((mapping) => (
                    <TableRow key={mapping.id}>
                      <TableCell>{mapping.name}</TableCell>
                      <TableCell className='text-right'>
                        <div className='flex justify-end gap-2'>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => openMutation.mutate(mapping.id)}
                          >
                            Open
                          </Button>
                          <Button
                            variant='destructive'
                            size='sm'
                            onClick={() => deleteMutation.mutate(mapping.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(mappingsQuery.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className='text-center text-muted-foreground'>
                        No mappings yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mapping Editor</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid gap-3 md:grid-cols-2'>
                <Input
                  placeholder='Mapping name'
                  value={mappingName}
                  onChange={(event) => setMappingName(event.target.value)}
                />
                <Input
                  placeholder='Description'
                  value={mappingDescription}
                  onChange={(event) => setMappingDescription(event.target.value)}
                />
              </div>

              <div className='grid gap-3 rounded-md border p-3 md:grid-cols-2 xl:grid-cols-5'>
                <Select
                  value={nodeEntityId}
                  onValueChange={(value) => {
                    setNodeEntityId(value)
                    setNodeColumn('')
                    setNodeValue('')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Entity' />
                  </SelectTrigger>
                  <SelectContent>
                    {(entitiesQuery.data ?? []).map((entity: Entity) => (
                      <SelectItem key={entity.id} value={entity.id}>
                        {entity.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={nodeColumn} onValueChange={setNodeColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder='Column' />
                  </SelectTrigger>
                  <SelectContent>
                    {entityColumns.map((columnName) => (
                      <SelectItem key={columnName} value={columnName}>
                        {columnName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder='Search values'
                  value={nodeValueSearch}
                  onChange={(event) => setNodeValueSearch(event.target.value)}
                />
                <Select
                  value={nodeValue}
                  onValueChange={(value) => {
                    setNodeValue(value)
                    if (nodeLabel.trim().length === 0) {
                      setNodeLabel(value)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Value' />
                  </SelectTrigger>
                  <SelectContent>
                    {distinctValues.map((value) => {
                      const stringValue = String(value)
                      return (
                        <SelectItem key={stringValue} value={stringValue}>
                          {stringValue}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <Button onClick={addNodeToCanvas}>Add Node</Button>
              </div>

              <Textarea
                placeholder='Node label (defaults to selected value)'
                value={nodeLabel}
                onChange={(event) => setNodeLabel(event.target.value)}
              />

              <div className='h-[520px]'>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={(changes) => setNodes((current) => applyNodeChanges(changes, current))}
                  onConnect={(connection) => setEdges((current) => addEdge(connection, current))}
                >
                  <Controls />
                  <MiniMap />
                  <Background />
                </ReactFlow>
              </div>

              <div className='flex justify-end'>
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : 'Save Mapping'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}
