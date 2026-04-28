import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { getPages } from '@/lib/api/pages'
import {
  getUserPagePermissions,
  getUsers,
  updateUserPagePermissions,
} from '@/lib/api/users'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

  const permissionsQuery = useQuery({
    queryKey: ['users', 'page-permissions', selectedUserId],
    queryFn: () => getUserPagePermissions(selectedUserId),
    enabled: selectedUserId.length > 0,
  })

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data])
  const pages = useMemo(() => pagesQuery.data ?? [], [pagesQuery.data])

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users]
  )

  const flattenedPages = useMemo(() => flattenPagesHierarchy(pages), [pages])

  const permissionMap = useMemo(() => {
    const map = new Map<string, boolean>()

    for (const permission of permissionsQuery.data ?? []) {
      map.set(permission.page_id, permission.can_view)
    }

    return map
  }, [permissionsQuery.data])

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
      setOverrides({})
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })

  const isLoading = usersQuery.isLoading || pagesQuery.isLoading
  const canSave =
    selectedUserId.length > 0 && flattenedPages.length > 0 && !permissionsQuery.isLoading

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
              <Select
                value={selectedUserId || undefined}
                onValueChange={(value) => {
                  setSelectedUserId(value)
                  setOverrides({})
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select a user' />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user: User) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  We could not load page permissions for the selected user.
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
            )}
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
