import { createFileRoute, redirect } from '@tanstack/react-router'
import { PageManagementPage } from '@/features/page-management'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/page-management')({
  beforeLoad: () => {
    const role = useAuthStore.getState().auth.user?.role

    if (role === 'admin' || role === 'superadmin') return

    throw redirect({
      to: '/errors/$error',
      params: { error: 'forbidden' },
    })
  },
  component: PageManagementPage,
})
