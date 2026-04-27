import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, FolderKanban, Settings, Users } from 'lucide-react'
import { getMenuTree } from '@/lib/api/pages'
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
import { type MenuTreeNode, type UserRole } from '@/types/api'
import { type NavGroup as NavGroupType, type NavItem, type SidebarData } from './types'

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

  const { data: menuTree } = useQuery({
    queryKey: ['pages', 'menu-tree'],
    queryFn: getMenuTree,
    enabled: !!auth.accessToken,
    staleTime: 60 * 1000,
  })

  const navUser = useMemo(
    () => ({
      name: auth.user?.full_name || auth.user?.email || 'User',
      email: auth.user?.email || 'user@example.com',
      avatar: '/avatars/01.png',
    }),
    [auth.user?.email, auth.user?.full_name]
  )

  const resolvedSidebarData = useMemo(
    () => buildSidebarData(menuTree, navUser, auth.user?.role),
    [auth.user?.role, menuTree, navUser]
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
