import Landing from './pages/Landing';
import AppPage from './pages/AppPage';

export default function App() {
  const path = window.location.pathname;
  if (path === '/app' || path === '/app/') return <AppPage />;
  return <Landing />;
}
