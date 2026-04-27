import { useMemo, useState } from 'react'
import { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, Ban, FileX } from 'lucide-react'
import { queryEntityRows } from '@/lib/api/entities'
import { getPageBySlug } from '@/lib/api/pages'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { type PageSectionColumn, type PageSectionConfig } from '@/types/api'

type DynamicPageProps = {
  slug: string
}

type SectionSortState = {
  column: string
  direction: 'asc' | 'desc'
}

type SectionFilterState = Record<
  string,
  {
    operator: string
    value: string
  }
>

function getPageErrorState(error: unknown) {
  if (!(error instanceof AxiosError)) return 'general' as const

  if (error.response?.status === 403) return 'forbidden' as const
  if (error.response?.status === 404) return 'not_found' as const

  return 'general' as const
}

function getColumnType(column: PageSectionColumn) {
  const type = column.clickhouse_type.toLowerCase()

  if (
    type.includes('int') ||
    type.includes('float') ||
    type.includes('decimal') ||
    type.includes('number')
  ) {
    return 'number' as const
  }

  if (
    type.includes('date') ||
    type.includes('datetime') ||
    type.includes('timestamp')
  ) {
    return 'date' as const
  }

  return 'text' as const
}

function getOperatorOptions(column: PageSectionColumn) {
  const columnType = getColumnType(column)

  if (columnType === 'number') {
    return [
      { label: 'Equals', value: 'equals' },
      { label: 'Greater than', value: 'greater_than' },
      { label: 'Less than', value: 'less_than' },
    ]
  }

  if (columnType === 'date') {
    return [
      { label: 'Equals', value: 'equals' },
      { label: 'On or after', value: 'greater_or_equal' },
      { label: 'On or before', value: 'less_or_equal' },
    ]
  }

  return [{ label: 'Contains', value: 'contains' }]
}

function getDefaultOperator(column: PageSectionColumn) {
  return getOperatorOptions(column)[0]?.value ?? 'contains'
}

function normalizeFilterValue(column: PageSectionColumn, value: string) {
  if (getColumnType(column) !== 'number') return value

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : value
}

