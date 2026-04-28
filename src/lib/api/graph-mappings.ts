import { apiClient } from './client'
import type { GraphMapping, GraphMappingPayload } from '@/types/api'

export async function getGraphMappings(): Promise<GraphMapping[]> {
  const { data } = await apiClient.get<GraphMapping[]>('/graph-mappings')
  return data
}

export async function createGraphMapping(payload: GraphMappingPayload): Promise<GraphMapping> {
  const { data } = await apiClient.post<GraphMapping>('/graph-mappings', payload)
  return data
}

export async function getGraphMapping(mappingId: string): Promise<GraphMapping> {
  const { data } = await apiClient.get<GraphMapping>(`/graph-mappings/${encodeURIComponent(mappingId)}`)
  return data
}

export async function updateGraphMapping(
  mappingId: string,
  payload: GraphMappingPayload
): Promise<GraphMapping> {
  const { data } = await apiClient.put<GraphMapping>(
    `/graph-mappings/${encodeURIComponent(mappingId)}`,
    payload
  )
  return data
}

export async function deleteGraphMapping(mappingId: string): Promise<void> {
  await apiClient.delete(`/graph-mappings/${encodeURIComponent(mappingId)}`)
}
