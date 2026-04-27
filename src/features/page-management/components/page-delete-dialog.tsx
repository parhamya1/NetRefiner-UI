import { AxiosError } from 'axios'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { deletePage } from '@/lib/api/pages'
import { ConfirmDialog } from '@/components/confirm-dialog'
import type { Page } from '@/types/api'

type PageDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => Promise<void>
  page: Page | null
}

function getDeleteErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    const data = error.response?.data

    if (typeof data === 'string' && data.trim().length > 0) return data

    if (data && typeof data === 'object') {
      if ('detail' in data && typeof data.detail === 'string') return data.detail
      if ('message' in data && typeof data.message === 'string') return data.message
      if ('title' in data && typeof data.title === 'string') return data.title
    }
  }

  return 'Unable to delete page.'
}

export function PageDeleteDialog({
  open,
  onOpenChange,
  onSuccess,
  page,
}: PageDeleteDialogProps) {
  const mutation = useMutation({
    mutationFn: async () => {
      if (!page) return
      await deletePage(page.id)
    },
    onSuccess: async () => {
      toast.success('Page deleted successfully.')
      onOpenChange(false)
      await onSuccess()
    },
    onError: (error) => {
      toast.error(getDeleteErrorMessage(error))
    },
  })

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      handleConfirm={() => mutation.mutate()}
      disabled={!page}
      isLoading={mutation.isPending}
      title={
        <span className='text-destructive'>
          <AlertTriangle className='me-1 inline-block size-4 stroke-destructive' />
          Delete page
        </span>
      }
      desc={
        <p>
          Are you sure you want to delete <strong>{page?.title}</strong>? This action cannot be
          undone.
        </p>
      }
      confirmText='Delete'
      destructive
    />
  )
}