function SectionRowsTable({
  section,
}: {
  section: PageSectionConfig
}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sortState, setSortState] = useState<SectionSortState | null>(null)
  const [filterState, setFilterState] = useState<SectionFilterState>({})

  const sectionColumns = section.columns

  const filterableColumns = useMemo(
    () => sectionColumns.filter((column) => column.is_filterable),
    [sectionColumns]
  )

  const activeFilters = useMemo(
    () =>
      filterableColumns.flatMap((column) => {
        const state = filterState[column.name]
        const filterValue = state?.value?.trim()

        if (!filterValue) return []

        return [
          {
            column: column.name,
            operator: state.operator,
            value: normalizeFilterValue(column, filterValue),
          },
        ]
      }),
    [filterState, filterableColumns]
  )

  const rowsQuery = useQuery({
    queryKey: [
      'pages',
      'section-query',
      section.entity_id,
      page,
      pageSize,
      sortState,
      activeFilters,
    ],
    queryFn: () =>
      queryEntityRows(section.entity_id, {
        filters: activeFilters,
        sort: sortState ?? undefined,
        page,
        page_size: pageSize,
      }),
  })

  const rowsData = rowsQuery.data
  const resolvedColumns =
    rowsData && rowsData.columns.length > 0 ? rowsData.columns : sectionColumns

  const canGoPrev = page > 1 && !rowsQuery.isLoading
  const canGoNext =
    (rowsData?.pagination.returned ?? 0) >= pageSize && !rowsQuery.isLoading

  function toggleSort(columnName: string) {
    setPage(1)
    setSortState((current) => {
      if (!current || current.column !== columnName) {
        return { column: columnName, direction: 'asc' }
      }

      if (current.direction === 'asc') {
        return { column: columnName, direction: 'desc' }
      }

      return null
    })
  }

  function updateFilterValue(columnName: string, value: string) {
    setPage(1)
    setFilterState((current) => {
      const existing = current[columnName]
      const column = filterableColumns.find((item) => item.name === columnName)
      const operator = existing?.operator || (column ? getDefaultOperator(column) : 'contains')

      return {
        ...current,
        [columnName]: {
          operator,
          value,
        },
      }
    })
  }

  function updateFilterOperator(columnName: string, operator: string) {
    setPage(1)
    setFilterState((current) => ({
      ...current,
      [columnName]: {
        operator,
        value: current[columnName]?.value ?? '',
      },
    }))
  }

  function resetControls() {
    setPage(1)
    setPageSize(50)
    setSortState(null)
    setFilterState({})
  }

  if (rowsQuery.isLoading && !rowsData) {
    return (
      <div className='space-y-2'>
        <Skeleton className='h-8 w-full' />
        <Skeleton className='h-8 w-full' />
        <Skeleton className='h-8 w-full' />
      </div>
    )
  }

  if (rowsQuery.isError && !rowsData) {
    return (
      <Alert variant='destructive'>
        <AlertCircle />
        <AlertTitle>Unable to load section data</AlertTitle>
        <AlertDescription>
          We could not load rows for <strong>{section.display_title}</strong>.
        </AlertDescription>
      </Alert>
    )
  }

  if (resolvedColumns.length === 0) {
    return (
      <Alert>
        <AlertCircle />
        <AlertTitle>No columns configured</AlertTitle>
        <AlertDescription>
          This section has no columns available to display.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className='space-y-4'>
      {filterableColumns.length > 0 && (
        <div className='grid gap-3 rounded-md border p-3 sm:grid-cols-2 xl:grid-cols-3'>
          {filterableColumns.map((column) => {
            const filter = filterState[column.name]
            const operator = filter?.operator || getDefaultOperator(column)
            const value = filter?.value ?? ''

            return (
              <div key={`${section.entity_id}-filter-${column.name}`} className='space-y-2'>
                <p className='text-sm font-medium'>{column.label || column.name}</p>
                <div className='flex gap-2'>
                  <Select
                    value={operator}
                    onValueChange={(nextOperator) =>
                      updateFilterOperator(column.name, nextOperator)
                    }
                  >
                    <SelectTrigger className='w-44'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getOperatorOptions(column).map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={value}
                    onChange={(event) =>
                      updateFilterValue(column.name, event.target.value)
                    }
                    placeholder={`Filter ${column.label || column.name}`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <p className='text-sm text-muted-foreground'>Page size</p>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPage(1)
              setPageSize(Number(value))
            }}
          >
            <SelectTrigger className='w-24'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='10'>10</SelectItem>
              <SelectItem value='25'>25</SelectItem>
              <SelectItem value='50'>50</SelectItem>
              <SelectItem value='100'>100</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant='outline' onClick={resetControls}>
          Reset filters
        </Button>
      </div>

      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              {resolvedColumns.map((column) => {
                const isSorted = sortState?.column === column.name
                const sortDirection = isSorted ? sortState?.direction : null

                return (
                  <TableHead key={`${section.entity_id}-${column.name}`}>
                    <Button
                      type='button'
                      variant='ghost'
                      className='-ms-3 h-8 px-3'
                      onClick={() => toggleSort(column.name)}
                    >
                      <span>{column.label || column.name}</span>
                      {sortDirection === 'asc' ? (
                        <ArrowUp className='ms-1 size-3.5' />
                      ) : sortDirection === 'desc' ? (
                        <ArrowDown className='ms-1 size-3.5' />
                      ) : (
                        <ArrowUpDown className='ms-1 size-3.5' />
                      )}
                    </Button>
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowsData && rowsData.rows.length > 0 ? (
              rowsData.rows.map((row, rowIndex) => (
                <TableRow key={`${section.entity_id}-row-${rowIndex}`}>
                  {resolvedColumns.map((column) => (
                    <TableCell key={`${section.entity_id}-${rowIndex}-${column.name}`}>
                      {String(row[column.name] ?? '-')}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={resolvedColumns.length}
                  className='h-24 text-center text-muted-foreground'
                >
                  No rows available.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className='flex items-center justify-between gap-2'>
        <p className='text-sm text-muted-foreground'>
          Page {page} • Returned {rowsData?.pagination.returned ?? 0} rows
        </p>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={!canGoPrev}
          >
            Previous
          </Button>
          <Button
            variant='outline'
            onClick={() => setPage((prev) => prev + 1)}
            disabled={!canGoNext}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

export function DynamicPage({ slug }: DynamicPageProps) {
  const pageQuery = useQuery({
    queryKey: ['pages', 'by-slug', slug],
    queryFn: () => getPageBySlug(slug),
    retry: false,
  })

  const sections = useMemo(
    () =>
      [...(pageQuery.data?.sections ?? [])].sort(
        (a, b) => a.sort_order - b.sort_order
      ),
    [pageQuery.data?.sections]
  )

  const pageErrorState = pageQuery.error
    ? getPageErrorState(pageQuery.error)
    : null

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        {pageQuery.isLoading ? (
          <>
            <Skeleton className='h-8 w-56' />
            <Skeleton className='h-44 w-full' />
            <Skeleton className='h-44 w-full' />
          </>
        ) : pageErrorState === 'forbidden' ? (
          <Alert variant='destructive'>
            <Ban />
            <AlertTitle>Access denied</AlertTitle>
            <AlertDescription>
              You do not have permission to view this page.
            </AlertDescription>
          </Alert>
        ) : pageErrorState === 'not_found' ? (
          <Alert>
            <FileX />
            <AlertTitle>Page not found</AlertTitle>
            <AlertDescription>
              The requested page could not be found.
            </AlertDescription>
          </Alert>
        ) : pageErrorState === 'general' ? (
          <Alert variant='destructive'>
            <AlertCircle />
            <AlertTitle>Unable to load page</AlertTitle>
            <AlertDescription>
              Something went wrong while loading this page.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div>
              <h2 className='text-2xl font-bold tracking-tight'>
                {pageQuery.data?.title}
              </h2>
              <p className='text-muted-foreground'>
                Dynamic page:{' '}
                <span className='font-medium'>{pageQuery.data?.slug}</span>
              </p>
            </div>

            {sections.length === 0 ? (
              <Alert>
                <AlertCircle />
                <AlertTitle>No sections configured</AlertTitle>
                <AlertDescription>
                  This page does not have any sections yet.
                </AlertDescription>
              </Alert>
            ) : (
              sections.map((section) => (
                <Card key={section.entity_id}>
                  <CardHeader>
                    <CardTitle>{section.display_title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SectionRowsTable section={section} />
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}
      </Main>
    </>
  )
}
