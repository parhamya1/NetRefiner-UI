import { apiClient } from './client'
import type {
  ClickHouseDataSource,
  ClickHouseDataSourceCreatePayload,
  ClickHouseDatabase,
  ClickHouseSchemaResponse,
  ClickHouseSchemaColumn,
  ClickHouseTable,
} from '@/types/api'

export async function getClickHouseDataSources(): Promise<ClickHouseDataSource[]> {
  const { data } = await apiClient.get<ClickHouseDataSource[]>('/data-sources/clickhouse')
  return data
}

export async function createClickHouseDataSource(
  payload: ClickHouseDataSourceCreatePayload
): Promise<ClickHouseDataSource> {
  const { data } = await apiClient.post<ClickHouseDataSource>(
    '/data-sources/clickhouse',
    payload
  )
  return data
}

export async function getClickHouseDatabases(
  dataSourceId: string
): Promise<ClickHouseDatabase[]> {
  const { data } = await apiClient.get<
    ClickHouseDatabase[] | { databases?: ClickHouseDatabase[] }
  >(
    `/data-sources/clickhouse/${encodeURIComponent(dataSourceId)}/databases`
  )
  if (Array.isArray(data)) return data
  if (Array.isArray(data.databases)) return data.databases
  return []
}

export async function getClickHouseTables(
  dataSourceId: string,
  database: string
): Promise<ClickHouseTable[]> {
  const { data } = await apiClient.get<ClickHouseTable[] | { tables?: ClickHouseTable[] }>(
    `/data-sources/clickhouse/${encodeURIComponent(dataSourceId)}/databases/${encodeURIComponent(database)}/tables`
  )
  if (Array.isArray(data)) return data
  if (Array.isArray(data.tables)) return data.tables
  return []
}

export async function getClickHouseTableSchema(
  dataSourceId: string,
  database: string,
  table: string
): Promise<ClickHouseSchemaResponse> {
  const { data } = await apiClient.get<ClickHouseSchemaResponse | ClickHouseSchemaColumn[]>(
    `/data-sources/clickhouse/${encodeURIComponent(dataSourceId)}/databases/${encodeURIComponent(database)}/tables/${encodeURIComponent(table)}/schema`
  )
  if (Array.isArray(data)) {
    return { database, table, columns: data }
  }
  return data
}
