import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { ensureCurrentUser } from '@/lib/auth/ensure-current-user'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const accessToken = useAuthStore.getState().auth.accessToken

    if (!accessToken) {
      throw redirect({
        to: '/sign-in',
        search: {
          redirect: location.href,
        },
      })
    }

    const user = await ensureCurrentUser()

    if (user) return

    throw redirect({
      to: '/sign-in',
      search: {
        redirect: location.href,
      },
    })
  },
  component: AuthenticatedLayout,
})
