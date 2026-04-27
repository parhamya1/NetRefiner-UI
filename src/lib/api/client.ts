import axios, { type AxiosError } from 'axios'
import { useAuthStore } from '@/stores/auth-store'

const baseURL = import.meta.env.VITE_API_BASE_URL

if (!baseURL) {
  // eslint-disable-next-line no-console
  console.warn(
    'VITE_API_BASE_URL is not set. API requests will fail until it is configured.'
  )
}

let isRedirectingToSignIn = false

function redirectToSignIn() {
  if (typeof window === 'undefined') return

  const { pathname, search, hash, href } = window.location
  const isSignInRoute = pathname === '/sign-in'

  if (isSignInRoute || isRedirectingToSignIn) return

  isRedirectingToSignIn = true

  const currentLocation = `${pathname}${search}${hash}`
  const redirect = encodeURIComponent(currentLocation || href)
  window.location.assign(`/sign-in?redirect=${redirect}`)
}

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().auth.accessToken

  if (!token) return config

  config.headers = config.headers ?? {}
  config.headers.Authorization = `Bearer ${token}`

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status !== 401) {
      return Promise.reject(error)
    }

    const requestUrl = error.config?.url ?? ''
    const isAuthLoginRequest = requestUrl.includes('/auth/login')

    if (!isAuthLoginRequest) {
      useAuthStore.getState().auth.reset()
      redirectToSignIn()
    }

    return Promise.reject(error)
  }
)
