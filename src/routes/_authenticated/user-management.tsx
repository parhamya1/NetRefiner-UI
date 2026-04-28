import { createFileRoute, redirect } from '@tanstack/react-router'
import { UserManagementPage } from '@/features/user-management'
import { ensureCurrentUser } from '@/lib/auth/ensure-current-user'

export const Route = createFileRoute('/_authenticated/user-management')({
  beforeLoad: async ({ location }) => {
    const user = await ensureCurrentUser()

    if (!user) {
      throw redirect({
        to: '/sign-in',
        search: {
          redirect: location.href,
        },
      })
    }

    if (user.role === 'admin' || user.role === 'superadmin') return

    throw redirect({
      to: '/errors/$error',
      params: { error: 'forbidden' },
    })
  },
  component: UserManagementPage,
})
