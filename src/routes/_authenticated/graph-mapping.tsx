import { createFileRoute, redirect } from '@tanstack/react-router'
import { GraphMappingPage } from '@/features/graph-mapping'
import { ensureCurrentUser } from '@/lib/auth/ensure-current-user'

export const Route = createFileRoute('/_authenticated/graph-mapping')({
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
  component: GraphMappingPage,
})
