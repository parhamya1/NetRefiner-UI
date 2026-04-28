import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  createClickHouseDataSource,
  getClickHouseDatabases,
  getClickHouseDataSources,
  getClickHouseTableSchema,
  getClickHouseTables,
} from '@/lib/api/data-sources'
import { createEntity, getEntities } from '@/lib/api/entities'
import { confirmCsvImport, previewCsvImport, registerClickHouseTable } from '@/lib/api/imports'
import { QUERY_KEYS } from '@/lib/query-keys'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  ClickHouseDataSourceCreatePayload,
  CsvPreviewResponse,
  Entity,
  EntityColumn,
} from '@/types/api'

type CreateScenario = 'manual' | 'csv' | 'clickhouse' | null

const FRONTEND_TO_CLICKHOUSE: Record<string, string> = {
  text: 'String',
  number: 'Float64',
  integer: 'Int64',
  boolean: 'UInt8',
  date: 'Date',
  datetime: 'DateTime',
}

function createBlankColumn(): EntityColumn {
  return {
    name: '',
    label: '',
    frontend_type: 'text',
    clickhouse_type: FRONTEND_TO_CLICKHOUSE.text,
    is_filterable: true,
  }
}

export function EntityManagementPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [scenario, setScenario] = useState<CreateScenario>(null)

  const [manualName, setManualName] = useState('')
  const [manualTableName, setManualTableName] = useState('')
  const [manualColumns, setManualColumns] = useState<EntityColumn[]>([createBlankColumn()])

  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<CsvPreviewResponse | null>(null)
  const [csvName, setCsvName] = useState('')
  const [csvTableName, setCsvTableName] = useState('')

  const [showConnectionForm, setShowConnectionForm] = useState(false)
  const [connectionForm, setConnectionForm] = useState<ClickHouseDataSourceCreatePayload>({
    name: '',
    host: '',
    port: 8123,
    username: '',
    password: '',
    secure: false,
  })
  const [selectedDataSourceId, setSelectedDataSourceId] = useState('')
  const [selectedDatabase, setSelectedDatabase] = useState('')
  const [selectedTable, setSelectedTable] = useState('')
  const [registerName, setRegisterName] = useState('')
  const [registerTableName, setRegisterTableName] = useState('')

  const entitiesQuery = useQuery({
    queryKey: QUERY_KEYS.entities.summary,
    queryFn: getEntities,
  })

  const dataSourcesQuery = useQuery({
    queryKey: ['data-sources', 'clickhouse'],
    queryFn: getClickHouseDataSources,
    enabled: dialogOpen && scenario === 'clickhouse',
  })

  const databasesQuery = useQuery({
    queryKey: ['data-sources', 'clickhouse', selectedDataSourceId, 'databases'],
    queryFn: () => getClickHouseDatabases(selectedDataSourceId),
    enabled: dialogOpen && scenario === 'clickhouse' && selectedDataSourceId.length > 0,
  })

  const tablesQuery = useQuery({
    queryKey: ['data-sources', 'clickhouse', selectedDataSourceId, selectedDatabase, 'tables'],
    queryFn: () => getClickHouseTables(selectedDataSourceId, selectedDatabase),
    enabled:
      dialogOpen &&
      scenario === 'clickhouse' &&
      selectedDataSourceId.length > 0 &&
      selectedDatabase.length > 0,
  })

  const schemaQuery = useQuery({
    queryKey: [
      'data-sources',
      'clickhouse',
      selectedDataSourceId,
      selectedDatabase,
      selectedTable,
      'schema',
    ],
    queryFn: () => getClickHouseTableSchema(selectedDataSourceId, selectedDatabase, selectedTable),
    enabled:
      dialogOpen &&
      scenario === 'clickhouse' &&
      selectedDataSourceId.length > 0 &&
      selectedDatabase.length > 0 &&
      selectedTable.length > 0,
  })

  const entities = useMemo(() => entitiesQuery.data ?? [], [entitiesQuery.data])
  const normalizedManualColumns = useMemo(
    () =>
      manualColumns.map((column) => ({
        name: column.name.trim(),
        label: column.label.trim(),
        frontend_type: String(column.frontend_type),
        clickhouse_type: column.clickhouse_type.trim(),
        is_filterable: column.is_filterable,
      })),
    [manualColumns]
  )
  const canSubmitManual =
    manualName.trim().length > 0 &&
    manualTableName.trim().length > 0 &&
    normalizedManualColumns.length > 0 &&
    normalizedManualColumns.every(
      (column) =>
        column.name.length > 0 &&
        column.label.length > 0 &&
        column.frontend_type.length > 0 &&
        column.clickhouse_type.length > 0
    )

  const createManualMutation = useMutation({
    mutationFn: () =>
      createEntity({
        name: manualName.trim(),
        table_name: manualTableName.trim(),
        columns: normalizedManualColumns,
      }),
    onSuccess: async () => {
      toast.success('Entity created successfully.')
      await entitiesQuery.refetch()
      resetCreateState()
    },
    onError: (error) => {
      const axiosError = error as AxiosError<{ detail?: unknown }>
      const detail =
        axiosError.response?.data?.detail ?? axiosError.response?.data ?? 'Failed to create entity.'
      toast.error(JSON.stringify(detail, null, 2))
    },
  })

  const csvPreviewMutation = useMutation({
    mutationFn: async () => {
      if (!csvFile) throw new Error('Select a CSV file.')
      return previewCsvImport(csvFile)
    },
    onSuccess: (data) => {
      setCsvPreview(data)
      setCsvName(data.name ?? csvName)
      setCsvTableName(data.table_name ?? csvTableName)
    },
    onError: () => toast.error('CSV preview failed.'),
  })

  const csvConfirmMutation = useMutation({
    mutationFn: () =>
      confirmCsvImport({
        import_id: csvPreview?.import_id,
        name: csvName,
        table_name: csvTableName || undefined,
        columns: csvPreview?.columns,
      }),
    onSuccess: async () => {
      toast.success('CSV import confirmed.')
      await entitiesQuery.refetch()
      resetCreateState()
    },
    onError: () => toast.error('CSV confirm failed.'),
  })

  const createConnectionMutation = useMutation({
    mutationFn: () => createClickHouseDataSource(connectionForm),
    onSuccess: async () => {
      toast.success('Connection added.')
      await dataSourcesQuery.refetch()
      setShowConnectionForm(false)
    },
    onError: () => toast.error('Failed to add connection.'),
  })

  const registerTableMutation = useMutation({
    mutationFn: () =>
      registerClickHouseTable({
        data_source_id: selectedDataSourceId,
        database: selectedDatabase,
        table: selectedTable,
        name: registerName,
        table_name: registerTableName || undefined,
      }),
    onSuccess: async () => {
      toast.success('Table registered as entity.')
      await entitiesQuery.refetch()
      resetCreateState()
    },
    onError: () => toast.error('Failed to register table.'),
  })

  function resetCreateState() {
    setDialogOpen(false)
    setScenario(null)
    setManualName('')
    setManualTableName('')
    setManualColumns([createBlankColumn()])
    setCsvFile(null)
    setCsvPreview(null)
    setCsvName('')
    setCsvTableName('')
    setSelectedDataSourceId('')
    setSelectedDatabase('')
    setSelectedTable('')
    setRegisterName('')
    setRegisterTableName('')
    setShowConnectionForm(false)
  }

  function updateManualColumn(index: number, patch: Partial<EntityColumn>) {
    setManualColumns((current) =>
      current.map((column, idx) => {
        if (idx !== index) return column
        const next = { ...column, ...patch }
        if (patch.frontend_type) {
          next.clickhouse_type = FRONTEND_TO_CLICKHOUSE[patch.frontend_type] ?? next.clickhouse_type
        }
        return next
      })
    )
  }

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
            <h1 className='text-2xl font-bold tracking-tight'>Entity Management</h1>
            <p className='text-muted-foreground'>Manage entities and import sources.</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className='mr-2 size-4' />
            Create Entity
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Existing Entities</CardTitle>
          </CardHeader>
          <CardContent>
            {entitiesQuery.isLoading ? (
              <div className='space-y-3'>
                <Skeleton className='h-10 w-full' />
                <Skeleton className='h-10 w-full' />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Table Name</TableHead>
                    <TableHead>Source Type</TableHead>
                    <TableHead>Columns</TableHead>
                    <TableHead className='text-right'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entities.map((entity: Entity) => (
                    <TableRow key={entity.id}>
                      <TableCell className='font-medium'>{entity.name}</TableCell>
                      <TableCell>{entity.table_name ?? '-'}</TableCell>
                      <TableCell>
                        <Badge variant='secondary'>{entity.source_type ?? 'manual'}</Badge>
                      </TableCell>
                      <TableCell>{entity.columns?.length ?? '-'}</TableCell>
                      <TableCell className='text-right'>
                        <Button type='button' variant='outline' size='sm' disabled>
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {entities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className='py-8 text-center text-muted-foreground'>
                        No entities found.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-4xl'>
            <DialogHeader>
              <DialogTitle>Create Entity</DialogTitle>
              <DialogDescription>Select a creation scenario and complete the form.</DialogDescription>
            </DialogHeader>

            <div className='grid gap-3 md:grid-cols-3'>
              <Card
                className={scenario === 'manual' ? 'border-primary' : ''}
                onClick={() => setScenario('manual')}
              >
                <CardHeader>
                  <CardTitle className='text-base'>Manual Entity</CardTitle>
                  <CardDescription>Define columns manually and create a new ClickHouse table.</CardDescription>
                </CardHeader>
              </Card>
              <Card className={scenario === 'csv' ? 'border-primary' : ''} onClick={() => setScenario('csv')}>
                <CardHeader>
                  <CardTitle className='text-base'>CSV Import</CardTitle>
                  <CardDescription>Upload CSV, preview schema, then confirm import.</CardDescription>
                </CardHeader>
              </Card>
              <Card
                className={scenario === 'clickhouse' ? 'border-primary' : ''}
                onClick={() => setScenario('clickhouse')}
              >
                <CardHeader>
                  <CardTitle className='text-base'>Existing ClickHouse Table</CardTitle>
                  <CardDescription>Discover and register an existing ClickHouse table.</CardDescription>
                </CardHeader>
              </Card>
            </div>

            {scenario === 'manual' ? (
              <div className='space-y-4'>
                <div className='grid gap-3 md:grid-cols-2'>
                  <Input placeholder='Entity name' value={manualName} onChange={(e) => setManualName(e.target.value)} />
                  <Input
                    placeholder='table_name'
                    value={manualTableName}
                    onChange={(e) => setManualTableName(e.target.value)}
                  />
                </div>

                <div className='space-y-2'>
                  {manualColumns.map((column, index) => (
                    <div key={`manual-column-${index}`} className='grid gap-2 rounded-md border p-3 md:grid-cols-6'>
                      <Input
                        placeholder='name'
                        value={column.name}
                        onChange={(e) => updateManualColumn(index, { name: e.target.value })}
                      />
                      <Input
                        placeholder='label'
                        value={column.label}
                        onChange={(e) => updateManualColumn(index, { label: e.target.value })}
                      />
                      <Select
                        value={String(column.frontend_type)}
                        onValueChange={(value) => updateManualColumn(index, { frontend_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(FRONTEND_TO_CLICKHOUSE).map((value) => (
                            <SelectItem key={value} value={value}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input value={column.clickhouse_type} readOnly />
                      <div className='flex items-center gap-2'>
                        <Checkbox
                          checked={column.is_filterable}
                          onCheckedChange={(checked) =>
                            updateManualColumn(index, { is_filterable: checked === true })
                          }
                        />
                        <span className='text-sm'>Filterable</span>
                      </div>
                      <Button
                        type='button'
                        variant='destructive'
                        size='icon'
                        onClick={() => setManualColumns((current) => current.filter((_, i) => i !== index))}
                        disabled={manualColumns.length === 1}
                      >
                        <Trash2 className='size-4' />
                      </Button>
                    </div>
                  ))}
                  <Button type='button' variant='outline' onClick={() => setManualColumns((current) => [...current, createBlankColumn()])}>
                    <Plus className='mr-2 size-4' />
                    Add Column
                  </Button>
                </div>

                <div className='flex justify-end'>
                  <Button
                    onClick={() => createManualMutation.mutate()}
                    disabled={createManualMutation.isPending || !canSubmitManual}
                  >
                    {createManualMutation.isPending ? 'Creating...' : 'Create Manual Entity'}
                  </Button>
                </div>
              </div>
            ) : null}

            {scenario === 'csv' ? (
              <div className='space-y-4'>
                <Input
                  type='file'
                  accept='.csv,text/csv'
                  onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                />
                <Button onClick={() => csvPreviewMutation.mutate()} disabled={!csvFile || csvPreviewMutation.isPending}>
                  {csvPreviewMutation.isPending ? 'Previewing...' : 'Preview CSV'}
                </Button>

                {csvPreview ? (
                  <div className='space-y-3'>
                    <div className='grid gap-3 md:grid-cols-2'>
                      <Input placeholder='Entity name' value={csvName} onChange={(e) => setCsvName(e.target.value)} />
                      <Input
                        placeholder='table_name'
                        value={csvTableName}
                        onChange={(e) => setCsvTableName(e.target.value)}
                      />
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Label</TableHead>
                          <TableHead>Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvPreview.columns.map((column) => (
                          <TableRow key={column.name}>
                            <TableCell>{column.name}</TableCell>
                            <TableCell>{column.label}</TableCell>
                            <TableCell>{column.clickhouse_type}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <div className='flex justify-end'>
                      <Button
                        onClick={() => csvConfirmMutation.mutate()}
                        disabled={csvConfirmMutation.isPending || csvName.length === 0}
                      >
                        {csvConfirmMutation.isPending ? 'Confirming...' : 'Confirm Import'}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {scenario === 'clickhouse' ? (
              <div className='space-y-4'>
                <div className='flex items-center gap-2'>
                  <Select
                    value={selectedDataSourceId}
                    onValueChange={(value) => {
                      setSelectedDataSourceId(value)
                      setSelectedDatabase('')
                      setSelectedTable('')
                    }}
                  >
                    <SelectTrigger className='max-w-md'>
                      <SelectValue placeholder='Select connection' />
                    </SelectTrigger>
                    <SelectContent>
                      {(dataSourcesQuery.data ?? []).map((source) => (
                        <SelectItem key={source.id} value={source.id}>
                          {source.name} ({source.host}:{source.port})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type='button' variant='outline' onClick={() => setShowConnectionForm((v) => !v)}>
                    Add Connection
                  </Button>
                </div>

                {showConnectionForm ? (
                  <div className='grid gap-3 rounded-md border p-3 md:grid-cols-3'>
                    <Input placeholder='Name' value={connectionForm.name} onChange={(e) => setConnectionForm((current) => ({ ...current, name: e.target.value }))} />
                    <Input placeholder='Host' value={connectionForm.host} onChange={(e) => setConnectionForm((current) => ({ ...current, host: e.target.value }))} />
                    <Input
                      type='number'
                      placeholder='Port'
                      value={connectionForm.port}
                      onChange={(e) => setConnectionForm((current) => ({ ...current, port: Number(e.target.value || 0) }))}
                    />
                    <Input placeholder='Username' value={connectionForm.username} onChange={(e) => setConnectionForm((current) => ({ ...current, username: e.target.value }))} />
                    <Input type='password' placeholder='Password' value={connectionForm.password} onChange={(e) => setConnectionForm((current) => ({ ...current, password: e.target.value }))} />
                    <div className='flex items-center gap-2'>
                      <Checkbox
                        checked={connectionForm.secure}
                        onCheckedChange={(checked) => setConnectionForm((current) => ({ ...current, secure: checked === true }))}
                      />
                      <span className='text-sm'>Secure</span>
                    </div>
                    <div className='md:col-span-3'>
                      <Button onClick={() => createConnectionMutation.mutate()} disabled={createConnectionMutation.isPending}>
                        {createConnectionMutation.isPending ? 'Saving...' : 'Save Connection'}
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className='grid gap-3 md:grid-cols-2'>
                  <Select
                    value={selectedDatabase}
                    onValueChange={(value) => {
                      setSelectedDatabase(value)
                      setSelectedTable('')
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Select database' />
                    </SelectTrigger>
                    <SelectContent>
                      {(databasesQuery.data ?? []).map((database) => (
                        <SelectItem key={database.name} value={database.name}>
                          {database.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedTable} onValueChange={setSelectedTable}>
                    <SelectTrigger>
                      <SelectValue placeholder='Select table' />
                    </SelectTrigger>
                    <SelectContent>
                      {(tablesQuery.data ?? []).map((table) => (
                        <SelectItem key={table.name} value={table.name}>
                          {table.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {schemaQuery.data ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Column</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schemaQuery.data.map((column) => (
                        <TableRow key={column.name}>
                          <TableCell>{column.name}</TableCell>
                          <TableCell>{column.type}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : null}

                <div className='grid gap-3 md:grid-cols-2'>
                  <Input placeholder='Entity name' value={registerName} onChange={(e) => setRegisterName(e.target.value)} />
                  <Input
                    placeholder='table_name (optional)'
                    value={registerTableName}
                    onChange={(e) => setRegisterTableName(e.target.value)}
                  />
                </div>

                <div className='flex justify-end'>
                  <Button
                    onClick={() => registerTableMutation.mutate()}
                    disabled={
                      registerTableMutation.isPending ||
                      selectedDataSourceId.length === 0 ||
                      selectedDatabase.length === 0 ||
                      selectedTable.length === 0 ||
                      registerName.length === 0
                    }
                  >
                    {registerTableMutation.isPending ? 'Registering...' : 'Register Entity'}
                  </Button>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
