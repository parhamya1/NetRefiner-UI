import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Entity } from '@/types/api'
import type { BuilderState } from '../types'
import { RelatedLayerBuilder } from './related-layer-builder'
import { RootSelector } from './root-selector'

type RelationshipBuilderProps = {
  entities: Entity[]
  mappingName: string
  mappingDescription: string
  builder: BuilderState
  saveDisabled: boolean
  saveLabel: string
  onChangeName: (value: string) => void
  onChangeDescription: (value: string) => void
  onChangeBuilder: (value: BuilderState) => void
  onSave: () => void
}

export function RelationshipBuilder({
  entities,
  mappingName,
  mappingDescription,
  builder,
  saveDisabled,
  saveLabel,
  onChangeName,
  onChangeDescription,
  onChangeBuilder,
  onSave,
}: RelationshipBuilderProps) {
  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <CardTitle>Relationship Builder</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <Input
            placeholder='Mapping name (required)'
            value={mappingName}
            onChange={(event) => onChangeName(event.target.value)}
          />
          <Textarea
            placeholder='Description (optional)'
            value={mappingDescription}
            onChange={(event) => onChangeDescription(event.target.value)}
          />
        </CardContent>
      </Card>

      <RootSelector
        entities={entities}
        value={builder.root}
        onChange={(root) => onChangeBuilder({ ...builder, root })}
      />

      <RelatedLayerBuilder entities={entities} value={builder} onChange={onChangeBuilder} />

      <div className='flex justify-end'>
        <Button onClick={onSave} disabled={saveDisabled}>
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}
