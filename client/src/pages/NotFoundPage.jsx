import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";

export function NotFoundPage() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center animate-fade-in">
      <p className="text-sm font-medium text-indigo-600">404</p>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Page not found</h1>
      <p className="max-w-sm text-sm text-slate-500">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Link to={user ? "/dashboard" : "/"} className="mt-2">
        <Button variant="secondary">{user ? "Back to dashboard" : "Back home"}</Button>
      </Link>
    </div>
  );
}
