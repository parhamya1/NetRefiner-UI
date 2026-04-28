export const QUERY_KEYS = {
  pages: {
    menuTree: ['pages', 'menu-tree'] as const,
    management: ['pages', 'management'] as const,
    bySlug: (slug: string) => ['pages', 'by-slug', slug] as const,
  },
  entities: {
    summary: ['entities', 'summary'] as const,
  },
} as const
