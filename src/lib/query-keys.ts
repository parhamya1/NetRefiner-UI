import type { UserRole } from '@/types/api'

export const QUERY_KEYS = {
  pages: {
    menuTreePrefix: ['pages', 'menu-tree'] as const,
    menuTree: (userId: string, role: UserRole) =>
      ['pages', 'menu-tree', userId, role] as const,
    sidebarFullPages: (userId: string, role: UserRole) =>
      ['pages', 'sidebar-full-pages', userId, role] as const,
    management: ['pages', 'management'] as const,
  },
  users: {
    pagePermissionsForSidebar: (userId: string, role: UserRole) =>
      ['users', 'page-permissions', 'sidebar', userId, role] as const,
  },
  entities: {
    summary: ['entities', 'summary'] as const,
  },
} as const
