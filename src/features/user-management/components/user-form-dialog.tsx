import { useState } from 'react'
import { AxiosError } from 'axios'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createUser, updateUser } from '@/lib/api/users'
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
import type { User, UserCreatePayload, UserRole, UserUpdatePayload } from '@/types/api'

type UserFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId?: string
  user?: User | null
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

  return 'Unable to save user.'
}

export function UserFormDialog({
  open,
  onOpenChange,
  currentUserId,
  user,
  onSuccess,
}: UserFormDialogProps) {
  const isEdit = !!user
  const isSelfEditing = !!user && user.id === currentUserId

  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>(user?.role ?? 'user')
  const [isActive, setIsActive] = useState(user?.is_active ?? true)

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit && user) {
        const payload: UserUpdatePayload = {
          full_name: fullName.trim(),
          email: email.trim(),
          role,
          is_active: isActive,
        }

        return updateUser(user.id, payload)
      }

      const payload: UserCreatePayload = {
        full_name: fullName.trim(),
        email: email.trim(),
        password: password.trim(),
        role,
        is_active: isActive,
      }

      return createUser(payload)
    },
    onSuccess: async () => {
      toast.success(isEdit ? 'User updated successfully.' : 'User created successfully.')
      onOpenChange(false)
      await onSuccess()
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })

  const canSubmit =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    (isEdit || password.trim().length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit user' : 'Create user'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update user details.' : 'Add a new user account.'}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='grid gap-1.5'>
            <Label htmlFor='user-full-name'>Full name</Label>
            <Input
              id='user-full-name'
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>

          <div className='grid gap-1.5'>
            <Label htmlFor='user-email'>Email</Label>
            <Input
              id='user-email'
              type='email'
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          {!isEdit ? (
            <div className='grid gap-1.5'>
              <Label htmlFor='user-password'>Password</Label>
              <Input
                id='user-password'
                type='password'
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          ) : null}

          <div className='grid gap-1.5'>
            <Label>Role</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as UserRole)}
              disabled={isSelfEditing}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='superadmin'>superadmin</SelectItem>
                <SelectItem value='admin'>admin</SelectItem>
                <SelectItem value='user'>user</SelectItem>
              </SelectContent>
            </Select>
            {isSelfEditing ? (
              <p className='text-xs text-muted-foreground'>
                You cannot change your own role.
              </p>
            ) : null}
          </div>

          <div className='flex items-center justify-between rounded-md border px-3 py-2'>
            <Label htmlFor='user-is-active'>Active</Label>
            <Switch id='user-is-active' checked={isActive} onCheckedChange={setIsActive} />
          </div>
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
