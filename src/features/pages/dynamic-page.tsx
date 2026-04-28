import { useMemo, useState } from 'react'
import { AxiosError } from 'axios'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertCircle, AlertTriangle, ArrowUpDown, Ban, FileX, Pencil, Plus, Trash2 } from 'lucide-react'
import { deleteEntityRow } from '@/lib/api/entities'
import { getPageBySlug } from '@/lib/api/pages'
import { handleServerError } from '@/lib/handle-server-error'
import { useAuthStore } from '@/stores/auth-store'
import { ConfigDrawer } from '@/components/config-drawer'
import { ConfirmDialog } from '@/components/confirm-dialog'
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
import { type PageSectionConfig } from '@/types/api'
import { RowFormDialog } from './components/row-form-dialog'
import { useEntityTableQuery } from './hooks/use-entity-table-query'
import { getColumnLabel, type EntityTableOperator } from './utils/entity-table-utils'

type DynamicPageProps = {
  slug: string
}

function getPageErrorState(error: unknown) {
  if (!(error instanceof AxiosError)) return 'general' as const

  if (error.response?.status === 403) return 'forbidden' as const
  if (error.response?.status === 404) return 'not_found' as const

  return 'general' as const
}
function SectionRowsTable({
  section,
}: {
  section: PageSectionConfig
}) {
  const { auth } = useAuthStore()
  const canManageRows =
    auth.user?.role === 'admin' || auth.user?.role === 'superadmin'

  const [rowDialogOpen, setRowDialogOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null)
  const [deletingRow, setDeletingRow] = useState<Record<string, unknown> | null>(null)

  const {
    columns,
    rows,
    pagination,
    filters,
    sort,
    page,
    pageSize,
    isLoading,
    error,
    canGoPrevious,
    canGoNext,
    filterableColumns,
    getOperatorOptions,
    setFilterValue,
    setFilterOperator,
    resetFilters,
    toggleSort,
    setPage,
    setPageSize,
    refetch,
  } = useEntityTableQuery({
    entityId: section.entity_id,
    columns: section.columns,
  })

  function resolveRowId(row: Record<string, unknown>) {
    const value = row.row_id ?? row.id
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value)
    }

    return null
  }

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deletingRow) return
      const rowId = resolveRowId(deletingRow)
      if (!rowId) return

      await deleteEntityRow(section.entity_id, rowId)
    },
    onSuccess: async () => {
      setDeletingRow(null)
      await refetch()
    },
    onError: handleServerError,
  })

  if (isLoading && rows.length === 0) {
    return (
      <div className='space-y-2'>
        <Skeleton className='h-8 w-full' />
        <Skeleton className='h-8 w-full' />
        <Skeleton className='h-8 w-full' />
      </div>
    )
  }

  if (error && rows.length === 0) {
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

  if (columns.length === 0) {
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
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm font-medium'>Section controls</p>
        <div className='flex items-center gap-2'>
          <Button variant='outline' size='sm' onClick={resetFilters}>
            Reset filters
          </Button>
          {canManageRows ? (
            <Button
              size='sm'
              onClick={() => {
                setEditingRow(null)
                setRowDialogOpen(true)
              }}
            >
              <Plus className='mr-1 size-3.5' />
              Create Row
            </Button>
          ) : null}
        </div>
      </div>

      {filterableColumns.length > 0 && (
        <div className='grid gap-3 rounded-md border p-3 sm:grid-cols-2 xl:grid-cols-3'>
          {filterableColumns.map((column) => {
            const filter = filters[column.name]
            const operator =
              filter?.operator || getOperatorOptions(column)[0]?.value || 'contains'
            const value = filter?.value ?? ''

            return (
              <div key={`${section.entity_id}-filter-${column.name}`} className='space-y-1.5'>
                <p className='text-xs font-medium text-muted-foreground'>
                  {getColumnLabel(column)}
                </p>
                <div className='flex gap-2'>
                  <Select
                    value={operator}
                    onValueChange={(nextOperator) =>
                      setFilterOperator(column.name, nextOperator as EntityTableOperator)
                    }
                  >
                    <SelectTrigger className='h-8 w-40 text-xs'>
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
                    className='h-8'
                    value={value}
                    onChange={(event) =>
                      setFilterValue(column.name, event.target.value)
                    }
                    placeholder={`Filter ${getColumnLabel(column)}`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className='overflow-x-auto rounded-md border'>
        <Table className='min-w-max'>
          <TableHeader>
            <TableRow>
              {columns.map((column) => {
                const isSorted = sort?.column === column.name
                const sortDirection = isSorted ? sort?.direction : null

                return (
                  <TableHead key={`${section.entity_id}-${column.name}`}>
                    <Button
                      type='button'
                      variant='ghost'
                      className='-ms-3 h-8 px-3'
                      onClick={() => toggleSort(column.name)}
                    >
                      <span>{getColumnLabel(column)}</span>
                      {sortDirection === 'asc' ? (
                        <span className='ms-1 text-xs'>↑</span>
                      ) : sortDirection === 'desc' ? (
                        <span className='ms-1 text-xs'>↓</span>
                      ) : (
                        <ArrowUpDown className='ms-1 size-3.5' />
                      )}
                    </Button>
                  </TableHead>
                )
              })}
              {canManageRows ? <TableHead className='w-[120px] text-right'>Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row, rowIndex) => (
                <TableRow key={`${section.entity_id}-row-${rowIndex}`}>
                  {columns.map((column) => (
                    <TableCell key={`${section.entity_id}-${rowIndex}-${column.name}`}>
                      {String(row[column.name] ?? '-')}
                    </TableCell>
                  ))}
                  {canManageRows ? (
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-1'>
                        <Button
                          type='button'
                          size='icon'
                          variant='outline'
                          onClick={() => {
                            setEditingRow(row)
                            setRowDialogOpen(true)
                          }}
                        >
                          <Pencil className='size-3.5' />
                        </Button>
                        <Button
                          type='button'
                          size='icon'
                          variant='destructive'
                          onClick={() => setDeletingRow(row)}
                        >
                          <Trash2 className='size-3.5' />
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (canManageRows ? 1 : 0)}
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
        <div className='flex flex-wrap items-center gap-3 text-sm text-muted-foreground'>
          <p>Page {page}</p>
          <p>Showing {pagination.returned} rows</p>
          <div className='flex items-center gap-2'>
            <span>Page size</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value))
              }}
            >
              <SelectTrigger className='h-8 w-20'>
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
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={!canGoPrevious}
          >
            Previous
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setPage((prev) => prev + 1)}
            disabled={!canGoNext}
          >
            Next
          </Button>
        </div>
      </div>

      {canManageRows ? (
        <>
          {rowDialogOpen ? (
            <RowFormDialog
              key={editingRow ? `edit-${resolveRowId(editingRow)}` : 'create'}
              open={rowDialogOpen}
              onOpenChange={setRowDialogOpen}
              entityId={section.entity_id}
              columns={columns}
              row={editingRow}
              rowId={editingRow ? resolveRowId(editingRow) : null}
              onSuccess={async () => {
                await refetch()
              }}
            />
          ) : null}
          <ConfirmDialog
            open={!!deletingRow}
            onOpenChange={(open) => {
              if (!open) setDeletingRow(null)
            }}
            handleConfirm={() => deleteMutation.mutate()}
            title={
              <span className='text-destructive'>
                <AlertTriangle className='me-1 inline-block size-4' />
                Delete row
              </span>
            }
            desc='Are you sure you want to delete this row? This action cannot be undone.'
            confirmText='Delete'
            destructive
            isLoading={deleteMutation.isPending}
            disabled={!deletingRow || !resolveRowId(deletingRow)}
          />
        </>
      ) : null}
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
