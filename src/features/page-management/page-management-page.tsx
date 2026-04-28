import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { getEntities } from '@/lib/api/entities'
import { getPages } from '@/lib/api/pages'
import { QUERY_KEYS } from '@/lib/query-keys'
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
import type { Page } from '@/types/api'
import { PageDeleteDialog } from './components/page-delete-dialog'
import { PageFormDialog } from './components/page-form-dialog'

export function PageManagementPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingPage, setEditingPage] = useState<Page | null>(null)
  const [deletingPage, setDeletingPage] = useState<Page | null>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const pagesQuery = useQuery({
    queryKey: QUERY_KEYS.pages.management,
    queryFn: getPages,
  })

  const entitiesQuery = useQuery({
    queryKey: QUERY_KEYS.entities.summary,
    queryFn: getEntities,
  })

  const pages = useMemo(() => pagesQuery.data ?? [], [pagesQuery.data])
  const entities = useMemo(() => entitiesQuery.data ?? [], [entitiesQuery.data])

  const parentMap = useMemo(() => {
    return new Map(pages.map((page) => [page.id, page.title]))
  }, [pages])

  async function refreshList() {
    await pagesQuery.refetch()
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pages.menuTree })
  }

  function handlePageCreated(slug: string) {
    navigate({ to: '/pages/$slug', params: { slug } })
  }

  function openCreateDialog() {
    setEditingPage(null)
    setFormOpen(true)
  }

  function openEditDialog(page: Page) {
    setEditingPage(page)
    setFormOpen(true)
  }

  function openDeleteDialog(page: Page) {
    setDeletingPage(page)
    setDeleteOpen(true)
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
            <h1 className='text-2xl font-bold tracking-tight'>Page Management</h1>
            <p className='text-muted-foreground'>Manage pages and assigned entities.</p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className='mr-2 size-4' />
            Create Page
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pages</CardTitle>
          </CardHeader>
          <CardContent>
            {pagesQuery.isLoading ? (
              <div className='space-y-3'>
                <Skeleton className='h-10 w-full' />
                <Skeleton className='h-10 w-full' />
                <Skeleton className='h-10 w-full' />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>Menu Order</TableHead>
                    <TableHead>Visible</TableHead>
                    <TableHead>Assigned Entities</TableHead>
                    <TableHead className='text-right'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pages.map((page) => (
                    <TableRow key={page.id}>
                      <TableCell className='font-medium'>{page.title}</TableCell>
                      <TableCell>{page.slug}</TableCell>
                      <TableCell>
                        {page.parent_id ? parentMap.get(page.parent_id) ?? 'Unknown parent' : '-'}
                      </TableCell>
                      <TableCell>{page.menu_order}</TableCell>
                      <TableCell>
                        <Badge variant={page.is_menu_visible ? 'default' : 'secondary'}>
                          {page.is_menu_visible ? 'Yes' : 'No'}
                        </Badge>
                      </TableCell>
                      <TableCell>{page.assigned_entities.length}</TableCell>
                      <TableCell className='text-right'>
                        <div className='flex justify-end gap-2'>
                          <Button
                            type='button'
                            variant='outline'
                            size='icon'
                            onClick={() => openEditDialog(page)}
                          >
                            <Pencil className='size-4' />
                          </Button>
                          <Button
                            type='button'
                            variant='destructive'
                            size='icon'
                            onClick={() => openDeleteDialog(page)}
                          >
                            <Trash2 className='size-4' />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {!pagesQuery.isLoading && pages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className='py-8 text-center text-muted-foreground'>
                        No pages found.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {formOpen ? (
          <PageFormDialog
            key={editingPage?.id ?? 'create'}
            open={formOpen}
            onOpenChange={setFormOpen}
            onSuccess={refreshList}
            page={editingPage}
            pages={pages}
            entities={entities}
            onCreated={handlePageCreated}
          />
        ) : null}

        <PageDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          page={deletingPage}
          onSuccess={refreshList}
        />
      </Main>
    </>
  )
}
