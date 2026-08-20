import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/stores/authStore';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const session = useAuth((s) => s.session);
  const loading = useAuth((s) => s.loading);
  const hydrate = useAuth((s) => s.hydrate);

  useEffect(() => {
    if (loading) void hydrate();
  }, [loading, hydrate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
