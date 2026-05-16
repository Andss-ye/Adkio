import Landing from './pages/Landing';
import AppPage from './pages/AppPage';
import DashboardPage from './pages/DashboardPage';
import LegalPage from './pages/LegalPage';
import AuthPage from './pages/AuthPage';

export default function App() {
  const path = window.location.pathname;
  if (path === '/app' || path === '/app/') return <AppPage />;
  if (path === '/dashboard' || path === '/dashboard/') return <DashboardPage />;
  if (path === '/login' || path === '/login/') return <AuthPage initialMode="login" />;
  if (path === '/signup' || path === '/signup/') return <AuthPage initialMode="signup" />;
  // Compat: /settings redirige al dashboard (donde vive ahora el panel)
  if (path === '/settings' || path === '/settings/') {
    window.location.replace('/dashboard?panel=settings');
    return null;
  }
  if (path === '/privacidad') return <LegalPage slug="privacidad" />;
  if (path === '/terminos') return <LegalPage slug="terminos" />;
  if (path === '/seguridad') return <LegalPage slug="seguridad" />;
  if (path === '/cookies') return <LegalPage slug="cookies" />;
  return <Landing />;
}
