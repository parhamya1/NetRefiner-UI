import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons'
import type { CheckedState } from '@radix-ui/react-checkbox'
import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { getPages } from '@/lib/api/pages'
import { QUERY_KEYS } from '@/lib/query-keys'
import {
  getUserPagePermissions,
  getUsers,
  updateUserPagePermissions,
} from '@/lib/api/users'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Page, PagePermission, User } from '@/types/api'

function getErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    const data = error.response?.data

    if (typeof data === 'string' && data.trim().length > 0) return data

    if (data && typeof data === 'object') {
      if ('detail' in data && typeof data.detail === 'string') return data.detail
      if ('message' in data && typeof data.message === 'string') return data.message
      if ('title' in data && typeof data.title === 'string') return data.title
    }
  }

  return 'Unable to save permissions.'
}

type FlattenedPage = {
  page: Page
  level: number
}

function flattenPagesHierarchy(pages: Page[]) {
  const byParent = new Map<string | null, Page[]>()

  for (const page of pages) {
    const parentPages = byParent.get(page.parent_id) ?? []
    parentPages.push(page)
    byParent.set(page.parent_id, parentPages)
  }

  for (const [parentId, siblings] of byParent) {
    byParent.set(
      parentId,
      siblings.sort((a, b) => a.menu_order - b.menu_order)
    )
  }

  const result: FlattenedPage[] = []

  function visit(parentId: string | null, level: number) {
    const nodes = byParent.get(parentId) ?? []

    for (const node of nodes) {
      result.push({ page: node, level })
      visit(node.id, level + 1)
    }
  }

  visit(null, 0)
  return result
}

