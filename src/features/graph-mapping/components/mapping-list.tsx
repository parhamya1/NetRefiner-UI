import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { GraphMapping } from '@/types/api'

type MappingListProps = {
  mappings: GraphMapping[]
  selectedMappingId: string | null
  onCreate: () => void
  onOpen: (mappingId: string) => void
  onDelete: (mappingId: string) => void
}

export function MappingList({
  mappings,
  selectedMappingId,
  onCreate,
  onOpen,
  onDelete,
}: MappingListProps) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between'>
        <CardTitle>Mappings</CardTitle>
        <Button size='sm' onClick={onCreate}>
          Create Mapping
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className='text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.map((mapping) => (
              <TableRow key={mapping.id} className={selectedMappingId === mapping.id ? 'bg-muted/50' : ''}>
                <TableCell>{mapping.name}</TableCell>
                <TableCell className='text-right'>
                  <div className='flex justify-end gap-2'>
                    <Button variant='outline' size='sm' onClick={() => onOpen(mapping.id)}>
                      Open
                    </Button>
                    <Button variant='destructive' size='sm' onClick={() => onDelete(mapping.id)}>
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {mappings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className='text-center text-muted-foreground'>
                  No mappings yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
