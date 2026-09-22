import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { authService } from './services/authService';

import SuperAdminLayout from './components/SuperAdminLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TenantsPage from './pages/TenantsPage';
import HealthAlertsPage from './pages/HealthAlertsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import NotFoundPage from './pages/NotFoundPage';

const ProtectedAdminRoute = ({ children }) => {
  const user = authService.getCurrentUser();
  const token = localStorage.getItem('wbs_admin_token');
  if (!token || !user || (user.role !== 'super_admin' && user.role !== 'support')) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const PublicAdminRoute = ({ children }) => {
  const user = authService.getCurrentUser();
  const token = localStorage.getItem('wbs_admin_token');
  if (token && user && (user.role === 'super_admin' || user.role === 'support')) {
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicAdminRoute>
              <LoginPage />
            </PublicAdminRoute>
          }
        />

        <Route
          path="/"
          element={
            <ProtectedAdminRoute>
              <SuperAdminLayout />
            </ProtectedAdminRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="tenants" element={<TenantsPage />} />
          <Route path="alerts" element={<HealthAlertsPage />} />
          <Route path="audit" element={<AuditLogsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
