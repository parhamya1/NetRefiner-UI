import { AxiosError } from 'axios'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { deleteUser } from '@/lib/api/users'
import { ConfirmDialog } from '@/components/confirm-dialog'
import type { User } from '@/types/api'

type UserDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  disabled?: boolean
  onSuccess: () => Promise<void>
}

function getErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    const data = error.response?.data

    if (typeof data === 'string' && data.trim().length > 0) return data

    if (data && typeof data === 'object') {
      if ('detail' in data && typeof data.detail === 'string') return data.detail
      if ('message' in data && typeof data.message === 'string') return data.message
      if ('title' in data && typeof data.title === 'string') return data.title
    }
  }

  return 'Unable to delete user.'
}

export function UserDeleteDialog({
  open,
  onOpenChange,
  user,
  disabled,
  onSuccess,
}: UserDeleteDialogProps) {
  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) return
      await deleteUser(user.id)
    },
    onSuccess: async () => {
      toast.success('User deleted successfully.')
      onOpenChange(false)
      await onSuccess()
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      handleConfirm={() => mutation.mutate()}
      disabled={!user || disabled}
      isLoading={mutation.isPending}
      title={
        <span className='text-destructive'>
          <AlertTriangle className='me-1 inline-block size-4 stroke-destructive' />
          Delete user
        </span>
      }
      desc={
        <p>
          Are you sure you want to delete <strong>{user?.full_name}</strong>?
          This action cannot be undone.
        </p>
      }
      confirmText='Delete'
      destructive
    />
  )
}
