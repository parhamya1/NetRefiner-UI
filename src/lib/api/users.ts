import { apiClient } from './client'
import type {
  PagePermission,
  UpdateMyPasswordInput,
  UpdateUserPasswordInput,
  User,
  UserCreatePayload,
  UserUpdatePayload,
} from '@/types/api'

export async function getUsers(): Promise<User[]> {
  const { data } = await apiClient.get<User[]>('/users')
  return data
}

export async function createUser(payload: UserCreatePayload): Promise<User> {
  const { data } = await apiClient.post<User>('/users', payload)
  return data
}

export async function updateUser(
  userId: string,
  payload: UserUpdatePayload
): Promise<User> {
  const { data } = await apiClient.put<User>(
    `/users/${encodeURIComponent(userId)}`,
    payload
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
  permissions: PagePermission[]
): Promise<PagePermission[]> {
  const { data } = await apiClient.put<PagePermission[]>(
    `/users/${encodeURIComponent(userId)}/page-permissions`,
    { page_permissions: permissions }
  )
  return data
}

export const listUsers = getUsers
