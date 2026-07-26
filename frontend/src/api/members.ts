import client from './client'
import { MEMBERS } from './endpoints'
import type { MemberResponse, MemberDetailResponse } from '../types'

export interface CreateMemberPayload {
  fullName: string
  phone: string
  email: string
  dob?: string
  gender?: string
  note?: string
}

export interface UpdateMemberPayload {
  fullName: string
  phone: string
  dob?: string
  gender?: string
  note?: string
  status?: string
}

export async function getMembers(search?: string): Promise<MemberResponse[]> {
  const { data } = await client.get<MemberResponse[]>(MEMBERS.BASE, {
    params: search ? { search } : undefined,
  })
  return data
}

export async function createMember(
  payload: CreateMemberPayload
): Promise<MemberResponse> {
  const { data } = await client.post<MemberResponse>(MEMBERS.BASE, payload)
  return data
}

export async function updateMember(
  id: number,
  payload: UpdateMemberPayload
): Promise<MemberResponse> {
  const { data } = await client.put<MemberResponse>(MEMBERS.BY_ID(id), payload)
  return data
}

export async function toggleMemberStatus(id: number): Promise<MemberResponse> {
  const { data } = await client.patch<MemberResponse>(MEMBERS.STATUS(id))
  return data
}

export async function getMemberDetail(
  id: number
): Promise<MemberDetailResponse> {
  const { data } = await client.get<MemberDetailResponse>(MEMBERS.HISTORY(id))
  return data
}

export async function getMembersWithoutAccount(): Promise<MemberResponse[]> {
  const { data } = await client.get<MemberResponse[]>(MEMBERS.WITHOUT_ACCOUNT)
  return data
}
