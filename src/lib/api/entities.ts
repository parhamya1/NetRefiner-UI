import { apiClient } from './client'
import type {
  EntityQueryPayload,
  EntityReference,
  EntityRowsParams,
  EntityRowsResponse,
} from '@/types/api'

export async function listEntities(): Promise<EntityReference[]> {
  const { data } = await apiClient.get<EntityReference[]>('/entities')
  return data
}

export async function getEntity(entityId: string): Promise<EntityReference> {
  const { data } = await apiClient.get<EntityReference>(
    `/entities/${encodeURIComponent(entityId)}`
  )
  return data
}

export async function getEntityRows(
  entityId: string,
  params?: EntityRowsParams
): Promise<EntityRowsResponse> {
  const { data } = await apiClient.get<EntityRowsResponse>(
    `/entities/${encodeURIComponent(entityId)}/rows`,
    { params }
  )
  return data
}

export async function queryEntityRows(
  entityId: string,
  payload: EntityQueryPayload
): Promise<EntityRowsResponse> {
  const { data } = await apiClient.post<EntityRowsResponse>(
    `/entities/${encodeURIComponent(entityId)}/query`,
    payload
  )
  return data
}
