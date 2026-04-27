import { apiClient } from './client'
import type { MenuTreeNode, PageConfig } from '@/types/api'

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
