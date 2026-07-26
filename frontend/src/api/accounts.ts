import client from './client'
import { ACCOUNTS } from './endpoints'
import type { AccountResponse } from '../types'

export interface CreateAccountPayload {
  fullName: string
  email: string
  phone?: string
  role: string
  password: string
  confirmPassword: string
  memberId?: number
}

export interface UpdateAccountPayload {
  fullName: string
  phone?: string
  role: string
  status?: string
}

export async function getAccounts(search?: string): Promise<AccountResponse[]> {
  const { data } = await client.get<AccountResponse[]>(ACCOUNTS.BASE, {
    params: search ? { search } : undefined,
  })
  return data
}

export async function createAccount(
  payload: CreateAccountPayload
): Promise<AccountResponse> {
  const { data } = await client.post<AccountResponse>(ACCOUNTS.BASE, payload)
  return data
}

export async function updateAccount(
  id: number,
  payload: UpdateAccountPayload
): Promise<AccountResponse> {
  const { data } = await client.put<AccountResponse>(ACCOUNTS.BY_ID(id), payload)
  return data
}

export async function toggleAccountStatus(id: number): Promise<AccountResponse> {
  const { data } = await client.patch<AccountResponse>(ACCOUNTS.STATUS(id))
  return data
}
