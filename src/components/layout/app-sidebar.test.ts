import { describe, expect, it } from 'vitest'
import { buildPermittedPageTree } from './app-sidebar'
import type { Page, PagePermission } from '@/types/api'

describe('buildPermittedPageTree', () => {
  const pages: Page[] = [
    { id: 'reporting', title: 'Reporting', slug: 'reporting', parent_id: null, menu_order: 1, is_menu_visible: true, assigned_entities: [] },
    { id: 'cm', title: 'CM', slug: 'cm', parent_id: 'reporting', menu_order: 1, is_menu_visible: true, assigned_entities: [] },
    { id: 'test1', title: 'test1', slug: 'test1', parent_id: 'cm', menu_order: 1, is_menu_visible: true, assigned_entities: [] },
    { id: 'test2', title: 'test2', slug: 'test2', parent_id: 'cm', menu_order: 2, is_menu_visible: true, assigned_entities: [] },
    { id: 'pm', title: 'PM', slug: 'pm', parent_id: 'reporting', menu_order: 2, is_menu_visible: true, assigned_entities: [] },
    { id: 'test3', title: 'test3', slug: 'test3', parent_id: 'pm', menu_order: 1, is_menu_visible: true, assigned_entities: [] },
    { id: 'test4', title: 'test4', slug: 'test4', parent_id: 'pm', menu_order: 2, is_menu_visible: true, assigned_entities: [] },
  ]

  it('includes allowed child and all ancestors only', () => {
    const permissions: PagePermission[] = [{ page_id: 'test4', can_view: true }]
    const { tree } = buildPermittedPageTree(pages, permissions)

    expect(tree.map((node) => node.title)).toEqual(['Reporting'])
    expect(tree[0]?.children.map((node) => node.title)).toEqual(['PM'])
    expect(tree[0]?.children[0]?.children.map((node) => node.title)).toEqual(['test4'])
  })

  it('returns empty tree when no permissions are granted', () => {
    const permissions: PagePermission[] = [{ page_id: 'test4', can_view: false }]
    const { tree } = buildPermittedPageTree(pages, permissions)

    expect(tree).toEqual([])
  })
})
