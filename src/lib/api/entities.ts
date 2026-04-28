import type { AxiosError } from 'axios'
import { apiClient } from './client'
import type {
  Entity,
  EntityCreatePayload,
  EntityQueryPayload,
  EntityReference,
  EntityRowsParams,
  EntityRowsResponse,
} from '@/types/api'

export async function getEntities(): Promise<Entity[]> {
  const { data } = await apiClient.get<Entity[]>('/entities')
  return data
}

export async function createEntity(payload: EntityCreatePayload): Promise<Entity> {
  try {
    const { data } = await apiClient.post<Entity>('/entities', payload)
    return data
  } catch (error) {
    const axiosError = error as AxiosError<{ detail?: unknown }>
    // eslint-disable-next-line no-console
    console.log('CREATE ENTITY ERROR RESPONSE', axiosError.response?.data)
    // eslint-disable-next-line no-console
    console.log('CREATE ENTITY SENT PAYLOAD', payload)
    throw error
  }
}

export async function getEntity(entityId: string): Promise<EntityReference> {
  const { data } = await apiClient.get<EntityReference>(
    `/entities/${encodeURIComponent(entityId)}`
  )
  return data
}

export async function deleteEntity(entityId: string): Promise<void> {
  await apiClient.delete(`/entities/${encodeURIComponent(entityId)}`)
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


export async function createEntityRow(
  entityId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { data } = await apiClient.post<Record<string, unknown>>(
    `/entities/${encodeURIComponent(entityId)}/rows`,
    payload
  )
  return data
}

export async function updateEntityRow(
  entityId: string,
  rowId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { data } = await apiClient.put<Record<string, unknown>>(
    `/entities/${encodeURIComponent(entityId)}/rows/${encodeURIComponent(rowId)}`,
    payload
  )
  return data
}

export async function deleteEntityRow(
  entityId: string,
  rowId: string
): Promise<void> {
  await apiClient.delete(
    `/entities/${encodeURIComponent(entityId)}/rows/${encodeURIComponent(rowId)}`
  )
}

export const listEntities = getEntities
