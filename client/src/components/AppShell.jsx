import { useEffect, useState } from "react";
import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { isManagerOrAbove } from "../lib/roles";
import { LogoutIcon, MenuIcon, XIcon } from "./icons";
import { Footer } from "./Footer";
import { PageTransition } from "./ui/PageTransition";
import { BackgroundRippleEffect } from "./ui/BackgroundRippleEffect";

const NAV_LINK_CLASS = ({ isActive }) =>
  `relative rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
    isActive
      ? "brand-gradient text-white shadow-md shadow-indigo-500/30"
      : "text-zinc-400 hover:bg-white/5 hover:text-white"
  }`;

// Same links, styled for a stacked mobile drawer instead of an inline pill row.
const MOBILE_NAV_LINK_CLASS = ({ isActive }) =>
  `block rounded-xl px-3.5 py-2.5 text-base font-medium transition-colors ${
    isActive ? "brand-gradient text-white shadow-md shadow-indigo-500/30" : "text-zinc-300 hover:bg-white/5 hover:text-white"
  }`;

// Polled rather than pushed — there's no websocket/SSE channel in this app, and a badge count
// being up to 30s stale is a fine tradeoff for not building one just for this. The alerts page
// itself invalidates this same query key on acknowledge, so acting on an alert clears the badge
// immediately instead of waiting for the next poll.
const ALERTS_POLL_INTERVAL_MS = 30 * 1000;

// Same polling trade-off as the alerts badge above — no push channel in this app, so a toast for
// something like an auto-cancelled order can land up to 30s after the fact instead of instantly.
const NOTIFICATIONS_POLL_INTERVAL_MS = 30 * 1000;

function AlertsBadge({ count }) {
  if (!count) return null;
  return (
    <span className="animate-pulse-ring inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-red-600 px-1 text-[10px] font-bold leading-4 text-white">
      {count}
    </span>
  );
}

function LogoutButton({ className = "" }) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-sm font-medium text-zinc-200 backdrop-blur transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white ${className}`}
    >
      <LogoutIcon />
      Log out
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

  const { data: notificationsData } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api.get("/notifications/unread"),
    refetchInterval: NOTIFICATIONS_POLL_INTERVAL_MS,
  });

  const markNotificationReadMutation = useMutation({
    mutationFn: (id) => api.post(`/notifications/${id}/read`),
  });

  // Toasting happens as a side effect of the poll landing new rows, not inside the query itself —
  // TanStack Query v5 has no onSuccess for useQuery. Marking each one read immediately means it
  // can't come back on the next poll and toast a second time.
  useEffect(() => {
    const notifications = notificationsData?.notifications;
    if (!notifications?.length) return;
    for (const notification of notifications) {
      toast.error(notification.message);
      markNotificationReadMutation.mutate(notification.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationsData]);

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
      <NavLink to="/orders/history" className={NAV_LINK_CLASS}>
        History
      </NavLink>
      <NavLink to="/orders/deleted" className={NAV_LINK_CLASS}>
        Deleted
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
      <NavLink to="/orders/history" className={MOBILE_NAV_LINK_CLASS} onClick={() => setMobileMenuOpen(false)}>
        History
      </NavLink>
      <NavLink to="/orders/deleted" className={MOBILE_NAV_LINK_CLASS} onClick={() => setMobileMenuOpen(false)}>
        Deleted
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
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <BackgroundRippleEffect />
      <ToastContainer position="top-right" autoClose={6000} newestOnTop />
      <nav className="sticky top-0 z-10 overflow-hidden bg-zinc-950 shadow-lg shadow-black/10">
        <div className="pointer-events-none absolute inset-0 bg-mesh-glow" />
        <div className="relative flex items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2.5 font-bold text-white">
              <span className="brand-gradient grid h-9 w-9 place-items-center rounded-xl text-base shadow-lg shadow-indigo-500/30">
                O
              </span>
              <span className="hidden text-[1.05rem] tracking-tight sm:inline">
                Order <span className="brand-gradient-text">Management</span>
              </span>
            </span>
            <div className="hidden items-center gap-1 md:flex">{navLinks}</div>
          </div>

          <div className="hidden items-center gap-4 md:flex">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <span className="inline-block rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                {user?.role}
              </span>
            </div>
            <button onClick={handleLogout}>
              <LogoutButton />
            </button>
          </div>

          <button
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            className="rounded-full p-2 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white md:hidden"
          >
            {mobileMenuOpen ? <XIcon /> : <MenuIcon />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="animate-fade-in-fast relative border-t border-white/10 bg-zinc-950 px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">{mobileNavLinks}</div>
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
              <div className="leading-tight">
                <p className="text-sm font-medium text-white">{user?.name}</p>
                <span className="inline-block rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                  {user?.role}
                </span>
              </div>
              <button onClick={handleLogout}>
                <LogoutButton />
              </button>
            </div>
          </div>
        )}
      </nav>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
      <Footer />
    </div>
  );
}
