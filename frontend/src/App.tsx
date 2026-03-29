import { Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import PharmacyRegistrationPage from './pages/PharmacyRegistrationPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import MedicinesPage from './pages/MedicinesPage'
import PurchasePage from './pages/PurchasePage.jsx'
import PurchasesViewPage from './pages/PurchasesViewPage'
import SalesPage from './pages/SalesPage.jsx'
import UsersPage from './pages/UsersPage'
import DistributorsPage from './pages/DistributorsPage'
import StocksPage from './pages/StocksPage'
import SuperAdminLoginPage from './pages/SuperAdminLoginPage'
import PendingPharmaciesPage from './pages/PendingPharmaciesPage'
import CategoriesPage from './pages/CategoriesPage'
import RequireAuth from './components/RequireAuth'
import RequireRole from './components/RequireRole'
import TenantLayout from './components/TenantLayout'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/pharmacy/register" element={<PharmacyRegistrationPage />} />
      <Route path="/pharmacy-registration" element={<Navigate to="/pharmacy/register" replace />} />

      {/* Subdomain/prod-style routes (tenant resolved from host/header) */}
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/medicines"
        element={
          <RequireAuth>
            <MedicinesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/stocks"
        element={
          <RequireAuth>
            <StocksPage />
          </RequireAuth>
        }
      />
      <Route
        path="/purchases"
        element={
          <RequireAuth>
            <PurchasePage />
          </RequireAuth>
        }
      />
      <Route
        path="/purchases/view"
        element={
          <RequireAuth>
            <PurchasesViewPage />
          </RequireAuth>
        }
      />
      <Route
        path="/distributors"
        element={
          <RequireAuth>
            <DistributorsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/sales"
        element={
          <RequireAuth>
            <SalesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/users"
        element={
          <RequireAuth>
            <UsersPage />
          </RequireAuth>
        }
      />

      <Route path="/superadmin/login" element={<SuperAdminLoginPage />} />
      <Route
        path="/superadmin/pending"
        element={
          <RequireAuth loginPath="/superadmin/login">
            <RequireRole role="SuperAdmin">
              <PendingPharmaciesPage />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/superadmin/categories"
        element={
          <RequireAuth loginPath="/superadmin/login">
            <RequireRole role="SuperAdmin">
              <CategoriesPage />
            </RequireRole>
          </RequireAuth>
        }
      />

      {/* Tenant routes: http://localhost:5173/{slug}/... */}
      <Route path="/:tenantSlug" element={<TenantLayout />}>
        <Route index element={<Navigate to="login" replace />} />
        <Route path="login" element={<LoginPage />} />
        <Route
          path="dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="medicines"
          element={
            <RequireAuth>
              <MedicinesPage />
            </RequireAuth>
          }
        />
        <Route
          path="stocks"
          element={
            <RequireAuth>
              <StocksPage />
            </RequireAuth>
          }
        />
        <Route
          path="purchases"
          element={
            <RequireAuth>
              <PurchasePage />
            </RequireAuth>
          }
        />
        <Route
          path="purchases/view"
          element={
            <RequireAuth>
              <PurchasesViewPage />
            </RequireAuth>
          }
        />
        <Route
          path="distributors"
          element={
            <RequireAuth>
              <DistributorsPage />
            </RequireAuth>
          }
        />
        <Route
          path="sales"
          element={
            <RequireAuth>
              <SalesPage />
            </RequireAuth>
          }
        />
        <Route
          path="users"
          element={
            <RequireAuth>
              <UsersPage />
            </RequireAuth>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
