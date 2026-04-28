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

function getPageId(page: Page): string {
  const withOptionalLegacy = page as Page & { _id?: string }
  return String(withOptionalLegacy.id ?? withOptionalLegacy._id ?? '')
}

function getParentId(page: Page): string | null {
  const withOptionalLegacy = page as Page & { parentId?: string | null }
  const normalizedParentId = withOptionalLegacy.parent_id ?? withOptionalLegacy.parentId ?? null
  return normalizedParentId == null ? null : String(normalizedParentId)
}

function getPermissionPageId(permission: PagePermission): string {
  const withOptionalLegacy = permission as PagePermission & { pageId?: string }
  return String(withOptionalLegacy.page_id ?? withOptionalLegacy.pageId ?? '')
}

function toMenuTreeNode(page: Page, children: MenuTreeNode[]): MenuTreeNode {
  return {
    id: getPageId(page),
    title: page.title,
    slug: page.slug,
    parent_id: getParentId(page),
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
    const id = getPageId(page)
    map[id] = toMenuTreeNode(page, [])
  })

  pages.forEach((page) => {
    const id = getPageId(page)
    const parentId = getParentId(page)

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
  const pagesById = new Map(pages.map((page) => [getPageId(page), page]))
  const allowedIds = new Set(
    permissions
      .map((permission) => ({
        canView: permission.can_view,
        pageId: getPermissionPageId(permission),
      }))
      .filter((permission) => permission.canView && pagesById.has(permission.pageId))
      .map((permission) => permission.pageId)
  )

  const includeIds = new Set<string>(allowedIds)

  for (const pageId of allowedIds) {
    const visited = new Set<string>([pageId])
    let parentId = pagesById.get(pageId) ? getParentId(pagesById.get(pageId)!) : null

    while (parentId && !visited.has(parentId)) {
      visited.add(parentId)
      includeIds.add(parentId)
      parentId = pagesById.get(parentId) ? getParentId(pagesById.get(parentId)!) : null
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
  const { allowedIds, includeIds } = getIncludePageIdsForUser(allPages, pagePermissions)
  const filteredPages = allPages.filter(
    (page) => page.is_menu_visible && includeIds.has(getPageId(page))
  )

  // eslint-disable-next-line no-console
  console.log('ALL PAGES', allPages)
  // eslint-disable-next-line no-console
  console.log('ALLOWED IDS', allowedIds)
  // eslint-disable-next-line no-console
  console.log('INCLUDE IDS', includeIds)
  // eslint-disable-next-line no-console
  console.log('FILTERED PAGES', filteredPages)

  const tree = buildMenuTreeFromPages(filteredPages)
  return { tree, allowedIds, includeIds }
}

function flattenTreeTitles(nodes: MenuTreeNode[], depth = 0): string[] {
  return nodes.flatMap((node) => [
    `${'  '.repeat(depth)}- ${node.title}`,
    ...flattenTreeTitles(node.children, depth + 1),
  ])
}

function extractPagesFromMenuTree(menuTree: MenuTreeNode[] | undefined): Page[] {
  const flattened: Page[] = []
  const visit = (node: MenuTreeNode) => {
    flattened.push({
      id: String(node.id),
      title: node.title,
      slug: node.slug,
      parent_id: node.parent_id == null ? null : String(node.parent_id),
      menu_order: node.menu_order,
      is_menu_visible: node.is_menu_visible,
      assigned_entities: [],
    })
    node.children.forEach(visit)
  }

  ;(menuTree ?? []).forEach(visit)
  return flattened
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
    let resolved = menuTree

    if (isAdminRole) {
      resolved = buildMenuTreeFromPages(pages ?? [])
    } else if (isNormalUser && (pages || menuTree)) {
      const allPagesMap = new Map<string, Page>()
      for (const page of [...(pages ?? []), ...extractPagesFromMenuTree(menuTree)]) {
        allPagesMap.set(getPageId(page), page)
      }

      const allPages = Array.from(allPagesMap.values())
      const { tree, allowedIds, includeIds } = buildPermittedPageTree(
        allPages,
        selfPagePermissions ?? []
      )
      resolved = tree

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.info('Normal-user sidebar hierarchy debug', {
          allPages: allPages.map((page) => ({
            id: getPageId(page),
            title: page.title,
            parentId: getParentId(page),
          })),
          allowedIds: Array.from(allowedIds),
          includeIds: Array.from(includeIds),
          treeTitles: flattenTreeTitles(tree),
        })
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
  }, [auth.user?.role, isAdminRole, isNormalUser, menuTree, pages, selfPagePermissions])

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
