import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isManagerOrAbove } from "../lib/roles";
import { LayersIcon, TrendingUpIcon, StarIcon, BellIcon, UsersIcon } from "./icons";

const CAPABILITIES = [
  { icon: LayersIcon, label: "Role-based menu & order control" },
  { icon: TrendingUpIcon, label: "Live order lifecycle tracking" },
  { icon: StarIcon, label: "Manager dashboard & trends" },
  { icon: BellIcon, label: "Slow-order alerts" },
  { icon: UsersIcon, label: "Full audit trail" },
];



const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/menu", label: "Menu" },
  { to: "/tables", label: "Tables" },
  { to: "/orders", label: "Orders" },
  { to: "/alerts", label: "Alerts" },
];

function Brand({ tagline }) {
  return (
    <div className="max-w-xs">
      <span className="flex items-center gap-2.5 font-bold text-white">
        <span className="brand-gradient grid h-8 w-8 place-items-center rounded-xl text-sm shadow-lg shadow-indigo-500/30">
          O
        </span>
        <span className="text-[1.05rem] tracking-tight">
          Order <span className="brand-gradient-text">Management</span>
        </span>
      </span>
      <p className="mt-3 text-sm text-zinc-400">{tagline}</p>
    </div>
  );
}

function FooterColumn({ title, children }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="mt-3 flex flex-col gap-2.5 text-sm text-zinc-400">{children}</div>
    </div>
  );
}

function BottomBar({ year }) {
  return (
    <div className="relative mt-10 flex  gap-2 border-t border-white/10 pt-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
      <span className="brand-gradient absolute inset-x-0 top-0 h-px opacity-70" />
      <span className="flex w-full items-center justify-center gap-1.5">
        © {year} <span className="text-zinc-300">Order Management</span>. 
      </span>
      
    </div>
  );
}

// One component, two contexts: the public landing page gets the full pitch (capabilities, tech
// stack), the logged-in app shell gets the same dark identity plus real in-app navigation and
// the current session instead of marketing copy. No links to pages that don't exist — this
// project has no privacy policy, blog, terms, etc.
export function Footer({ variant = "app" }) {
  const year = new Date().getFullYear();
  const { user, logout } = useAuth();
  const isManager = isManagerOrAbove(user?.role);

  if (variant === "landing") {
    return (
      <footer className="relative overflow-hidden border-t border-white/10 bg-zinc-900">
        <div className="pointer-events-none absolute inset-0 bg-mesh-glow" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr]">
            <Brand tagline="Replaces the paper-ticket and corkboard workflow with one shared, live view of every table — built for restaurant waiters and managers." />

            <FooterColumn title="What it does">
              {CAPABILITIES.map(({ icon: Icon, label }) => (
                <span key={label} className="flex items-center gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/5 text-indigo-300">
                    <Icon width="11" height="11" />
                  </span>
                  {label}
                </span>
              ))}
            </FooterColumn>

            <FooterColumn title="Get started">
              <Link to="/login" className="transition-colors hover:text-white">
                Log in
              </Link>
              <p className="text-xs leading-relaxed text-zinc-500">
                New here? Accounts are set up by your manager or admin from the Team page — there's
                no public sign-up.
              </p>
            </FooterColumn>
          </div>
          <BottomBar year={year} />
        </div>
      </footer>
    );
  }

  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-zinc-900">
      <div className="pointer-events-none absolute inset-0 bg-mesh-glow" />
      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <Brand tagline="One shared, live view of every table — from ticket to table, no paper in between." />

          <FooterColumn title="Navigate">
            {NAV_LINKS.map((link) => (
              <Link key={link.to} to={link.to} className="transition-colors hover:text-white">
                {link.label}
              </Link>
            ))}
            {isManager && (
              <Link to="/team" className="transition-colors hover:text-white">
                Team
              </Link>
            )}
          </FooterColumn>

          <FooterColumn title="Session">
            <span className="text-zinc-300">{user?.name}</span>
            <span className="inline-flex w-fit items-center rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
              {user?.role}
            </span>
            <button onClick={logout} className="mt-1 w-fit text-left transition-colors hover:text-white">
              Log out
            </button>
          </FooterColumn>
        </div>
        <BottomBar year={year} />
      </div>
    </footer>
  );
}
