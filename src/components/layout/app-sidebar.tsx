import { useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { FileText, FolderKanban, Network, Settings, ShieldCheck, Users } from 'lucide-react'
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

function getPermissionPageId(permission: PagePermission): string {
  const withOptionalLegacy = permission as PagePermission & { pageId?: string }
  return String(withOptionalLegacy.page_id ?? withOptionalLegacy.pageId ?? '')
}

function toMenuTreeNode(page: Page, children: MenuTreeNode[]): MenuTreeNode {
  return {
    id: String(page.id),
    title: page.title,
    slug: page.slug,
    parent_id: page.parent_id == null ? null : String(page.parent_id),
    menu_order: page.menu_order,
    is_menu_visible: page.is_menu_visible,
    assigned_entities: page.assigned_entities.map((entity) => ({
      id: entity.entity_id,
      name: entity.display_title,
    })),
    children,
  }
}

function buildMenuTreeFromPages(pages: Page[]): MenuTreeNode[] {
  const map: Record<string, MenuTreeNode> = {}
  const roots: MenuTreeNode[] = []

  pages.forEach((page) => {
    const id = String(page.id)
    map[id] = toMenuTreeNode(page, [])
  })

  pages.forEach((page) => {
    const id = String(page.id)
    const parentId = page.parent_id ? String(page.parent_id) : null

    if (parentId && map[parentId]) {
      map[parentId].children.push(map[id])
    } else {
      roots.push(map[id])
    }
  })

  return roots
}

function getIncludePageIdsForUser(pages: Page[], permissions: PagePermission[]): {
  allowedIds: Set<string>
  includeIds: Set<string>
} {
  const pageById = new Map<string, Page>()

  for (const page of pages) {
    const id = String(page.id)
    pageById.set(id, page)
  }

  const allowedIds = new Set(
    permissions.filter((permission) => permission.can_view === true).map(getPermissionPageId)
  )

  const includeIds = new Set<string>(allowedIds)

  for (const allowedId of allowedIds) {
    let current = pageById.get(allowedId)
    const visited = new Set<string>()

    while (current && current.parent_id) {
      const parentId = String(current.parent_id)

      if (visited.has(parentId)) break
      visited.add(parentId)

      includeIds.add(parentId)
      current = pageById.get(parentId)
    }
  }

  return { allowedIds, includeIds }
}

export function buildPermittedPageTree(
  allPages: Page[],
  pagePermissions: PagePermission[]
): {
  tree: MenuTreeNode[]
  allowedIds: Set<string>
  includeIds: Set<string>
} {
  return buildPermittedSidebarTree(allPages, pagePermissions)
}

export function buildPermittedSidebarTree(
  allPages: Page[],
  pagePermissions: PagePermission[]
): {
  tree: MenuTreeNode[]
  allowedIds: Set<string>
  includeIds: Set<string>
} {
  const { allowedIds, includeIds } = getIncludePageIdsForUser(allPages, pagePermissions)
  const filteredPages = allPages.filter((page) => includeIds.has(String(page.id)))

  const tree = buildMenuTreeFromPages(filteredPages)
  return { tree, allowedIds, includeIds }
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
        title: 'Graph Mapping',
        url: '/graph-mapping',
        icon: Network,
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
    let resolved = menuTree

    if (isAdminRole) {
      resolved = buildMenuTreeFromPages(pages ?? [])
    } else if (isNormalUser && pages) {
      const allPages = pages
      const currentUserPermissions = auth.user?.page_permissions ?? selfPagePermissions ?? []
      const { tree, allowedIds, includeIds } = buildPermittedSidebarTree(
        allPages,
        currentUserPermissions
      )
      resolved = tree

      if (import.meta.env.DEV) {
        const filteredPages = allPages.filter((page) => includeIds.has(String(page.id)))
        // eslint-disable-next-line no-console
        console.log(
          'SIDEBAR allPages',
          allPages.map((page) => ({
            id: String(page.id),
            title: page.title,
            parent_id: page.parent_id,
          }))
        )
        // eslint-disable-next-line no-console
        console.log('SIDEBAR permissions', currentUserPermissions)
        // eslint-disable-next-line no-console
        console.log('SIDEBAR allowedIds', Array.from(allowedIds))
        // eslint-disable-next-line no-console
        console.log('SIDEBAR includeIds', Array.from(includeIds))
        // eslint-disable-next-line no-console
        console.log(
          'SIDEBAR filteredPages',
          filteredPages.map((page) => ({
            id: String(page.id),
            title: page.title,
            parent_id: page.parent_id,
          }))
        )
        // eslint-disable-next-line no-console
        console.log('SIDEBAR tree', tree)
      }
    }

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info('Sidebar resolved tree', {
        role: auth.user?.role,
        titles: (resolved ?? []).map((node) => node.title),
      })
    }

    return resolved
  }, [
    auth.user?.page_permissions,
    auth.user?.role,
    isAdminRole,
    isNormalUser,
    menuTree,
    pages,
    selfPagePermissions,
  ])

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
