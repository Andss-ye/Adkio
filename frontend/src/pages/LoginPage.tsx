import AuthScreen from '@/components/settings/AuthScreen';
import { signup, login } from '@/lib/auth';

export default function LoginPage() {
  return (
    <AuthScreen
      onSuccess={() => {
        window.location.replace('/dashboard');
      }}
      signup={signup}
      login={login}
    />
  );
}
