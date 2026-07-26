import { AxiosError } from 'axios'
import client from './client'
import { AUTH } from './endpoints'
import type { ApiError, LoginResponse } from '../types'

export async function loginUser(email: string, password: string): Promise<LoginResponse> {
  const { data } = await client.post<LoginResponse>(AUTH.LOGIN, { email, password })
  return data
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const { data } = await client.post<{ message: string }>(AUTH.FORGOT_PASSWORD, { email })
  return data
}

export async function resetPassword(
  token: string,
  newPassword: string,
  confirmPassword: string
): Promise<{ message: string }> {
  const { data } = await client.post<{ message: string }>(AUTH.RESET_PASSWORD, {
    token,
    newPassword,
    confirmPassword,
  })
  return data
}

/**
 * Chuẩn hóa lỗi trả về từ backend về mảng ApiError.
 * Backend có 2 dạng lỗi:
 *  - Lỗi nghiệp vụ (ApiException): { field?, message }
 *  - Lỗi validation (@NotBlank):   [{ field, message }]
 */
export function parseApiError(error: unknown): ApiError[] {
  const axiosError = error as AxiosError<ApiError | ApiError[]>
  const data = axiosError.response?.data

  if (Array.isArray(data)) {
    return data.filter((e): e is ApiError => !!e && typeof e.message === 'string')
  }
  if (data && typeof data.message === 'string') {
    return [data]
  }
  return [{ message: 'Đã có lỗi xảy ra. Vui lòng thử lại.' }]
}
