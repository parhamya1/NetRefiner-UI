import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryEntityRows } from '@/lib/api/entities'
import type { EntityQuerySort, PageSectionColumn } from '@/types/api'
import {
  buildQueryFilters,
  getDefaultOperator,
  getOperatorsForColumn,
  isFilterableColumn,
  type EntityTableFilterState,
  type EntityTableOperator,
} from '../utils/entity-table-utils'

type UseEntityTableQueryInput = {
  entityId: string
  columns: PageSectionColumn[]
  initialPageSize?: number
}

export function useEntityTableQuery({
  entityId,
  columns,
  initialPageSize = 50,
}: UseEntityTableQueryInput) {
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState(initialPageSize)
  const [sort, setSort] = useState<EntityQuerySort | null>(null)
  const [filters, setFilters] = useState<EntityTableFilterState>({})

  const filterableColumns = useMemo(
    () => columns.filter(isFilterableColumn),
    [columns]
  )

  const queryFilters = useMemo(
    () => buildQueryFilters(filters, filterableColumns),
    [filterableColumns, filters]
  )

  const query = useQuery({
    queryKey: [
      'pages',
      'section-query',
      entityId,
      page,
      pageSize,
      sort,
      queryFilters,
    ],
    queryFn: () =>
      queryEntityRows(entityId, {
        filters: queryFilters,
        sort: sort ?? undefined,
        page,
        page_size: pageSize,
      }),
  })

  const rows = query.data?.rows ?? []
  const resolvedColumns =
    query.data && query.data.columns.length > 0 ? query.data.columns : columns

  const pagination = query.data?.pagination ?? {
    page,
    page_size: pageSize,
    returned: 0,
  }

  const canGoPrevious = page > 1 && !query.isLoading
  const canGoNext = pagination.returned >= pageSize && !query.isLoading

  function setFilterValue(columnName: string, value: string) {
    setPageState(1)
    setFilters((current) => {
      const existing = current[columnName]
      const column = filterableColumns.find((item) => item.name === columnName)
      const operator =
        existing?.operator || (column ? getDefaultOperator(column) : 'contains')

      return {
        ...current,
        [columnName]: {
          operator,
          value,
        },
      }
    })
  }

  function setFilterOperator(columnName: string, operator: EntityTableOperator) {
    setPageState(1)
    setFilters((current) => ({
      ...current,
      [columnName]: {
        operator,
        value: current[columnName]?.value ?? '',
      },
    }))
  }

  function toggleSort(columnName: string) {
    setPageState(1)
    setSort((current) => {
      if (!current || current.column !== columnName) {
        return { column: columnName, direction: 'asc' }
      }

      if (current.direction === 'asc') {
        return { column: columnName, direction: 'desc' }
      }

      return null
    })
  }

  function resetFilters() {
    setPageState(1)
    setPageSizeState(initialPageSize)
    setSort(null)
    setFilters({})
  }

  function setPage(nextPage: number | ((prev: number) => number)) {
    setPageState(nextPage)
  }

  function setPageSize(nextPageSize: number) {
    setPageState(1)
    setPageSizeState(nextPageSize)
  }

  return {
    columns: resolvedColumns,
    rows,
    pagination,
    filters,
    sort,
    page,
    pageSize,
    isLoading: query.isLoading,
    error: query.error,
    canGoPrevious,
    canGoNext,
    filterableColumns,
    getOperatorOptions: getOperatorsForColumn,
    setFilterValue,
    setFilterOperator,
    resetFilters,
    toggleSort,
    setPage,
    setPageSize,
  }
}
