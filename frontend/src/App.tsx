import Landing from './pages/Landing';
import AppPage from './pages/AppPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  const path = window.location.pathname;
  if (path === '/app' || path === '/app/') return <AppPage />;
  if (path === '/dashboard' || path === '/dashboard/') return <DashboardPage />;
  return <Landing />;
}
