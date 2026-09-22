import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layout
import ClientLayout from './components/layout/ClientLayout';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Client Pages
import DashboardPage from './pages/client/DashboardPage';
import OnboardingPage from './pages/client/OnboardingPage';
import InboxPage from './pages/client/InboxPage';
import ContactsPage from './pages/client/ContactsPage';
import TemplatesPage from './pages/client/TemplatesPage';
import BroadcastsPage from './pages/client/BroadcastsPage';
import ChatbotPage from './pages/client/ChatbotPage';
import TeamPage from './pages/client/TeamPage';
import SettingsPage from './pages/client/SettingsPage';

// 404
import NotFoundPage from './pages/NotFoundPage';

// Route Guards per MERN SOP 12: Authentication & Route Protection
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('wbs_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const PublicRoute = ({ children }) => {
  const token = localStorage.getItem('wbs_token');
  if (token) {
    return <Navigate to="/" replace />;
  }
  return children;
};

const RedirectToAdmin = () => {
  useEffect(() => {
    window.location.href = '/admin/#/';
  }, []);
  return null;
};

function App() {
  useEffect(() => {
    if (window.location.pathname.startsWith('/onboarding')) {
      const search = window.location.search || '';
      window.location.replace(`/#/onboarding${search}`);
    }
  }, []);

  return (
    <HashRouter>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={<Navigate to="/login" replace />}
        />
        <Route
          path="/superadmin"
          element={<RedirectToAdmin />}
        />

        {/* Client Business Panel Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <ClientLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="broadcasts" element={<BroadcastsPage />} />
          <Route path="chatbot" element={<ChatbotPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* 404 Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
