import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createEntityRow, updateEntityRow } from '@/lib/api/entities'
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
import { Switch } from '@/components/ui/switch'
import type { PageSectionColumn } from '@/types/api'

type RowFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityId: string
  columns: PageSectionColumn[]
  row?: Record<string, unknown> | null
  rowId?: string | null
  onSuccess: () => Promise<void>
}

function getFieldKind(column: PageSectionColumn) {
  const frontendType = column.frontend_type.toLowerCase()

  if (frontendType.includes('bool')) return 'boolean' as const
  if (frontendType.includes('date')) return 'date' as const
  if (
    frontendType.includes('number') ||
    frontendType.includes('integer') ||
    frontendType.includes('int')
  ) {
    return 'number' as const
  }

  return 'text' as const
}

function toInputValue(value: unknown) {
  if (value === null || value === undefined) return ''
  return String(value)
}

function normalizeValue(column: PageSectionColumn, value: unknown) {
  const fieldKind = getFieldKind(column)

  if (fieldKind === 'boolean') {
    return Boolean(value)
  }

  if (value === '') return null

  if (fieldKind === 'number') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : value
  }

  return value
}

function buildValues(
  columns: PageSectionColumn[],
  row?: Record<string, unknown> | null
) {
  const nextValues: Record<string, unknown> = {}

  for (const column of columns) {
    const fieldKind = getFieldKind(column)
    const rowValue = row?.[column.name]

    if (fieldKind === 'boolean') {
      nextValues[column.name] = Boolean(rowValue)
    } else {
      nextValues[column.name] = toInputValue(rowValue)
    }
  }

  return nextValues
}

export function RowFormDialog({
  open,
  onOpenChange,
  entityId,
  columns,
  row,
  rowId,
  onSuccess,
}: RowFormDialogProps) {
  const isEdit = !!row && !!rowId
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    buildValues(columns, row)
  )

  const requiredErrors = useMemo(() => {
    return columns
      .filter((column) => getFieldKind(column) !== 'boolean')
      .filter((column) => {
        const value = values[column.name]
        return String(value ?? '').trim().length === 0
      })
      .map((column) => column.name)
  }, [columns, values])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {}

      for (const column of columns) {
        payload[column.name] = normalizeValue(column, values[column.name])
      }

      if (isEdit && rowId) {
        await updateEntityRow(entityId, rowId, payload)
        return
      }

      await createEntityRow(entityId, payload)
    },
    onSuccess: async () => {
      toast.success(isEdit ? 'Row updated successfully.' : 'Row created successfully.')
      onOpenChange(false)
      await onSuccess()
    },
    onError: handleServerError,
  })

  const canSubmit = requiredErrors.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit row' : 'Create row'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the selected row values.' : 'Create a new row for this section.'}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-3'>
          {columns.map((column) => {
            const fieldKind = getFieldKind(column)
            const key = `${entityId}-${column.name}`

            if (fieldKind === 'boolean') {
              return (
                <div key={key} className='flex items-center justify-between rounded-md border px-3 py-2'>
                  <Label htmlFor={key}>{column.label || column.name}</Label>
                  <Switch
                    id={key}
                    checked={Boolean(values[column.name])}
                    onCheckedChange={(checked) =>
                      setValues((current) => ({
                        ...current,
                        [column.name]: checked,
                      }))
                    }
                  />
                </div>
              )
            }

            return (
              <div key={key} className='grid gap-1.5'>
                <Label htmlFor={key}>{column.label || column.name}</Label>
                <Input
                  id={key}
                  type={fieldKind === 'number' ? 'number' : fieldKind === 'date' ? 'date' : 'text'}
                  value={toInputValue(values[column.name])}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [column.name]: event.target.value,
                    }))
                  }
                />
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type='button'
            disabled={!canSubmit || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
