import { useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { FileText, FolderKanban, Settings, ShieldCheck, Users } from 'lucide-react'
import { getMenuTree, getPages } from '@/lib/api/pages'
import { QUERY_KEYS } from '@/lib/query-keys'
import { getUserPagePermissions } from '@/lib/api/users'
import { useAuthStore } from '@/stores/auth-store'
import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
// import { AppTitle } from './app-title'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { TeamSwitcher } from './team-switcher'
import { type MenuTreeNode, type Page, type PagePermission, type UserRole } from '@/types/api'
import { type NavGroup as NavGroupType, type NavItem, type SidebarData } from './types'

function toMenuTreeNode(page: Page, children: MenuTreeNode[]): MenuTreeNode {
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    parent_id: page.parent_id,
    menu_order: page.menu_order,
    is_menu_visible: page.is_menu_visible,
    assigned_entities: page.assigned_entities.map((entity) => ({
      id: entity.entity_id,
      name: entity.display_title,
    })),
    children,
  }
}

function buildMenuTreeFromPages(pages: Page[], includeIds?: Set<string>): MenuTreeNode[] {
  const filteredPages = pages.filter(
    (page) => page.is_menu_visible && (!includeIds || includeIds.has(page.id))
  )
  const pagesByParent = new Map<string | null, Page[]>()

  for (const page of filteredPages) {
    const siblings = pagesByParent.get(page.parent_id) ?? []
    siblings.push(page)
    pagesByParent.set(page.parent_id, siblings)
  }

  const buildNodes = (parentId: string | null): MenuTreeNode[] => {
    const siblings = (pagesByParent.get(parentId) ?? []).sort(
      (a, b) => a.menu_order - b.menu_order
    )

    return siblings.map((page) => toMenuTreeNode(page, buildNodes(page.id)))
  }

  return buildNodes(null)
}

function getIncludePageIdsForUser(pages: Page[], permissions: PagePermission[]): Set<string> {
  const pagesById = new Map(pages.map((page) => [page.id, page]))
  const allowedIds = new Set(
    permissions
      .filter((permission) => permission.can_view && pagesById.has(permission.page_id))
      .map((permission) => permission.page_id)
  )

  const includeIds = new Set<string>(allowedIds)

  for (const pageId of allowedIds) {
    const visited = new Set<string>([pageId])
    let parentId = pagesById.get(pageId)?.parent_id ?? null

    while (parentId && !visited.has(parentId)) {
      visited.add(parentId)
      includeIds.add(parentId)
      parentId = pagesById.get(parentId)?.parent_id ?? null
    }
  }

  return includeIds
}

function mapMenuNodeToNavItem(node: MenuTreeNode): NavItem {
  const sortedChildren = [...node.children]
    .filter((child) => child.is_menu_visible)
    .sort((a, b) => a.menu_order - b.menu_order)

  if (sortedChildren.length === 0) {
    return {
      title: node.title,
      url: `/pages/${node.slug}`,
      icon: FileText,
    }
  }

  return {
    title: node.title,
    icon: FileText,
    items: sortedChildren.map(mapMenuNodeToNavItem),
  }
}

function buildDynamicPageNavGroup(menuTree: MenuTreeNode[] | undefined): NavGroupType {
  const sortedRoots = (menuTree ?? [])
    .filter((node) => node.is_menu_visible)
    .sort((a, b) => a.menu_order - b.menu_order)

  const dynamicItems = sortedRoots.map(mapMenuNodeToNavItem)

  if (dynamicItems.length === 0) {
    return {
      title: 'Pages',
      items: [
        {
          title: 'No pages available',
          url: '/',
          icon: FileText,
        },
      ],
    }
  }

  return {
    title: 'Pages',
    items: dynamicItems,
  }
}

function buildManagementNavGroup(role: UserRole | undefined): NavGroupType | null {
  const isPageAdmin = role === 'admin' || role === 'superadmin'

  if (!isPageAdmin) return null

  return {
    title: 'Management',
    items: [
      {
        title: 'Page Management',
        url: '/page-management',
        icon: Settings,
      },
      {
        title: 'Entity Management',
        url: '/entity-management',
        icon: FolderKanban,
      },
      {
        title: 'User Management',
        url: '/user-management',
        icon: Users,
      },
      {
        title: 'Permission Management',
        url: '/permission-management',
        icon: ShieldCheck,
      },
    ],
  }
}

function buildSidebarData(
  menuTree: MenuTreeNode[] | undefined,
  user: SidebarData['user'],
  role: UserRole | undefined
): SidebarData {
  const managementGroup = buildManagementNavGroup(role)
  const dynamicPagesGroup = buildDynamicPageNavGroup(menuTree)

  return {
    ...sidebarData,
    user,
    navGroups: managementGroup
      ? [managementGroup, dynamicPagesGroup]
      : [dynamicPagesGroup],
  }
}

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const { auth } = useAuthStore()
  const currentUserId = auth.user?.id
  const currentUserRole = auth.user?.role
  const isAdminRole = auth.user?.role === 'admin' || auth.user?.role === 'superadmin'
  const isNormalUser = auth.user?.role === 'user'

  const { data: menuTree } = useQuery({
    queryKey: ['pages', 'menu-tree', currentUserId, currentUserRole],
    queryFn: getMenuTree,
    enabled: !!auth.accessToken && !!currentUserId && !isAdminRole,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  })

  const { data: pages } = useQuery({
    queryKey: [...QUERY_KEYS.pages.management, currentUserId, currentUserRole],
    queryFn: getPages,
    enabled: !!auth.accessToken && !!currentUserId,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  })

  const { data: selfPagePermissions } = useQuery({
    queryKey: ['users', 'page-permissions', 'sidebar', currentUserId, currentUserRole],
    queryFn: () => getUserPagePermissions(currentUserId!),
    enabled: !!auth.accessToken && !!currentUserId && isNormalUser,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  })

  const navUser = useMemo(
    () => ({
      name: auth.user?.full_name || auth.user?.email || 'User',
      email: auth.user?.email || 'user@example.com',
      avatar: '/avatars/01.png',
    }),
    [auth.user?.email, auth.user?.full_name]
  )

  const resolvedMenuTree = useMemo(() => {
    if (isAdminRole) {
      return buildMenuTreeFromPages(pages ?? [])
    }

    if (isNormalUser && pages) {
      const includeIds = getIncludePageIdsForUser(pages, selfPagePermissions ?? [])
      return buildMenuTreeFromPages(pages, includeIds)
    }

    return menuTree
  }, [isAdminRole, isNormalUser, menuTree, pages, selfPagePermissions])

  const resolvedSidebarData = useMemo(
    () => buildSidebarData(resolvedMenuTree, navUser, auth.user?.role),
    [auth.user?.role, navUser, resolvedMenuTree]
  )

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <TeamSwitcher teams={resolvedSidebarData.teams} />

        {/* Replace <TeamSwitch /> with the following <AppTitle />
         /* if you want to use the normal app title instead of TeamSwitch dropdown */}
        {/* <AppTitle /> */}
      </SidebarHeader>
      <SidebarContent>
        {resolvedSidebarData.navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={resolvedSidebarData.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
