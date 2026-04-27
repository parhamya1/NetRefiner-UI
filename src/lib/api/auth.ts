import { apiClient } from './client'
import type { ApiUser, LoginInput, LoginResponse } from '@/types/api'

export async function login(input: LoginInput): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', input)
  return data
}

export async function getMe(): Promise<ApiUser> {
  const { data } = await apiClient.get<ApiUser>('/auth/me')
  return data
}
