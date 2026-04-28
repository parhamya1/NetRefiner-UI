import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons'
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
import { createEntity, deleteEntity, getEntities, queryEntityRows } from '@/lib/api/entities'
import {
  confirmCsvImport,
  previewCsvImportWithMetadata,
  registerClickHouseTable,
} from '@/lib/api/imports'
import { getPages, updatePage } from '@/lib/api/pages'
import { QUERY_KEYS } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { ConfigDrawer } from '@/components/config-drawer'
import { ConfirmDialog } from '@/components/confirm-dialog'
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
  ClickHouseSchemaColumn,
  Entity,
  EntityColumn,
  Page,
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
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [scenario, setScenario] = useState<CreateScenario>(null)
  const [viewDataEntity, setViewDataEntity] = useState<Entity | null>(null)
  const [viewDataPage, setViewDataPage] = useState(1)
  const [viewDataPageSize, setViewDataPageSize] = useState(25)
  const [deleteEntityTarget, setDeleteEntityTarget] = useState<Entity | null>(null)
  const [assignEntityTarget, setAssignEntityTarget] = useState<Entity | null>(null)
  const [assignPageSelectorOpen, setAssignPageSelectorOpen] = useState(false)
  const [assignPageId, setAssignPageId] = useState('')
  const [assignDisplayTitle, setAssignDisplayTitle] = useState('')
  const [assignFiltersEnabled, setAssignFiltersEnabled] = useState(true)
  const [assignSortOrder, setAssignSortOrder] = useState(1)

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

  const entitiesQuery = useQuery({
    queryKey: QUERY_KEYS.entities.summary,
    queryFn: getEntities,
  })

  const assignPagesQuery = useQuery({
    queryKey: QUERY_KEYS.pages.management,
    queryFn: getPages,
    enabled: !!assignEntityTarget,
  })

  const viewDataQuery = useQuery({
    queryKey: [
      'entity-management',
      'view-data',
      viewDataEntity?.id,
      viewDataPage,
      viewDataPageSize,
    ],
    queryFn: () =>
      queryEntityRows(viewDataEntity!.id, {
        page: viewDataPage,
        page_size: viewDataPageSize,
      }),
    enabled: !!viewDataEntity,
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
  const assignableLeafPages = useMemo(() => {
    const pages = assignPagesQuery.data ?? []
    const pageById = new Map(pages.map((page) => [page.id, page]))
    const parentIds = new Set(pages.map((page) => page.parent_id).filter((value): value is string => !!value))

    return pages
      .filter((page) => !parentIds.has(page.id))
      .map((page) => {
        const lineage: string[] = []
        const seen = new Set<string>()
        let current: Page | undefined = page

        while (current) {
          if (seen.has(current.id)) break
          seen.add(current.id)
          lineage.unshift(current.title)
          if (!current.parent_id) break
          current = pageById.get(current.parent_id)
        }

        return {
          page,
          pathLabel: lineage.join(' / '),
        }
      })
      .sort((a, b) => a.pathLabel.localeCompare(b.pathLabel))
  }, [assignPagesQuery.data])

  const selectedAssignPageOption = useMemo(
    () => assignableLeafPages.find((option) => option.page.id === assignPageId) ?? null,
    [assignPageId, assignableLeafPages]
  )
  const databases = Array.isArray(databasesQuery.data) ? databasesQuery.data : []
  const tables = Array.isArray(tablesQuery.data) ? tablesQuery.data : []
  const schemaColumns: ClickHouseSchemaColumn[] = Array.isArray(schemaQuery.data?.columns)
    ? schemaQuery.data.columns
    : []
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
        source_id: selectedDataSourceId,
        database: selectedDatabase,
        table: selectedTable,
        entity_name: registerName,
      }),
    onSuccess: async () => {
      toast.success('Table registered as entity.')
      await entitiesQuery.refetch()
      resetCreateState()
    },
    onError: (error) => {
      const axiosError = error as AxiosError<{ detail?: unknown }>
      const detail =
        axiosError.response?.data?.detail ?? axiosError.response?.data ?? 'Failed to register table.'
      toast.error(JSON.stringify(detail, null, 2))
    },
  })

  const deleteEntityMutation = useMutation({
    mutationFn: async () => {
      if (!deleteEntityTarget) return
      await deleteEntity(deleteEntityTarget.id)
    },
    onSuccess: async () => {
      toast.success('Entity deleted.')
      setDeleteEntityTarget(null)
      await entitiesQuery.refetch()
    },
    onError: (error) => {
      const axiosError = error as AxiosError<{ detail?: unknown }>
      const detail = axiosError.response?.data?.detail ?? axiosError.response?.data
      toast.error(detail ? JSON.stringify(detail, null, 2) : 'Failed to delete entity.')
    },
  })

  const assignEntityMutation = useMutation({
    mutationFn: async () => {
      if (!assignEntityTarget || !assignPageId) return
      const pages = assignPagesQuery.data ?? []
      const targetPage = pages.find((page) => page.id === assignPageId)
      if (!targetPage) throw new Error('Selected page was not found.')

      const alreadyAssigned = targetPage.assigned_entities.some(
        (item) => item.entity_id === assignEntityTarget.id
      )
      if (alreadyAssigned) {
        throw new Error('Entity is already assigned to this page.')
      }

      const updatedAssignedEntities = [
        ...targetPage.assigned_entities,
        {
          entity_id: assignEntityTarget.id,
          display_title: assignDisplayTitle.trim(),
          display_type: 'table',
          filters_enabled: assignFiltersEnabled,
          sort_order: assignSortOrder,
        },
      ]

      await updatePage(targetPage.id, {
        title: targetPage.title,
        slug: targetPage.slug,
        parent_id: targetPage.parent_id,
        menu_order: targetPage.menu_order,
        is_menu_visible: targetPage.is_menu_visible,
        assigned_entities: updatedAssignedEntities,
      })

      return {
        assignedPageSlug: targetPage.slug,
      }
    },
    onSuccess: async (result) => {
      toast.success('Entity assigned to page.')
      setAssignEntityTarget(null)
      setAssignPageSelectorOpen(false)
      setAssignPageId('')
      setAssignDisplayTitle('')
      setAssignFiltersEnabled(true)
      setAssignSortOrder(1)
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pages.management })
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pages.menuTree })
      if (result?.assignedPageSlug) {
        await queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.pages.bySlug(result.assignedPageSlug),
        })
      }
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message)
        return
      }
      const axiosError = error as AxiosError<{ detail?: unknown }>
      const detail = axiosError.response?.data?.detail ?? axiosError.response?.data
      toast.error(detail ? JSON.stringify(detail, null, 2) : 'Failed to assign entity.')
    },
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

  function openViewData(entity: Entity) {
    setViewDataEntity(entity)
    setViewDataPage(1)
  }

  function openAssignDialog(entity: Entity) {
    setAssignEntityTarget(entity)
    setAssignDisplayTitle(entity.name)
    setAssignFiltersEnabled(true)
    setAssignPageSelectorOpen(false)
    setAssignPageId('')
    setAssignSortOrder(1)
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
                        <div className='flex justify-end gap-2'>
                          <Button type='button' variant='outline' size='sm' onClick={() => openViewData(entity)}>
                            View Data
                          </Button>
                          <Button type='button' variant='outline' size='sm' onClick={() => openAssignDialog(entity)}>
                            Assign to Page
                          </Button>
                          {entity.source_type === 'manual' ? (
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              disabled
                              title='Manual entity editing requires backend update endpoint'
                            >
                              Edit
                            </Button>
                          ) : null}
                          <Button
                            type='button'
                            variant='destructive'
                            size='sm'
                            onClick={() => setDeleteEntityTarget(entity)}
                          >
                            Delete
                          </Button>
                        </div>
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

        <Dialog open={!!viewDataEntity} onOpenChange={(open) => !open && setViewDataEntity(null)}>
          <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-5xl'>
            <DialogHeader>
              <DialogTitle>View Data</DialogTitle>
              <DialogDescription>{viewDataEntity?.name ?? ''}</DialogDescription>
            </DialogHeader>

            {viewDataQuery.isLoading ? (
              <div className='space-y-2'>
                <Skeleton className='h-10 w-full' />
                <Skeleton className='h-10 w-full' />
              </div>
            ) : viewDataQuery.isError ? (
              <div className='rounded-md border border-destructive/40 p-3 text-sm text-destructive'>
                Failed to load entity rows.
              </div>
            ) : (
              <>
                <div className='overflow-x-auto rounded-md border'>
                  <Table className='min-w-max'>
                    <TableHeader>
                      <TableRow>
                        {(viewDataQuery.data?.columns ?? []).map((column) => (
                          <TableHead key={`view-col-${column.name}`}>{column.label || column.name}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(viewDataQuery.data?.rows ?? []).length > 0 ? (
                        (viewDataQuery.data?.rows ?? []).map((row, rowIndex) => (
                          <TableRow key={`view-row-${rowIndex}`}>
                            {(viewDataQuery.data?.columns ?? []).map((column) => (
                              <TableCell key={`view-cell-${rowIndex}-${column.name}`}>
                                {String(row[column.name] ?? '-')}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={Math.max(viewDataQuery.data?.columns.length ?? 1, 1)} className='py-8 text-center text-muted-foreground'>
                            No rows found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <span className='text-sm text-muted-foreground'>Page size</span>
                    <Select
                      value={String(viewDataPageSize)}
                      onValueChange={(value) => {
                        setViewDataPageSize(Number(value))
                        setViewDataPage(1)
                      }}
                    >
                      <SelectTrigger className='w-24'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[10, 25, 50, 100].map((size) => (
                          <SelectItem key={size} value={String(size)}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setViewDataPage((prev) => Math.max(prev - 1, 1))}
                      disabled={viewDataPage <= 1}
                    >
                      Previous
                    </Button>
                    <span className='text-sm text-muted-foreground'>
                      Page {viewDataPage}
                    </span>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setViewDataPage((prev) => prev + 1)}
                      disabled={(viewDataQuery.data?.pagination.returned ?? 0) < viewDataPageSize}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!assignEntityTarget} onOpenChange={(open) => !open && setAssignEntityTarget(null)}>
          <DialogContent className='sm:max-w-lg'>
            <DialogHeader>
              <DialogTitle>Assign to Page</DialogTitle>
              <DialogDescription>{assignEntityTarget?.name ?? ''}</DialogDescription>
            </DialogHeader>
            <div className='space-y-3'>
              <Popover open={assignPageSelectorOpen} onOpenChange={setAssignPageSelectorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant='outline'
                    role='combobox'
                    aria-expanded={assignPageSelectorOpen}
                    className={cn(
                      'w-full justify-between font-normal',
                      !selectedAssignPageOption && 'text-muted-foreground'
                    )}
                  >
                    <span className='truncate text-left'>
                      {selectedAssignPageOption?.pathLabel ?? 'Select leaf page'}
                    </span>
                    <CaretSortIcon className='ms-2 size-4 shrink-0 opacity-50' />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className='w-[var(--radix-popover-trigger-width)] p-0' align='start'>
                  <Command shouldFilter>
                    <CommandInput placeholder='Search page title or slug' />
                    <CommandList>
                      <CommandEmpty>No matching leaf pages.</CommandEmpty>
                      <CommandGroup>
                        {assignableLeafPages.map((option) => (
                          <CommandItem
                            key={option.page.id}
                            value={option.page.id}
                            keywords={[option.pathLabel, option.page.title, option.page.slug]}
                            onSelect={() => {
                              setAssignPageId(option.page.id)
                              const nextSortOrder = option.page.assigned_entities.reduce(
                                (max, item) => Math.max(max, item.sort_order),
                                0
                              ) + 1
                              setAssignSortOrder(nextSortOrder)
                              setAssignPageSelectorOpen(false)
                            }}
                            className='flex items-start justify-between gap-3'
                          >
                            <div className='min-w-0'>
                              <div className='truncate'>{option.pathLabel}</div>
                              <div className='truncate text-xs text-muted-foreground'>
                                /pages/{option.page.slug}
                              </div>
                            </div>
                            <CheckIcon
                              className={cn(
                                'size-4',
                                assignPageId === option.page.id ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Input
                placeholder='Display title'
                value={assignDisplayTitle}
                onChange={(e) => setAssignDisplayTitle(e.target.value)}
              />
              <div className='flex items-center justify-between rounded-md border p-3'>
                <span className='text-sm'>Filters enabled</span>
                <Checkbox checked={assignFiltersEnabled} onCheckedChange={(checked) => setAssignFiltersEnabled(checked === true)} />
              </div>
              <Input
                type='number'
                placeholder='Sort order'
                value={assignSortOrder}
                onChange={(e) => setAssignSortOrder(Number(e.target.value || 1))}
              />
              <div className='flex justify-end'>
                <Button
                  onClick={() => assignEntityMutation.mutate()}
                  disabled={
                    assignEntityMutation.isPending ||
                    assignPageId.length === 0 ||
                    assignDisplayTitle.trim().length === 0
                  }
                >
                  {assignEntityMutation.isPending ? 'Assigning...' : 'Assign'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={!!deleteEntityTarget}
          onOpenChange={(open) => !open && setDeleteEntityTarget(null)}
          title='Delete entity'
          desc={`Are you sure you want to delete ${deleteEntityTarget?.name ?? 'this entity'}?`}
          confirmText='Delete'
          destructive
          isLoading={deleteEntityMutation.isPending}
          handleConfirm={() => deleteEntityMutation.mutate()}
        />

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
                      {databases.map((database) => {
                        const databaseName =
                          typeof database === 'string' ? database : database.name
                        return (
                          <SelectItem key={databaseName} value={databaseName}>
                            {databaseName}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>

                  <Select value={selectedTable} onValueChange={setSelectedTable}>
                    <SelectTrigger>
                      <SelectValue placeholder='Select table' />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map((table) => {
                        const tableName = typeof table === 'string' ? table : table.name
                        return (
                          <SelectItem key={tableName} value={tableName}>
                            {tableName}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {databasesQuery.isError ? (
                  <div className='rounded-md border border-destructive/40 p-3 text-sm text-destructive'>
                    Failed to load databases
                    <pre className='mt-2 overflow-auto text-xs'>
                      {JSON.stringify(
                        (databasesQuery.error as AxiosError<{ detail?: unknown }>)?.response
                          ?.data?.detail ??
                          (databasesQuery.error as AxiosError)?.response?.data ??
                          '',
                        null,
                        2
                      )}
                    </pre>
                  </div>
                ) : null}

                {schemaColumns.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Column</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schemaColumns.map((column) => (
                        <TableRow key={column.name}>
                          <TableCell>{column.name}</TableCell>
                          <TableCell>{column.type}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : null}

                <div className='grid gap-3 md:grid-cols-1'>
                  <Input
                    placeholder='Entity name'
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
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
                      schemaColumns.length === 0 ||
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
