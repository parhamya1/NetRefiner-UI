import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { getUsers } from '@/lib/api/users'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuthStore } from '@/stores/auth-store'
import type { User } from '@/types/api'
import { UserDeleteDialog } from './components/user-delete-dialog'
import { UserFormDialog } from './components/user-form-dialog'

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function UserManagementPage() {
  const { auth } = useAuthStore()
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)

  const usersQuery = useQuery({
    queryKey: ['users', 'management'],
    queryFn: getUsers,
  })

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data])

  async function refreshUsers() {
    await usersQuery.refetch()
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
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>User Management</h1>
            <p className='text-muted-foreground'>Manage users and roles.</p>
          </div>
          <Button
            onClick={() => {
              setEditingUser(null)
              setFormOpen(true)
            }}
          >
            <Plus className='mr-2 size-4' />
            Create User
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent>
            {usersQuery.isLoading ? (
              <div className='space-y-3'>
                <Skeleton className='h-10 w-full' />
                <Skeleton className='h-10 w-full' />
                <Skeleton className='h-10 w-full' />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className='text-right'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const isCurrentUser = user.id === auth.user?.id

                    return (
                      <TableRow key={user.id}>
                        <TableCell className='font-medium'>{user.full_name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell className='uppercase'>{user.role}</TableCell>
                        <TableCell>
                          <Badge variant={user.is_active ? 'default' : 'secondary'}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(user.created_at)}</TableCell>
                        <TableCell className='text-right'>
                          <div className='flex justify-end gap-2'>
                            <Button
                              type='button'
                              variant='outline'
                              size='icon'
                              onClick={() => {
                                setEditingUser(user)
                                setFormOpen(true)
                              }}
                            >
                              <Pencil className='size-4' />
                            </Button>
                            <Button
                              type='button'
                              variant='destructive'
                              size='icon'
                              disabled={isCurrentUser}
                              onClick={() => {
                                setDeletingUser(user)
                                setDeleteOpen(true)
                              }}
                            >
                              <Trash2 className='size-4' />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}

                  {!usersQuery.isLoading && users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className='py-8 text-center text-muted-foreground'>
                        No users found.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {formOpen ? (
          <UserFormDialog
            key={editingUser?.id ?? 'create'}
            open={formOpen}
            onOpenChange={setFormOpen}
            currentUserId={auth.user?.id}
            user={editingUser}
            onSuccess={refreshUsers}
          />
        ) : null}

        <UserDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          user={deletingUser}
          disabled={deletingUser?.id === auth.user?.id}
          onSuccess={refreshUsers}
        />
      </Main>
    </>
  )
}
