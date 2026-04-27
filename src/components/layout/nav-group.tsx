import { type ReactNode } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Badge } from '../ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import {
  type NavCollapsible,
  type NavItem,
  type NavLink,
  type NavGroup as NavGroupProps,
} from './types'

export function NavGroup({ title, items }: NavGroupProps) {
  const { state, isMobile } = useSidebar()
  const href = useLocation({ select: (location) => location.href })

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const key = `${item.title}-${isNavLink(item) ? item.url : item.title}`

          if (isNavLink(item)) {
            return <SidebarMenuLink key={key} item={item} href={href} />
          }

          if (state === 'collapsed' && !isMobile) {
            return (
              <SidebarMenuCollapsedDropdown key={key} item={item} href={href} />
            )
          }

          return <SidebarMenuCollapsible key={key} item={item} href={href} />
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function NavBadge({ children }: { children: ReactNode }) {
  return <Badge className='rounded-full px-1 py-0 text-xs'>{children}</Badge>
}

function SidebarMenuLink({ item, href }: { item: NavLink; href: string }) {
  const { setOpenMobile } = useSidebar()

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={checkIsActive(href, item)}
        tooltip={item.title}
      >
        <Link to={item.url} onClick={() => setOpenMobile(false)}>
          {item.icon && <item.icon />}
          <span>{item.title}</span>
          {item.badge && <NavBadge>{item.badge}</NavBadge>}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function SidebarMenuCollapsible({
  item,
  href,
}: {
  item: NavCollapsible
  href: string
}) {
  return (
    <Collapsible
      asChild
      defaultOpen={checkIsActive(href, item, true)}
      className='group/collapsible'
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title}>
            {item.icon && <item.icon />}
            <span>{item.title}</span>
            {item.badge && <NavBadge>{item.badge}</NavBadge>}
            <ChevronRight className='ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 rtl:rotate-180' />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className='CollapsibleContent'>
          <SidebarSubItems items={item.items} href={href} />
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

function SidebarSubItems({ items, href }: { items: NavItem[]; href: string }) {
  const { setOpenMobile } = useSidebar()

  return (
    <SidebarMenuSub>
      {items.map((subItem) => {
        if (isNavLink(subItem)) {
          return (
            <SidebarMenuSubItem key={`${subItem.title}-${subItem.url}`}>
              <SidebarMenuSubButton asChild isActive={checkIsActive(href, subItem)}>
                <Link to={subItem.url} onClick={() => setOpenMobile(false)}>
                  {subItem.icon && <subItem.icon />}
                  <span>{subItem.title}</span>
                  {subItem.badge && <NavBadge>{subItem.badge}</NavBadge>}
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          )
        }

        return (
          <Collapsible
            key={`${subItem.title}-group`}
            asChild
            defaultOpen={checkIsActive(href, subItem, true)}
            className='group/subcollapsible'
          >
            <SidebarMenuSubItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuSubButton isActive={checkIsActive(href, subItem)}>
                  {subItem.icon && <subItem.icon />}
                  <span>{subItem.title}</span>
                  <ChevronRight className='ms-auto transition-transform duration-200 group-data-[state=open]/subcollapsible:rotate-90 rtl:rotate-180' />
                </SidebarMenuSubButton>
              </CollapsibleTrigger>
              <CollapsibleContent className='CollapsibleContent'>
                <SidebarSubItems items={subItem.items} href={href} />
              </CollapsibleContent>
            </SidebarMenuSubItem>
          </Collapsible>
        )
      })}
    </SidebarMenuSub>
  )
}

function SidebarMenuCollapsedDropdown({
  item,
  href,
}: {
  item: NavCollapsible
  href: string
}) {
  const flattenedItems = flattenNavItems(item.items)

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            tooltip={item.title}
            isActive={checkIsActive(href, item)}
          >
            {item.icon && <item.icon />}
            <span>{item.title}</span>
            {item.badge && <NavBadge>{item.badge}</NavBadge>}
            <ChevronRight className='ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side='right' align='start' sideOffset={4}>
          <DropdownMenuLabel>
            {item.title} {item.badge ? `(${item.badge})` : ''}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {flattenedItems.map((sub) => (
            <DropdownMenuItem key={`${sub.title}-${sub.url}`} asChild>
              <Link
                to={sub.url}
                className={`${checkIsActive(href, sub) ? 'bg-secondary' : ''}`}
              >
                {sub.icon && <sub.icon />}
                <span className='max-w-52 text-wrap'>{sub.title}</span>
                {sub.badge && <span className='ms-auto text-xs'>{sub.badge}</span>}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

function flattenNavItems(items: NavItem[], parentPath = ''): NavLink[] {
  return items.flatMap((item) => {
    if (isNavLink(item)) {
      return [
        {
          ...item,
          title: parentPath ? `${parentPath} / ${item.title}` : item.title,
        },
      ]
    }

    const nextPath = parentPath ? `${parentPath} / ${item.title}` : item.title
    return flattenNavItems(item.items, nextPath)
  })
}

function checkIsActive(href: string, item: NavItem, mainNav = false) {
  const hrefPath = href.split('?')[0]

  if (isNavLink(item)) {
    const itemUrl = String(item.url)
    return href === itemUrl || hrefPath === itemUrl
  }

  const childIsActive = item.items.some((child) => checkIsActive(href, child))
  if (childIsActive) return true

  if (!mainNav) return false

  const firstChildLink = findFirstNavLink(item.items)
  if (!firstChildLink) return false

  const itemRoot = String(firstChildLink.url).split('/')[1]
  const hrefRoot = hrefPath.split('/')[1]

  return itemRoot !== '' && itemRoot === hrefRoot
}

function isNavLink(item: NavItem): item is NavLink {
  return !item.items
}

function findFirstNavLink(items: NavItem[]): NavLink | null {
  for (const item of items) {
    if (isNavLink(item)) return item

    const nested = findFirstNavLink(item.items)
    if (nested) return nested
  }

  return null
}
