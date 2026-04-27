import { createFileRoute, redirect } from '@tanstack/react-router'
import { ComingSoon } from '@/components/coming-soon'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/user-management')({
  beforeLoad: () => {
    const role = useAuthStore.getState().auth.user?.role

    if (role === 'admin' || role === 'superadmin') return

    throw redirect({
      to: '/errors/$error',
      params: { error: 'forbidden' },
    })
  },
  component: ComingSoon,
})
