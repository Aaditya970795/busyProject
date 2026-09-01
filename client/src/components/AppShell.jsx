import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogoutIcon } from "./icons";

const NAV_LINK_CLASS = ({ isActive }) =>
  `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
  }`;

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-sm text-white">
                O
              </span>
              Order Management
            </span>
            <div className="flex items-center gap-1">
              <NavLink to="/dashboard" className={NAV_LINK_CLASS}>
                Dashboard
              </NavLink>
              <NavLink to="/menu" className={NAV_LINK_CLASS}>
                Menu
              </NavLink>
              <NavLink to="/tables" className={NAV_LINK_CLASS}>
                Tables
              </NavLink>
              <NavLink to="/orders" className={NAV_LINK_CLASS}>
                Orders
              </NavLink>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium text-slate-800">{user?.name}</p>
              <p className="text-xs capitalize text-slate-400">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
            >
              <LogoutIcon />
              Log out
            </button>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl p-6">
        <Outlet />
      </main>
    </div>
  );
}
