import type { AxiosError } from 'axios'
import { apiClient } from './client'
import type {
  CsvConfirmPayload,
  CsvPreviewResponse,
  Entity,
  RegisterClickHouseTablePayload,
} from '@/types/api'

export async function previewCsvImport(file: File): Promise<CsvPreviewResponse> {
  return previewCsvImportWithMetadata({ file })
}

export async function previewCsvImportWithMetadata(payload: {
  file: File
  name?: string
  entity_name?: string
  table_name?: string
}): Promise<CsvPreviewResponse> {
  const formData = new FormData()
  formData.append('file', payload.file)
  if (payload.name) formData.append('name', payload.name)
  if (payload.entity_name) formData.append('entity_name', payload.entity_name)
  if (payload.table_name) formData.append('table_name', payload.table_name)

  // eslint-disable-next-line no-console
  console.log('CSV PREVIEW PAYLOAD', {
    file: payload.file.name,
    name: payload.name ?? null,
    entity_name: payload.entity_name ?? null,
    table_name: payload.table_name ?? null,
  })

  try {
    const { data } = await apiClient.post<CsvPreviewResponse>('/imports/csv/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  } catch (error) {
    const axiosError = error as AxiosError<{ detail?: unknown }>
    // eslint-disable-next-line no-console
    console.log('CSV PREVIEW ERROR RESPONSE', axiosError.response?.data)
    throw error
  }
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
