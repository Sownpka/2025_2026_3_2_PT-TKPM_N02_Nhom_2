import { useAuthStore } from '../stores/auth'
import type { Role } from '../types'

interface HeaderProps {
  title: string
}

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Quản trị viên',
  RECEPTIONIST: 'Lễ tân',
  TRAINER: 'Huấn luyện viên',
  MEMBER: 'Hội viên',
}

export default function Header({ title }: HeaderProps) {
  const role = useAuthStore((s) => s.role)
  const fullName = useAuthStore((s) => s.fullName)

  return (
    <header className="bg-white shadow-sm h-16 flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
      {role && (
        <span className="bg-teal-50 text-teal-700 px-3 py-1 rounded-full text-sm font-medium">
          {ROLE_LABEL[role]} – {fullName}
        </span>
      )}
    </header>
  )
}
