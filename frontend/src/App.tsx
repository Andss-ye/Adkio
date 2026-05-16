import Landing from './pages/Landing';
import AppPage from './pages/AppPage';
import DashboardPage from './pages/DashboardPage';
import LegalPage from './pages/LegalPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  const path = window.location.pathname;
  if (path === '/app' || path === '/app/') return <AppPage />;
  if (path === '/dashboard' || path === '/dashboard/') return <DashboardPage />;
  if (path === '/settings' || path === '/settings/') return <SettingsPage />;
  if (path === '/privacidad') return <LegalPage slug="privacidad" />;
  if (path === '/terminos') return <LegalPage slug="terminos" />;
  if (path === '/seguridad') return <LegalPage slug="seguridad" />;
  if (path === '/cookies') return <LegalPage slug="cookies" />;
  return <Landing />;
}
