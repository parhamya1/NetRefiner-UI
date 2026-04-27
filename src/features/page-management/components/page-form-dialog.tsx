import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createPage, updatePage } from '@/lib/api/pages'
import { handleServerError } from '@/lib/handle-server-error'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { AssignedEntity, EntitySummary, Page } from '@/types/api'

type PageFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  pages: Page[]
  entities: EntitySummary[]
  page?: Page | null
}

function getDefaultAssignedEntity(entity: EntitySummary, sortOrder: number): AssignedEntity {
  return {
    entity_id: entity.id,
    display_title: entity.name,
    display_type: 'table',
    filters_enabled: true,
    sort_order: sortOrder,
  }
}

export function PageFormDialog({
  open,
  onOpenChange,
  onSuccess,
  pages,
  entities,
  page,
}: PageFormDialogProps) {
  const isEdit = !!page
  const [title, setTitle] = useState(() => page?.title ?? '')
  const [slug, setSlug] = useState(() => page?.slug ?? '')
  const [parentId, setParentId] = useState<string | null>(() => page?.parent_id ?? null)
  const [menuOrder, setMenuOrder] = useState(() => page?.menu_order ?? 1)
  const [isMenuVisible, setIsMenuVisible] = useState(() => page?.is_menu_visible ?? true)
  const [assignedEntities, setAssignedEntities] = useState<AssignedEntity[]>(
    () => page?.assigned_entities ?? []
  )
  const [nextEntityId, setNextEntityId] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        parent_id: parentId,
        menu_order: Number.isFinite(menuOrder) ? menuOrder : 1,
        is_menu_visible: isMenuVisible,
        assigned_entities: assignedEntities.map((entity, index) => ({
          ...entity,
          display_type: 'table',
          sort_order: entity.sort_order || index + 1,
        })),
      }

      if (isEdit && page) {
        return updatePage(page.id, payload)
      }

      return createPage(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Page updated successfully.' : 'Page created successfully.')
      onOpenChange(false)
      onSuccess()
    },
    onError: handleServerError,
  })

  const availableParents = useMemo(
    () => pages.filter((currentPage) => currentPage.id !== page?.id),
    [page?.id, pages]
  )

  const selectableEntities = useMemo(
    () => entities.filter((entity) => !assignedEntities.some((item) => item.entity_id === entity.id)),
    [assignedEntities, entities]
  )

  const canSubmit = title.trim().length > 0 && slug.trim().length > 0

  function addAssignedEntity() {
    if (!nextEntityId) return

    const selectedEntity = entities.find((entity) => entity.id === nextEntityId)
    if (!selectedEntity) return

    setAssignedEntities((current) => [
      ...current,
      getDefaultAssignedEntity(selectedEntity, current.length + 1),
    ])
    setNextEntityId('')
  }

  function removeAssignedEntity(entityId: string) {
    setAssignedEntities((current) =>
      current
        .filter((entity) => entity.entity_id !== entityId)
        .map((entity, index) => ({
          ...entity,
          sort_order: index + 1,
        }))
    )
  }

  function updateAssignedEntity(
    entityId: string,
    updater: (entity: AssignedEntity) => AssignedEntity
  ) {
    setAssignedEntities((current) =>
      current.map((entity) => (entity.entity_id === entityId ? updater(entity) : entity))
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit page' : 'Create page'}</DialogTitle>
          <DialogDescription>
            Configure page details and assign entities.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='grid gap-2'>
            <Label htmlFor='page-title'>Title</Label>
            <Input
              id='page-title'
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder='CM'
            />
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='page-slug'>Slug</Label>
            <Input
              id='page-slug'
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder='cm'
            />
          </div>

          <div className='grid gap-2'>
            <Label>Parent page</Label>
            <Select
              value={parentId ?? 'none'}
              onValueChange={(value) => setParentId(value === 'none' ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder='No parent' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='none'>No parent</SelectItem>
                {availableParents.map((parentPage) => (
                  <SelectItem key={parentPage.id} value={parentPage.id}>
                    {parentPage.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='menu-order'>Menu order</Label>
            <Input
              id='menu-order'
              type='number'
              value={menuOrder}
              onChange={(event) => setMenuOrder(Number(event.target.value))}
            />
          </div>

          <div className='flex items-center justify-between rounded-md border px-3 py-2'>
            <Label htmlFor='is-menu-visible'>Visible in menu</Label>
            <Switch
              id='is-menu-visible'
              checked={isMenuVisible}
              onCheckedChange={setIsMenuVisible}
            />
          </div>

          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <Label>Assigned entities</Label>
              <div className='flex items-center gap-2'>
                <Select value={nextEntityId} onValueChange={setNextEntityId}>
                  <SelectTrigger className='w-52'>
                    <SelectValue placeholder='Select entity' />
                  </SelectTrigger>
                  <SelectContent>
                    {selectableEntities.map((entity) => (
                      <SelectItem key={entity.id} value={entity.id}>
                        {entity.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type='button' variant='outline' onClick={addAssignedEntity}>
                  <Plus className='mr-2 size-4' /> Add
                </Button>
              </div>
            </div>

            {assignedEntities.length === 0 ? (
              <p className='text-sm text-muted-foreground'>
                No entities assigned to this page.
              </p>
            ) : (
              <div className='space-y-3'>
                {assignedEntities.map((entity) => {
                  const entityInfo = entities.find((item) => item.id === entity.entity_id)

                  return (
                    <div key={entity.entity_id} className='space-y-3 rounded-lg border p-3'>
                      <div className='flex items-center justify-between'>
                        <p className='font-medium'>{entityInfo?.name ?? entity.entity_id}</p>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          onClick={() => removeAssignedEntity(entity.entity_id)}
                        >
                          <Trash2 className='size-4' />
                        </Button>
                      </div>

                      <div className='grid gap-3 md:grid-cols-2'>
                        <div className='grid gap-2'>
                          <Label>Display title</Label>
                          <Input
                            value={entity.display_title}
                            onChange={(event) =>
                              updateAssignedEntity(entity.entity_id, (current) => ({
                                ...current,
                                display_title: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className='grid gap-2'>
                          <Label>Display type</Label>
                          <Input value='table' disabled />
                        </div>
                        <div className='grid gap-2'>
                          <Label>Sort order</Label>
                          <Input
                            type='number'
                            value={entity.sort_order}
                            onChange={(event) =>
                              updateAssignedEntity(entity.entity_id, (current) => ({
                                ...current,
                                sort_order: Number(event.target.value),
                              }))
                            }
                          />
                        </div>
                        <div className='flex items-center justify-between rounded-md border px-3 py-2'>
                          <Label>Filters enabled</Label>
                          <Switch
                            checked={entity.filters_enabled}
                            onCheckedChange={(checked) =>
                              updateAssignedEntity(entity.entity_id, (current) => ({
                                ...current,
                                filters_enabled: checked,
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type='button' disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