export function PermissionManagementPage() {
  const queryClient = useQueryClient()
  const { auth } = useAuthStore()
  const [userSelectorOpen, setUserSelectorOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})

  const usersQuery = useQuery({
    queryKey: ['users', 'management'],
    queryFn: getUsers,
  })

  const pagesQuery = useQuery({
    queryKey: ['pages', 'management'],
    queryFn: getPages,
  })

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data])
  const pages = useMemo(() => pagesQuery.data ?? [], [pagesQuery.data])

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users]
  )

  const selectedUserDisplay = useMemo(() => {
    if (!selectedUser) return 'Search and select a user'
    return selectedUser.full_name?.trim()
      ? `${selectedUser.full_name} <${selectedUser.email}>`
      : selectedUser.email
  }, [selectedUser])

  const permissionsQuery = useQuery({
    queryKey: ['users', 'page-permissions', selectedUser?.id],
    queryFn: async () => {
      if (!selectedUser?.id) return []
      return getUserPagePermissions(selectedUser.id)
    },
    enabled: Boolean(selectedUser?.id),
  })

  const flattenedPages = useMemo(() => flattenPagesHierarchy(pages), [pages])

  const permissionMap = useMemo(() => {
    const map = new Map<string, boolean>()

    for (const permission of permissionsQuery.data ?? []) {
      map.set(permission.page_id, permission.can_view)
    }

    return map
  }, [permissionsQuery.data])

  const totalPages = flattenedPages.length
  const selectedPagesCount = useMemo(
    () =>
      flattenedPages.filter(({ page }) => {
        if (page.id in overrides) return overrides[page.id]
        return permissionMap.get(page.id) ?? false
      }).length,
    [flattenedPages, overrides, permissionMap]
  )
  const allCheckedState: CheckedState =
    selectedPagesCount === 0
      ? false
      : selectedPagesCount === totalPages
        ? true
        : 'indeterminate'

  useEffect(() => {
    if (!permissionsQuery.isError) return

    const endpoint = selectedUser?.id
      ? `/api/v1/users/${encodeURIComponent(selectedUser.id)}/page-permissions`
      : '/api/v1/users/{user_id}/page-permissions'
    const message = getErrorMessage(permissionsQuery.error)

    toast.error(`Failed to load permissions: ${message}`)

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('Permission load failed', {
        selectedUserId: selectedUser?.id ?? null,
        endpoint,
        message,
      })
    }
  }, [permissionsQuery.error, permissionsQuery.isError, selectedUser?.id])

  function getCanView(pageId: string) {
    if (pageId in overrides) return overrides[pageId]
    return permissionMap.get(pageId) ?? false
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const permissions: PagePermission[] = flattenedPages.map(({ page }) => ({
        page_id: page.id,
        can_view: getCanView(page.id),
      }))

      return updateUserPagePermissions(selectedUserId, permissions)
    },
    onSuccess: async () => {
      toast.success('Permissions updated successfully.')
      await permissionsQuery.refetch()

      const didInvalidateSidebar =
        selectedUserId.length > 0 && selectedUserId === auth.user?.id

      if (didInvalidateSidebar) {
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pages.menuTreePrefix })
      }

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.info('Permission save context', {
          selectedUserId,
          currentUserId: auth.user?.id ?? null,
          didInvalidateSidebar,
        })
      }

      setOverrides({})
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })

  const isLoading = usersQuery.isLoading || pagesQuery.isLoading
  const canSave =
    selectedUserId.length > 0 && flattenedPages.length > 0 && !permissionsQuery.isLoading

  function handleToggleAll(checked: CheckedState) {
    const nextValue = checked === true
    const nextOverrides: Record<string, boolean> = {}

    for (const { page } of flattenedPages) {
      nextOverrides[page.id] = nextValue
    }

    setOverrides(nextOverrides)
  }

  return (
    <>
      <Header>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main fixed>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Permission Management</h1>
          <p className='text-muted-foreground'>Manage page-level access per user.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select User</CardTitle>
          </CardHeader>
          <CardContent>
            {usersQuery.isLoading ? (
              <Skeleton className='h-10 w-full' />
            ) : (
              <Popover open={userSelectorOpen} onOpenChange={setUserSelectorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant='outline'
                    role='combobox'
                    aria-expanded={userSelectorOpen}
                    className={cn(
                      'w-full justify-between font-normal',
                      !selectedUser && 'text-muted-foreground'
                    )}
                  >
                    <span className='truncate text-left'>{selectedUserDisplay}</span>
                    <CaretSortIcon className='ms-2 size-4 shrink-0 opacity-50' />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className='w-[var(--radix-popover-trigger-width)] p-0' align='start'>
                  <Command shouldFilter>
                    <CommandInput placeholder='Search and select a user' />
                    <CommandList>
                      <CommandEmpty>No users found</CommandEmpty>
                      <CommandGroup>
                        {users.map((user: User) => {
                          const label = user.full_name?.trim()
                            ? `${user.full_name} <${user.email}>`
                            : user.email

                          return (
                            <CommandItem
                              key={user.id}
                              value={user.id}
                              keywords={[user.full_name ?? '', user.email, user.role]}
                              onSelect={() => {
                                setSelectedUserId(user.id)
                                setOverrides({})
                                setUserSelectorOpen(false)
                              }}
                              className='flex items-start justify-between gap-3'
                            >
                              <div className='min-w-0'>
                                <div className='truncate'>{label}</div>
                                <div className='truncate text-xs text-muted-foreground'>
                                  {user.email}
                                </div>
                              </div>
                              <div className='flex items-center gap-2'>
                                <Badge variant='secondary' className='capitalize'>
                                  {user.role}
                                </Badge>
                                <CheckIcon
                                  className={cn(
                                    'size-4',
                                    selectedUserId === user.id ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                              </div>
                            </CommandItem>
                          )
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between'>
            <CardTitle>Page Permissions {selectedUser ? `for ${selectedUser.full_name}` : ''}</CardTitle>
            <Button
              type='button'
              disabled={!canSave || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className='space-y-3'>
                <Skeleton className='h-10 w-full' />
                <Skeleton className='h-10 w-full' />
                <Skeleton className='h-10 w-full' />
              </div>
            ) : permissionsQuery.isError ? (
              <Alert variant='destructive'>
                <AlertTitle>Unable to load user permissions</AlertTitle>
                <AlertDescription>
                  {`We could not load page permissions for the selected user. ${getErrorMessage(permissionsQuery.error)}`}
                </AlertDescription>
              </Alert>
            ) : selectedUserId.length === 0 ? (
              <Alert>
                <AlertTitle>Select a user</AlertTitle>
                <AlertDescription>
                  Choose a user above to manage page-level permissions.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className='mb-3 flex items-center justify-end gap-2'>
                  <span className='text-sm text-muted-foreground'>All</span>
                  <Checkbox checked={allCheckedState} onCheckedChange={handleToggleAll} />
                </div>
                <Table>
                  <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead className='w-[120px] text-right'>Can View</TableHead>
                  </TableRow>
                </TableHeader>
                  <TableBody>
                  {flattenedPages.map(({ page, level }) => (
                    <TableRow key={page.id}>
                      <TableCell>
                        <div style={{ paddingLeft: `${level * 16}px` }}>
                          {page.title}
                        </div>
                      </TableCell>
                      <TableCell>{page.slug}</TableCell>
                      <TableCell className='text-right'>
                        <div className='flex justify-end'>
                          <Checkbox
                            checked={getCanView(page.id)}
                            onCheckedChange={(checked) =>
                              setOverrides((current) => ({
                                ...current,
                                [page.id]: Boolean(checked),
                              }))
                            }
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
