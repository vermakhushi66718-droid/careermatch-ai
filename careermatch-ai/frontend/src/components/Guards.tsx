import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "./ui";

export const FullPageLoader = () => <div className="min-h-screen grid place-items-center"><Spinner className="h-8 w-8" /></div>;

export function RequireAuth() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (user.role === "USER" && !user.onboardingComplete && loc.pathname !== "/onboarding") return <Navigate to="/onboarding" replace />;
  if (user.role === "ADMIN" && !loc.pathname.startsWith("/admin")) return <Navigate to="/admin" replace />;
  return <Outlet />;
}

export function RequireAdmin() {
  const { user } = useAuth();
  return user?.role === "ADMIN" ? <Outlet /> : <Navigate to="/dashboard" replace />;
}

export function PublicOnly() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (user) return <Navigate to={user.role === "ADMIN" ? "/admin" : "/dashboard"} replace />;
  return <Outlet />;
}
