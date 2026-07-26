import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminAccountsPage from './pages/admin/AdminAccountsPage'
import AdminPackageTypesPage from './pages/admin/AdminPackageTypesPage'
import AdminEquipmentPage from './pages/admin/AdminEquipmentPage'
import AdminTrainersPage from './pages/admin/AdminTrainersPage'
import AdminClassesPage from './pages/admin/AdminClassesPage'
import NotificationsPage from './pages/admin/NotificationsPage'
import FinancePage from './pages/admin/FinancePage'
import ReceptionMembersPage from './pages/reception/ReceptionMembersPage'
import RegisterPackagePage from './pages/reception/RegisterPackagePage'
import AttendancePage from './pages/reception/AttendancePage'
import MemberHistoryPage from './pages/member/MemberHistoryPage'
import MemberBookingPage from './pages/member/MemberBookingPage'
import MyBookingsPage from './pages/member/MyBookingsPage'
import PrivateBookingPage from './pages/member/PrivateBookingPage'
import TrainerSchedulePage from './pages/trainer/TrainerSchedulePage'
import SessionAttendeesPage from './pages/trainer/SessionAttendeesPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public — UC1.1 */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected — ADMIN + RECEPTIONIST (UC4.1: cả 2 vai trò quản lý lớp học) */}
        <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'RECEPTIONIST']} />}>
          <Route element={<Layout />}>
            <Route path="/admin/classes" element={<AdminClassesPage />} />
          </Route>
        </Route>

        {/* Protected — ADMIN */}
        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
          <Route element={<Layout />}>
            <Route path="/admin/accounts" element={<AdminAccountsPage />} />
            <Route
              path="/admin/dashboard"
              element={<AdminDashboardPage />}
            />
            <Route
              path="/admin/members"
              element={<ReceptionMembersPage />}
            />
            <Route path="/admin/package-types" element={<AdminPackageTypesPage />} />
            <Route
              path="/admin/attendance"
              element={<AttendancePage />}
            />
            <Route path="/admin/equipment" element={<AdminEquipmentPage />} />
            <Route path="/admin/trainers" element={<AdminTrainersPage />} />
            <Route path="/admin/notifications" element={<NotificationsPage />} />
            <Route path="/admin/finance" element={<FinancePage />} />
          </Route>
        </Route>

        {/* Protected — RECEPTIONIST */}
        <Route element={<ProtectedRoute allowedRoles={['RECEPTIONIST']} />}>
          <Route element={<Layout />}>
            <Route path="/reception/members" element={<ReceptionMembersPage />} />
            <Route
              path="/reception/register-package"
              element={<RegisterPackagePage />}
            />
            <Route path="/reception/attendance" element={<AttendancePage />} />
          </Route>
        </Route>

        {/* Protected — MEMBER */}
        <Route element={<ProtectedRoute allowedRoles={['MEMBER']} />}>
          <Route element={<Layout />}>
            <Route path="/member/history" element={<MemberHistoryPage />} />
            <Route path="/member/booking" element={<MemberBookingPage />} />
            <Route path="/member/my-bookings" element={<MyBookingsPage />} />
            <Route path="/member/private-booking" element={<PrivateBookingPage />} />
          </Route>
        </Route>

        {/* Protected — TRAINER */}
        <Route element={<ProtectedRoute allowedRoles={['TRAINER']} />}>
          <Route element={<Layout />}>
            <Route path="/trainer/schedule" element={<TrainerSchedulePage />} />
            <Route
              path="/trainer/session/:sessionId/attendees"
              element={<SessionAttendeesPage />}
            />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
