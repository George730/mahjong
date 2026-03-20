// Redirects unauthenticated users to /login (preserves intended destination)

import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/auth-store.ts";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}
