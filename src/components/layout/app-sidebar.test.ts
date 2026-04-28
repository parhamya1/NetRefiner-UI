import { describe, expect, it } from 'vitest'
import { buildPermittedSidebarTree } from './app-sidebar'
import type { Page, PagePermission } from '@/types/api'

describe('buildPermittedSidebarTree', () => {
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
    const { tree } = buildPermittedSidebarTree(pages, permissions)

    expect(tree.map((node) => node.title)).toEqual(['Reporting'])
    expect(tree[0]?.children.map((node) => node.title)).toEqual(['PM'])
    expect(tree[0]?.children[0]?.children.map((node) => node.title)).toEqual(['test4'])
  })

  it('returns empty tree when no permissions are granted', () => {
    const permissions: PagePermission[] = [{ page_id: 'test4', can_view: false }]
    const { tree } = buildPermittedSidebarTree(pages, permissions)

    expect(tree).toEqual([])
  })

  it('includes only Reporting > CM > test2 when only test2 is permitted', () => {
    const permissions: PagePermission[] = [{ page_id: 'test2', can_view: true }]
    const { tree, includeIds } = buildPermittedSidebarTree(pages, permissions)

    expect(Array.from(includeIds)).toEqual(['test2', 'cm', 'reporting'])
    expect(tree.map((node) => node.title)).toEqual(['Reporting'])
    expect(tree[0]?.children.map((node) => node.title)).toEqual(['CM'])
    expect(tree[0]?.children[0]?.children.map((node) => node.title)).toEqual(['test2'])
  })

  it('includes only Reporting > PM when only PM is permitted', () => {
    const permissions: PagePermission[] = [{ page_id: 'pm', can_view: true }]
    const { tree } = buildPermittedSidebarTree(pages, permissions)

    expect(tree.map((node) => node.title)).toEqual(['Reporting'])
    expect(tree[0]?.children.map((node) => node.title)).toEqual(['PM'])
    expect(tree[0]?.children[0]?.children).toEqual([])
  })
})
