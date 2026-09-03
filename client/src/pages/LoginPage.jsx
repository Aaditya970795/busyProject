import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { ErrorMessage } from "../components/ui/ErrorMessage";

export function LoginPage() {
  const { login, isLoggingIn, loginError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await login({ email, password });
      navigate("/dashboard", { replace: true });
    } catch {
      // surfaced via loginError
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 animate-fade-in">
      <Card className="w-full max-w-sm">
        <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-sm text-white">
            O
          </span>
          Order Management
        </Link>
        <h1 className="mt-6 text-xl font-semibold text-slate-900">Log in</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            label="Email"
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <ErrorMessage error={loginError} />
          <Button type="submit" loading={isLoggingIn} className="w-full">
            {isLoggingIn ? "Logging in…" : "Log in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          No account? Ask your manager or admin to set one up for you.
        </p>
      </Card>
    </div>
  );
}
