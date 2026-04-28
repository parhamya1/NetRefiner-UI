import { useEffect, useMemo, useState } from 'react'
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
import {
  confirmCsvImport,
  previewCsvImportWithMetadata,
  registerClickHouseTable,
} from '@/lib/api/imports'
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
  CsvConfirmPayload,
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

function cleanCsvHeader(value: string): string {
  return value.replace(/^\uFEFF/, '').trim()
}

function toColumnName(value: string): string {
  return cleanCsvHeader(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function getPreviewSampleRows(previewResponse: CsvPreviewResponse): Record<string, unknown>[] {
  const nestedData = previewResponse.data as
    | { sample_rows?: Record<string, unknown>[]; rows?: Record<string, unknown>[] }
    | undefined
  return (
    (previewResponse.sample_rows as Record<string, unknown>[] | undefined) ??
    (previewResponse.sampleRows as Record<string, unknown>[] | undefined) ??
    (previewResponse.preview_rows as Record<string, unknown>[] | undefined) ??
    (previewResponse.previewRows as Record<string, unknown>[] | undefined) ??
    (previewResponse.rows as Record<string, unknown>[] | undefined) ??
    nestedData?.sample_rows ??
    nestedData?.rows ??
    []
  )
}

function getPreviewColumns(previewResponse: CsvPreviewResponse): EntityColumn[] {
  const nestedData = previewResponse.data as
    | { columns?: EntityColumn[]; schema?: EntityColumn[] }
    | undefined
  return (
    (previewResponse.columns as EntityColumn[] | undefined) ??
    (previewResponse.schema as EntityColumn[] | undefined) ??
    nestedData?.columns ??
    nestedData?.schema ??
    []
  )
}

function getPreviewUploadId(previewResponse: CsvPreviewResponse): string | undefined {
  return (
    previewResponse.upload_id ??
    previewResponse.file_id ??
    (previewResponse.id as string | undefined) ??
    (previewResponse.data as { upload_id?: string } | undefined)?.upload_id ??
    (previewResponse.data as { file_id?: string } | undefined)?.file_id
  )
}

function inferFrontendType(
  header: string,
  sampleRows: Record<string, unknown>[]
): 'text' | 'number' | 'integer' | 'date' {
  const cleanedHeader = cleanCsvHeader(header)
  const values = sampleRows
    .map((row) => row[header] ?? row[cleanedHeader])
    .map((value) => (typeof value === 'string' ? value.trim() : value))
    .filter((value) => value !== '' && value != null)

  if (values.length === 0) return 'text'

  const isInteger = values.every((value) =>
    typeof value === 'number'
      ? Number.isInteger(value)
      : typeof value === 'string' && /^-?\d+$/.test(value)
  )
  if (isInteger) return 'integer'

  const isDecimal = values.every((value) =>
    typeof value === 'number'
      ? Number.isFinite(value)
      : typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)
  )
  if (isDecimal) return 'number'

  const isDate = values.every((value) => {
    if (typeof value !== 'string') return false
    const parsed = Date.parse(value)
    return Number.isFinite(parsed)
  })
  if (isDate) return 'date'

  return 'text'
}

function normalizeFrontendType(value: unknown): 'text' | 'number' | 'integer' | 'boolean' | 'date' | 'datetime' {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
  if (
    normalized === 'text' ||
    normalized === 'number' ||
    normalized === 'integer' ||
    normalized === 'boolean' ||
    normalized === 'date' ||
    normalized === 'datetime'
  ) {
    return normalized
  }
  return 'text'
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
  const [csvColumns, setCsvColumns] = useState<EntityColumn[]>([])

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

  useEffect(() => {
    const discoveryErrors = [
      dataSourcesQuery.error,
      databasesQuery.error,
      tablesQuery.error,
      schemaQuery.error,
    ].filter(Boolean)

    for (const error of discoveryErrors) {
      const axiosError = error as AxiosError<{ detail?: unknown }>
      if (axiosError.response?.data) {
        // eslint-disable-next-line no-console
        console.log('CLICKHOUSE DISCOVERY ERROR', axiosError.response.data)
      }
    }
  }, [
    dataSourcesQuery.error,
    databasesQuery.error,
    tablesQuery.error,
    schemaQuery.error,
  ])

  const entities = useMemo(() => entitiesQuery.data ?? [], [entitiesQuery.data])
  const normalizedManualColumns = useMemo(
    () =>
      manualColumns.map((column) => ({
        name: column.name.trim(),
        label: column.label.trim(),
        type: String(column.frontend_type),
        frontend_type: String(column.frontend_type),
        clickhouse_type:
          FRONTEND_TO_CLICKHOUSE[String(column.frontend_type)] ?? column.clickhouse_type.trim(),
        is_filterable: Boolean(column.is_filterable),
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
        source_type: 'manual',
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
      return previewCsvImportWithMetadata({
        file: csvFile,
        name: csvName.trim(),
        entity_name: csvName.trim(),
        table_name: csvTableName.trim(),
      })
    },
    onSuccess: (data) => {
      // eslint-disable-next-line no-console
      console.log('CSV PREVIEW RESPONSE', data)
      setCsvPreview(data)
      const sampleRows = getPreviewSampleRows(data)
      const columnsFromResponse = getPreviewColumns(data)

      const nextColumns =
        columnsFromResponse.length > 0
          ? columnsFromResponse.map((column, index) => {
              const originalName = String(
                (column.original_name as string | undefined) ??
                  column.label ??
                  column.name ??
                  ''
              )
              const suggestedName = String(
                (column.suggested_name as string | undefined) ?? column.name ?? ''
              )
              const header = cleanCsvHeader(originalName)
              const inferredType = inferFrontendType(originalName || header, sampleRows)
              const frontendType = normalizeFrontendType(
                (column.suggested_type as string | undefined) ??
                  column.frontend_type ??
                  column.type ??
                  inferredType
              )
              return {
                ...column,
                original_name: originalName,
                name: toColumnName(suggestedName || header) || `column_${index + 1}`,
                label: header,
                type: frontendType,
                frontend_type: frontendType,
                clickhouse_type: FRONTEND_TO_CLICKHOUSE[frontendType] ?? column.clickhouse_type ?? 'String',
                is_filterable: false,
              }
            })
          : Object.keys(sampleRows[0] ?? {}).map((rawHeader, index) => {
              const header = cleanCsvHeader(rawHeader)
              const frontendType = inferFrontendType(rawHeader, sampleRows)
              return {
                original_name: rawHeader,
                name: toColumnName(header) || `column_${index + 1}`,
                label: header,
                type: frontendType,
                frontend_type: frontendType,
                clickhouse_type: FRONTEND_TO_CLICKHOUSE[frontendType],
                is_filterable: false,
              } satisfies EntityColumn
            })

      setCsvColumns(nextColumns)
    },
    onError: (error) => {
      const axiosError = error as AxiosError<{ detail?: unknown }>
      const detail =
        axiosError.response?.data?.detail ?? axiosError.response?.data ?? 'CSV preview failed.'
      toast.error(JSON.stringify(detail, null, 2))
    },
  })

  const csvConfirmMutation = useMutation({
    mutationFn: () => {
      if (csvName.trim().length === 0) {
        throw new Error('Entity name is required.')
      }
      if (csvTableName.trim().length === 0) {
        throw new Error('Table name is required.')
      }
      if (csvColumns.length === 0) {
        throw new Error('At least one column is required.')
      }

      const normalizedColumns = csvColumns.map((column) => {
        const frontendType = String(column.frontend_type)
        return {
          original_name: String(column.original_name ?? column.label ?? column.name),
          name: column.name.trim(),
          label: column.label.trim(),
          type: frontendType,
          frontend_type: frontendType,
          clickhouse_type: FRONTEND_TO_CLICKHOUSE[frontendType] ?? column.clickhouse_type,
          is_filterable: Boolean(column.is_filterable),
        }
      })

      const hasMissingRequired = normalizedColumns.some(
        (column) => !column.name || !column.label || !column.frontend_type
      )
      if (hasMissingRequired) {
        throw new Error('Every CSV column must have name, label, and frontend type.')
      }

      const nameSet = new Set<string>()
      for (const column of normalizedColumns) {
        if (nameSet.has(column.name)) {
          throw new Error(`Duplicate column name: ${column.name}`)
        }
        nameSet.add(column.name)
      }

      const resolvedFileId =
        csvPreview?.file_id ??
        (csvPreview?.data as { file_id?: string } | undefined)?.file_id ??
        (csvPreview?.id as string | undefined) ??
        getPreviewUploadId(csvPreview ?? ({} as CsvPreviewResponse))
      if (!resolvedFileId) {
        throw new Error('CSV file identifier is missing from preview response.')
      }

      const dirtyPayload = {
        file_id: resolvedFileId,
        entity_name: csvName.trim(),
        table_name: csvTableName.trim(),
        columns: normalizedColumns,
      }
      const confirmPayload: CsvConfirmPayload = {
        file_id: dirtyPayload.file_id,
        entity_name: dirtyPayload.entity_name,
        table_name: dirtyPayload.table_name,
        columns: dirtyPayload.columns,
      }

      // eslint-disable-next-line no-console
      console.log('CSV CONFIRM CLEAN PAYLOAD', confirmPayload)
      return confirmCsvImport(confirmPayload)
    },
    onSuccess: async () => {
      toast.success('CSV import confirmed.')
      await entitiesQuery.refetch()
      resetCreateState()
    },
    onError: (error) => {
      const axiosError = error as AxiosError<{ detail?: unknown }>
      // eslint-disable-next-line no-console
      console.log('CSV CONFIRM ERROR', axiosError.response?.data)
      // eslint-disable-next-line no-console
      console.log('CSV CONFIRM ERROR MESSAGE', axiosError.message)
      // eslint-disable-next-line no-console
      console.log('CSV CONFIRM ERROR REQUEST STATUS', axiosError.request?.status)
      if (error instanceof Error) {
        if (axiosError.response?.status === 500 || axiosError.request?.status === 500) {
          toast.error('CSV confirm failed. Backend returned 500. Check backend logs.')
          return
        }
        toast.error(error.message)
        return
      }
      const detail = axiosError.response?.data?.detail ?? axiosError.response?.data
      toast.error(detail ? JSON.stringify(detail, null, 2) : 'CSV confirm failed.')
    },
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
    setCsvColumns([])
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
                <div className='grid gap-3 md:grid-cols-2'>
                  <Input
                    placeholder='Entity name'
                    value={csvName}
                    onChange={(e) => setCsvName(e.target.value)}
                  />
                  <Input
                    placeholder='table_name'
                    value={csvTableName}
                    onChange={(e) => setCsvTableName(e.target.value)}
                  />
                </div>
                <Input
                  type='file'
                  accept='.csv,text/csv'
                  onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  onClick={() => csvPreviewMutation.mutate()}
                  disabled={
                    !csvFile ||
                    csvPreviewMutation.isPending ||
                    csvName.trim().length === 0 ||
                    csvTableName.trim().length === 0
                  }
                >
                  {csvPreviewMutation.isPending ? 'Previewing...' : 'Preview CSV'}
                </Button>

                {csvPreview ? (
                  <div className='space-y-3'>
                    <div className='max-h-[420px] overflow-auto rounded-md border'>
                      <Table className='min-w-max'>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Label</TableHead>
                            <TableHead>Frontend Type</TableHead>
                            <TableHead>ClickHouse Type</TableHead>
                            <TableHead>Filterable</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {csvColumns.map((column, index) => (
                            <TableRow key={`${column.name}-${index}`}>
                              <TableCell>
                                <Input
                                  value={column.name}
                                  onChange={(e) =>
                                    setCsvColumns((current) =>
                                      current.map((item, idx) =>
                                        idx === index
                                          ? { ...item, name: toColumnName(e.target.value) }
                                          : item
                                      )
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={column.label}
                                  onChange={(e) =>
                                    setCsvColumns((current) =>
                                      current.map((item, idx) =>
                                        idx === index ? { ...item, label: e.target.value } : item
                                      )
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={String(column.frontend_type)}
                                  onValueChange={(value) =>
                                    setCsvColumns((current) =>
                                      current.map((item, idx) =>
                                        idx === index
                                          ? {
                                              ...item,
                                              type: value,
                                              frontend_type: value,
                                              clickhouse_type:
                                                FRONTEND_TO_CLICKHOUSE[value] ??
                                                item.clickhouse_type,
                                            }
                                          : item
                                      )
                                    )
                                  }
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
                              </TableCell>
                              <TableCell>{column.clickhouse_type ?? '-'}</TableCell>
                              <TableCell>
                                <Checkbox
                                  checked={column.is_filterable}
                                  onCheckedChange={(checked) =>
                                    setCsvColumns((current) =>
                                      current.map((item, idx) =>
                                        idx === index
                                          ? { ...item, is_filterable: checked === true }
                                          : item
                                      )
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  type='button'
                                  variant='destructive'
                                  size='sm'
                                  onClick={() =>
                                    setCsvColumns((current) =>
                                      current.filter((_, idx) => idx !== index)
                                    )
                                  }
                                >
                                  Remove
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {(csvPreview.sample_rows ?? csvPreview.rows)?.length ? (
                      <details className='rounded-md border p-3'>
                        <summary className='cursor-pointer text-sm font-medium'>Sample rows</summary>
                        <div className='mt-3 max-h-[260px] overflow-auto'>
                          <pre className='text-xs'>
                            {JSON.stringify(csvPreview.sample_rows ?? csvPreview.rows, null, 2)}
                          </pre>
                        </div>
                      </details>
                    ) : null}

                    {csvColumns.length === 0 ? (
                      <div className='rounded-md border p-3 text-sm text-muted-foreground'>
                        At least one column is required.
                      </div>
                    ) : null}

                    <div className='flex justify-end'>
                      <Button
                        onClick={() => csvConfirmMutation.mutate()}
                        disabled={
                          csvConfirmMutation.isPending ||
                          csvName.trim().length === 0 ||
                          csvTableName.trim().length === 0 ||
                          csvColumns.length === 0
                        }
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
