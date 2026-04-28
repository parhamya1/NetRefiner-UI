import { apiClient } from './client'
import type {
  CsvConfirmPayload,
  CsvPreviewResponse,
  Entity,
  RegisterClickHouseTablePayload,
} from '@/types/api'

export async function previewCsvImport(file: File): Promise<CsvPreviewResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await apiClient.post<CsvPreviewResponse>('/imports/csv/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function confirmCsvImport(payload: CsvConfirmPayload): Promise<Entity> {
  const { data } = await apiClient.post<Entity>('/imports/csv/confirm', payload)
  return data
}

export async function registerClickHouseTable(
  payload: RegisterClickHouseTablePayload
): Promise<Entity> {
  const { data } = await apiClient.post<Entity>('/imports/clickhouse/register-table', payload)
  return data
}
