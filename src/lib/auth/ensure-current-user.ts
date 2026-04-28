import { getMe } from '@/lib/api/auth'
import { useAuthStore } from '@/stores/auth-store'
import type { ApiUser } from '@/types/api'

let hydrationPromise: Promise<ApiUser | null> | null = null

export async function ensureCurrentUser(): Promise<ApiUser | null> {
  const { auth } = useAuthStore.getState()

  if (!auth.accessToken) return null
  if (auth.user) return auth.user

  if (hydrationPromise) return hydrationPromise

  hydrationPromise = (async () => {
    try {
      const user = await getMe()
      useAuthStore.getState().auth.setUser(user)
      return user
    } catch {
      useAuthStore.getState().auth.reset()
      return null
    } finally {
      hydrationPromise = null
    }
  })()

  return hydrationPromise
}
