import { apiClient } from './client'
import type {
  ApiUser,
  PagePermission,
  UpdateMyPasswordInput,
  UpdateUserPagePermissionsInput,
  UpdateUserPasswordInput,
  UserCreateInput,
  UserUpdateInput,
} from '@/types/api'

export async function listUsers(): Promise<ApiUser[]> {
  const { data } = await apiClient.get<ApiUser[]>('/users')
  return data
}

export async function createUser(input: UserCreateInput): Promise<ApiUser> {
  const { data } = await apiClient.post<ApiUser>('/users', input)
  return data
}

export async function updateUser(
  userId: string,
  input: UserUpdateInput
): Promise<ApiUser> {
  const { data } = await apiClient.put<ApiUser>(
    `/users/${encodeURIComponent(userId)}`,
    input
  )
  return data
}

export async function deleteUser(userId: string): Promise<void> {
  await apiClient.delete(`/users/${encodeURIComponent(userId)}`)
}

export async function updateUserPassword(
  userId: string,
  input: UpdateUserPasswordInput
): Promise<void> {
  await apiClient.put(`/users/${encodeURIComponent(userId)}/password`, input)
}

export async function updateMyPassword(input: UpdateMyPasswordInput): Promise<void> {
  await apiClient.put('/users/me/password', input)
}

export async function getUserPagePermissions(
  userId: string
): Promise<PagePermission[]> {
  const { data } = await apiClient.get<PagePermission[]>(
    `/users/${encodeURIComponent(userId)}/page-permissions`
  )
  return data
}

export async function updateUserPagePermissions(
  userId: string,
  input: UpdateUserPagePermissionsInput
): Promise<PagePermission[]> {
  const { data } = await apiClient.put<PagePermission[]>(
    `/users/${encodeURIComponent(userId)}/page-permissions`,
    input
  )
  return data
}
