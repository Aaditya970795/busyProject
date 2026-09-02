import { useState } from "react";
import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { isManagerOrAbove } from "../lib/roles";
import { LogoutIcon, MenuIcon, XIcon } from "./icons";

const NAV_LINK_CLASS = ({ isActive }) =>
  `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
  }`;

// Same links, styled for a stacked mobile drawer instead of an inline pill row.
const MOBILE_NAV_LINK_CLASS = ({ isActive }) =>
  `block rounded-md px-3 py-2 text-base font-medium ${
    isActive ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
  }`;

// Polled rather than pushed — there's no websocket/SSE channel in this app, and a badge count
// being up to 30s stale is a fine tradeoff for not building one just for this. The alerts page
// itself invalidates this same query key on acknowledge, so acting on an alert clears the badge
// immediately instead of waiting for the next poll.
const ALERTS_POLL_INTERVAL_MS = 30 * 1000;

function AlertsBadge({ count }) {
  if (!count) return null;
  return (
    <span className="inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-4 text-white">
      {count}
    </span>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isManager = isManagerOrAbove(user?.role);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: alertsData } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => api.get("/alerts"),
    refetchInterval: ALERTS_POLL_INTERVAL_MS,
  });
  const alertCount = alertsData?.count ?? 0;

  async function handleLogout() {
    setMobileMenuOpen(false);
    await logout();
    navigate("/login", { replace: true });
  }

  const navLinks = (
    <>
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
      <NavLink to="/alerts" className={NAV_LINK_CLASS}>
        <span className="inline-flex items-center gap-1.5">
          Alerts
          <AlertsBadge count={alertCount} />
        </span>
      </NavLink>
      {isManager && (
        <NavLink to="/team" className={NAV_LINK_CLASS}>
          Team
        </NavLink>
      )}
    </>
  );

  const mobileNavLinks = (
    <>
      <NavLink to="/dashboard" className={MOBILE_NAV_LINK_CLASS} onClick={() => setMobileMenuOpen(false)}>
        Dashboard
      </NavLink>
      <NavLink to="/menu" className={MOBILE_NAV_LINK_CLASS} onClick={() => setMobileMenuOpen(false)}>
        Menu
      </NavLink>
      <NavLink to="/tables" className={MOBILE_NAV_LINK_CLASS} onClick={() => setMobileMenuOpen(false)}>
        Tables
      </NavLink>
      <NavLink to="/orders" className={MOBILE_NAV_LINK_CLASS} onClick={() => setMobileMenuOpen(false)}>
        Orders
      </NavLink>
      <NavLink to="/alerts" className={MOBILE_NAV_LINK_CLASS} onClick={() => setMobileMenuOpen(false)}>
        <span className="inline-flex items-center gap-1.5">
          Alerts
          <AlertsBadge count={alertCount} />
        </span>
      </NavLink>
      {isManager && (
        <NavLink to="/team" className={MOBILE_NAV_LINK_CLASS} onClick={() => setMobileMenuOpen(false)}>
          Team
        </NavLink>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-sm text-white">
                O
              </span>
              <span className="hidden sm:inline">Order Management</span>
            </span>
            <div className="hidden items-center gap-1 md:flex">{navLinks}</div>
          </div>

          <div className="hidden items-center gap-4 md:flex">
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

          <button
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          >
            {mobileMenuOpen ? <XIcon /> : <MenuIcon />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">{mobileNavLinks}</div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <div className="leading-tight">
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
        )}
      </nav>
      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
}
