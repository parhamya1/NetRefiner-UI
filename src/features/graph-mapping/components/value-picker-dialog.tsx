import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getEntityDistinctValues } from '@/lib/api/entities'
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
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'

type ValuePickerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityId: string
  column: string
  mode: 'single' | 'multiple'
  selectedValues: string[]
  onConfirm: (values: string[]) => void
}

export function ValuePickerDialog({
  open,
  onOpenChange,
  entityId,
  column,
  mode,
  selectedValues,
  onConfirm,
}: ValuePickerDialogProps) {
  const [search, setSearch] = useState('')
  const [draftValues, setDraftValues] = useState<string[]>(selectedValues)

  const valuesQuery = useQuery({
    queryKey: ['graph-mapping', 'value-picker', entityId, column, search],
    queryFn: () =>
      getEntityDistinctValues(entityId, {
        column,
        search,
        limit: 100,
      }),
    enabled: open && entityId.length > 0 && column.length > 0,
  })

  const values = useMemo(
    () => (valuesQuery.data?.values ?? []).map((value) => String(value)),
    [valuesQuery.data?.values]
  )

  function toggleValue(value: string) {
    if (mode === 'single') {
      setDraftValues([value])
      return
    }
    setDraftValues((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setDraftValues(selectedValues)
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className='sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>Select values</DialogTitle>
          <DialogDescription>
            {mode === 'single' ? 'Select one value.' : 'Select one or more values.'}
          </DialogDescription>
        </DialogHeader>

        <Input placeholder='Search values...' value={search} onChange={(event) => setSearch(event.target.value)} />

        <div className='max-h-72 overflow-auto rounded-md border'>
          <Table>
            <TableBody>
              {valuesQuery.isLoading ? (
                <TableRow>
                  <TableCell className='text-muted-foreground'>Loading values...</TableCell>
                </TableRow>
              ) : valuesQuery.isError ? (
                <TableRow>
                  <TableCell className='text-destructive'>Failed to load values.</TableCell>
                </TableRow>
              ) : values.length === 0 ? (
                <TableRow>
                  <TableCell className='text-muted-foreground'>No values found.</TableCell>
                </TableRow>
              ) : (
                values.map((value) => (
                  <TableRow
                    key={value}
                    className={draftValues.includes(value) ? 'bg-muted/60' : ''}
                    onClick={() => toggleValue(value)}
                  >
                    <TableCell>{value}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm(draftValues)
              onOpenChange(false)
            }}
            disabled={draftValues.length === 0}
          >
            Confirm selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
