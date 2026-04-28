import { apiClient } from './client'
import type {
  MenuTreeNode,
  Page,
  PageConfig,
  PageCreatePayload,
  PageUpdatePayload,
} from '@/types/api'

export async function getMenuTree(): Promise<MenuTreeNode[]> {
  const { data } = await apiClient.get<MenuTreeNode[]>('/pages/menu-tree')
  return data
}

export async function getPageBySlug(slug: string): Promise<PageConfig> {
  const { data } = await apiClient.get<PageConfig>(
    `/pages/by-slug/${encodeURIComponent(slug)}`
  )
  return data
}

export async function getPages(): Promise<Page[]> {
  const { data } = await apiClient.get<Page[]>('/pages')
  return data
}

export async function getPage(pageId: string): Promise<Page> {
  const { data } = await apiClient.get<Page>(`/pages/${encodeURIComponent(pageId)}`)
  return data
}

export async function createPage(payload: PageCreatePayload): Promise<Page> {
  const { data } = await apiClient.post<Page>('/pages', payload)
  return data
}

export async function updatePage(
  pageId: string,
  payload: PageUpdatePayload
): Promise<Page> {
  const { data } = await apiClient.put<Page>(
    `/pages/${encodeURIComponent(pageId)}`,
    payload
  )
  return data
}

export async function deletePage(pageId: string): Promise<void> {
  await apiClient.delete(`/pages/${encodeURIComponent(pageId)}`)
}
