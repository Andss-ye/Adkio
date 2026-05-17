import { useEffect, useState } from 'react';
import Landing from './pages/Landing';
import AppPage from './pages/AppPage';
import DashboardPage from './pages/DashboardPage';
import LegalPage from './pages/LegalPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import { isLoggedIn } from './lib/auth';

const PROTECTED = new Set(['/app', '/app/', '/dashboard', '/dashboard/', '/settings', '/settings/']);

export default function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    // Re-evalúa auth si el navegador restaura la página desde bfcache
    // (back/forward navigation) — evita que un /dashboard cacheado siga
    // visible después de un logout en otra pestaña.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setPath(window.location.pathname + '?_=' + Date.now());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'adkio.access_token' && !e.newValue && PROTECTED.has(window.location.pathname)) {
        window.location.replace('/login');
      }
    };
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const clean = path.split('?')[0];

  if (PROTECTED.has(clean) && !isLoggedIn()) {
    window.location.replace('/login');
    return null;
  }

  if (clean === '/login' || clean === '/login/') {
    if (isLoggedIn()) {
      window.location.replace('/dashboard');
      return null;
    }
    return <LoginPage />;
  }
  if (clean === '/app' || clean === '/app/') return <AppPage />;
  if (clean === '/dashboard' || clean === '/dashboard/') return <DashboardPage />;
  if (clean === '/settings' || clean === '/settings/') return <SettingsPage />;
  if (clean === '/privacidad') return <LegalPage slug="privacidad" />;
  if (clean === '/terminos') return <LegalPage slug="terminos" />;
  if (clean === '/seguridad') return <LegalPage slug="seguridad" />;
  if (clean === '/cookies') return <LegalPage slug="cookies" />;
  return <Landing />;
}
