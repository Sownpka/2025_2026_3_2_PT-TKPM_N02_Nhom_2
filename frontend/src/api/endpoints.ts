export const AUTH = {
  LOGIN: '/auth/login',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',
} as const

export const ACCOUNTS = {
  BASE: '/accounts',
  BY_ID: (id: number) => `/accounts/${id}`,
  STATUS: (id: number) => `/accounts/${id}/status`,
} as const

export const MEMBERS = {
  BASE: '/members',
  BY_ID: (id: number) => `/members/${id}`,
  HISTORY: (id: number) => `/members/${id}/history`,
  PACKAGES: (id: number) => `/members/${id}/packages`,
  SEARCH: '/members/search',
  STATUS: (id: number) => `/members/${id}/status`,
  WITHOUT_ACCOUNT: '/members/without-account',
} as const

export const PACKAGE_TYPES = {
  BASE: '/package-types',
  BY_ID: (id: number) => `/package-types/${id}`,
  STATUS: (id: number) => `/package-types/${id}/status`,
} as const

export const MEMBER_PACKAGES = {
  BASE: '/member-packages',
} as const

export const CLASSES = {
  BASE: '/classes',
  BY_ID: (id: number) => `/classes/${id}`,
  TIMETABLE: '/timetable',
} as const

export const EQUIPMENT = {
  BASE: '/equipment',
  BY_ID: (id: number) => `/equipment/${id}`,
} as const

export const TRAINERS = {
  BASE: '/trainers',
  BY_ID: (id: number) => `/trainers/${id}`,
  SHIFTS: (id: number) => `/trainers/${id}/shifts`,
} as const

export const BOOKINGS = {
  BASE: '/bookings',
  BY_ID: (id: number) => `/bookings/${id}`,
  WAITLIST: '/waitlist',
} as const

export const PRIVATE_BOOKING = {
  SLOTS: '/private-booking/slots',
  BASE: '/private-booking',
} as const

export const ATTENDANCE = {
  TODAY: '/attendance/today',
  ATTENDEES: (id: number) => `/attendance/${id}/attendees`,
  CHECK_IN: (id: number) => `/attendance/${id}/check-in`,
  NO_SHOW: (id: number) => `/attendance/${id}/no-show`,
  QUICK_CHECKIN: '/attendance/quick-checkin',
} as const

export const ME = {
  PACKAGES: '/me/packages',
  HISTORY: '/me/history',
  BOOKINGS: '/me/bookings',
} as const

export const TRAINER_API = {
  SCHEDULE: '/trainer/schedule',
  SESSION_ATTENDEES: (id: number) => `/trainer/sessions/${id}/attendees`,
} as const

export const FINANCE = {
  REPORT: '/finance/report',
  EXPENSES: '/finance/expenses',
  EXPENSE_BY_ID: (id: number) => `/finance/expenses/${id}`,
  COMPARISON: '/finance/comparison',
} as const

export const NOTIFICATIONS = {
  BASE: '/notifications',
} as const

export const DASHBOARD = {
  BASE: '/dashboard',
} as const
