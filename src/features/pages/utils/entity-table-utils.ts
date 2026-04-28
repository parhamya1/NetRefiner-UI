import type { EntityQueryFilter, PageSectionColumn } from '@/types/api'

export type EntityTableOperator =
  | 'contains'
  | 'equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'

export type EntityTableFilterState = Record<
  string,
  {
    operator: EntityTableOperator
    value: string
  }
>

export function getColumnLabel(column: PageSectionColumn) {
  return column.label || column.name
}

export function isFilterableColumn(column: PageSectionColumn) {
  return column.is_filterable
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

export function getOperatorsForColumn(column: PageSectionColumn) {
  const columnType = getColumnType(column)

  if (columnType === 'number') {
    return [
      { label: 'Equals', value: 'equals' },
      { label: 'Greater than', value: 'greater_than' },
      { label: 'Less than', value: 'less_than' },
    ] satisfies Array<{ label: string; value: EntityTableOperator }>
  }

  if (columnType === 'date') {
    return [
      { label: 'Equals', value: 'equals' },
      { label: 'On or after', value: 'greater_or_equal' },
      { label: 'On or before', value: 'less_or_equal' },
    ] satisfies Array<{ label: string; value: EntityTableOperator }>
  }

  return [
    { label: 'Contains', value: 'contains' },
  ] satisfies Array<{ label: string; value: EntityTableOperator }>
}

export function getDefaultOperator(column: PageSectionColumn): EntityTableOperator {
  return getOperatorsForColumn(column)[0]?.value ?? 'contains'
}

export function normalizeFilterValue(value: string, column: PageSectionColumn) {
  if (getColumnType(column) !== 'number') return value

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : value
}

export function buildQueryFilters(
  filters: EntityTableFilterState,
  columns: PageSectionColumn[]
): EntityQueryFilter[] {
  return columns.flatMap((column) => {
    const state = filters[column.name]
    const filterValue = state?.value?.trim()

    if (!filterValue) return []

    return [
      {
        column: column.name,
        operator: state.operator,
        value: normalizeFilterValue(filterValue, column),
      },
    ]
  })
}
