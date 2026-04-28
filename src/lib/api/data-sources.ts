import { apiClient } from './client'
import type {
  ClickHouseDataSource,
  ClickHouseDataSourceCreatePayload,
  ClickHouseDatabase,
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
  const { data } = await apiClient.get<ClickHouseDatabase[]>(
    `/data-sources/clickhouse/${encodeURIComponent(dataSourceId)}/databases`
  )
  return data
}

export async function getClickHouseTables(
  dataSourceId: string,
  database: string
): Promise<ClickHouseTable[]> {
  const { data } = await apiClient.get<ClickHouseTable[]>(
    `/data-sources/clickhouse/${encodeURIComponent(dataSourceId)}/databases/${encodeURIComponent(database)}/tables`
  )
  return data
}

export async function getClickHouseTableSchema(
  dataSourceId: string,
  database: string,
  table: string
): Promise<ClickHouseSchemaColumn[]> {
  const { data } = await apiClient.get<ClickHouseSchemaColumn[]>(
    `/data-sources/clickhouse/${encodeURIComponent(dataSourceId)}/databases/${encodeURIComponent(database)}/tables/${encodeURIComponent(table)}/schema`
  )
  return data
}
