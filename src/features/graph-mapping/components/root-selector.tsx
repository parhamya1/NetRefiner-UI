import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Entity } from '@/types/api'
import type { BuilderRoot } from '../types'
import { ValuePickerDialog } from './value-picker-dialog'

type RootSelectorProps = {
  entities: Entity[]
  value: BuilderRoot | null
  onChange: (value: BuilderRoot | null) => void
}

export function RootSelector({ entities, value, onChange }: RootSelectorProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [entityId, setEntityId] = useState(value?.entityId ?? '')
  const [column, setColumn] = useState(value?.column ?? '')
  const selectedEntity = useMemo(
    () => entities.find((entity) => entity.id === entityId) ?? null,
    [entities, entityId]
  )

  const columns = (selectedEntity?.columns ?? []).map((item) => item.name)

  return (
    <Card>
      <CardHeader>
        <CardTitle>1) Root item</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        <Select
          value={entityId}
          onValueChange={(nextEntityId) => {
            setEntityId(nextEntityId)
            setColumn('')
            onChange(null)
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder='Select root entity' />
          </SelectTrigger>
          <SelectContent>
            {entities.map((entity) => (
              <SelectItem key={entity.id} value={entity.id}>
                {entity.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={column}
          onValueChange={(nextColumn) => {
            setColumn(nextColumn)
            onChange(null)
          }}
          disabled={!selectedEntity}
        >
          <SelectTrigger>
            <SelectValue placeholder='Select root column' />
          </SelectTrigger>
          <SelectContent>
            {columns.map((columnName) => (
              <SelectItem key={columnName} value={columnName}>
                {columnName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button disabled={!entityId || !column} onClick={() => setDialogOpen(true)}>
          {value ? 'Change root value' : 'Select root value'}
        </Button>

        {value ? (
          <div className='rounded-md border p-3 text-sm'>
            <div className='font-medium'>{value.label}</div>
            <div className='text-muted-foreground'>
              {selectedEntity?.name} / {value.column}
            </div>
          </div>
        ) : null}

        <ValuePickerDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          entityId={entityId}
          column={column}
          mode='single'
          selectedValues={value?.value ? [value.value] : []}
          onConfirm={(values) => {
            const selectedValue = values[0]
            if (!selectedEntity || !selectedValue) return
            onChange({
              entityId: selectedEntity.id,
              column,
              value: selectedValue,
              label: selectedValue,
            })
          }}
        />
      </CardContent>
    </Card>
  )
}
