import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Entity } from '@/types/api'
import type { BuilderState, ChildLayer } from '../types'
import { ValuePickerDialog } from './value-picker-dialog'

type RelatedLayerBuilderProps = {
  entities: Entity[]
  value: BuilderState
  onChange: (nextState: BuilderState) => void
}

export function RelatedLayerBuilder({ entities, value, onChange }: RelatedLayerBuilderProps) {
  const [relatedDialogOpen, setRelatedDialogOpen] = useState(false)
  const [childTarget, setChildTarget] = useState<string | null>(null)

  const relatedEntity = useMemo(
    () => entities.find((entity) => entity.id === value.relatedEntityId) ?? null,
    [entities, value.relatedEntityId]
  )
  const relatedColumns = (relatedEntity?.columns ?? []).map((column) => column.name)

  const childEntityOptions = entities

  function updateChildLayer(parentValue: string, nextChildLayer: ChildLayer) {
    onChange({
      ...value,
      childrenByRelatedValue: {
        ...value.childrenByRelatedValue,
        [parentValue]: nextChildLayer,
      },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>2) Related layer + 3) Child layer</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-3 md:grid-cols-3'>
          <Select
            value={value.relatedEntityId}
            onValueChange={(nextEntityId) =>
              onChange({
                ...value,
                relatedEntityId: nextEntityId,
                relatedColumn: '',
                relatedValues: [],
                childrenByRelatedValue: {},
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder='Related entity' />
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
            value={value.relatedColumn}
            onValueChange={(nextColumn) =>
              onChange({
                ...value,
                relatedColumn: nextColumn,
                relatedValues: [],
                childrenByRelatedValue: {},
              })
            }
            disabled={!relatedEntity}
          >
            <SelectTrigger>
              <SelectValue placeholder='Related column' />
            </SelectTrigger>
            <SelectContent>
              {relatedColumns.map((columnName) => (
                <SelectItem key={columnName} value={columnName}>
                  {columnName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            disabled={!value.relatedEntityId || !value.relatedColumn}
            onClick={() => setRelatedDialogOpen(true)}
          >
            Select related values
          </Button>
        </div>

        {value.relatedValues.length > 0 ? (
          <div className='space-y-3'>
            {value.relatedValues.map((relatedValue) => {
              const child = value.childrenByRelatedValue[relatedValue]
              const selectedChildEntity = childEntityOptions.find((entity) => entity.id === child?.entityId)
              const childColumns = (selectedChildEntity?.columns ?? []).map((column) => column.name)

              return (
                <div key={relatedValue} className='rounded-md border p-3'>
                  <div className='mb-2 flex items-center justify-between'>
                    <span className='font-medium'>{relatedValue}</span>
                    <Button size='sm' variant='outline' onClick={() => setChildTarget(relatedValue)}>
                      Add children
                    </Button>
                  </div>
                  <div className='grid gap-2 md:grid-cols-3'>
                    <Select
                      value={child?.entityId ?? ''}
                      onValueChange={(nextEntityId) =>
                        updateChildLayer(relatedValue, {
                          entityId: nextEntityId,
                          column: '',
                          values: [],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Child entity' />
                      </SelectTrigger>
                      <SelectContent>
                        {childEntityOptions.map((entity) => (
                          <SelectItem key={entity.id} value={entity.id}>
                            {entity.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={child?.column ?? ''}
                      onValueChange={(nextColumn) =>
                        updateChildLayer(relatedValue, {
                          entityId: child?.entityId ?? '',
                          column: nextColumn,
                          values: [],
                        })
                      }
                      disabled={!child?.entityId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Child column' />
                      </SelectTrigger>
                      <SelectContent>
                        {childColumns.map((columnName) => (
                          <SelectItem key={`${relatedValue}-${columnName}`} value={columnName}>
                            {columnName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input readOnly value={(child?.values ?? []).join(', ')} placeholder='No child values selected' />
                  </div>

                  <ValuePickerDialog
                    open={childTarget === relatedValue}
                    onOpenChange={(open) => !open && setChildTarget(null)}
                    entityId={child?.entityId ?? ''}
                    column={child?.column ?? ''}
                    mode='multiple'
                    selectedValues={child?.values ?? []}
                    onConfirm={(values) =>
                      updateChildLayer(relatedValue, {
                        entityId: child?.entityId ?? '',
                        column: child?.column ?? '',
                        values,
                      })
                    }
                  />
                </div>
              )
            })}
          </div>
        ) : (
          <p className='text-sm text-muted-foreground'>Select related values to build child layers.</p>
        )}

        <ValuePickerDialog
          open={relatedDialogOpen}
          onOpenChange={setRelatedDialogOpen}
          entityId={value.relatedEntityId}
          column={value.relatedColumn}
          mode='multiple'
          selectedValues={value.relatedValues}
          onConfirm={(values) =>
            onChange({
              ...value,
              relatedValues: values,
              childrenByRelatedValue: Object.fromEntries(
                Object.entries(value.childrenByRelatedValue).filter(([key]) => values.includes(key))
              ),
            })
          }
        />
      </CardContent>
    </Card>
  )
}
