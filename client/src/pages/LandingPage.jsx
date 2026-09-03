import { Link } from "react-router-dom";
import { Footer } from "../components/Footer";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ReceiptIcon, BellIcon, CheckIcon, UserPlusIcon } from "../components/icons";

const FEATURES = [
  {
    icon: ReceiptIcon,
    title: "Role-based menu & order control",
    description:
      "Managers own the menu and table list; waiters run orders from a shared, always-current view instead of a corkboard of paper tickets.",
  },
  {
    icon: CheckIcon,
    title: "Live order lifecycle tracking",
    description:
      "Every order moves through Placed → Accepted → Preparing → Ready → Served with clear, enforced transitions — no skipped or re-ordered steps.",
  },
  {
    icon: ReceiptIcon,
    title: "Manager dashboard & trends",
    description:
      "Open orders, revenue, top sellers, and a 14-day trend at a glance — plus a focused worklist for waiters instead of a locked-out page.",
  },
  {
    icon: BellIcon,
    title: "Slow-order alerts",
    description:
      "Orders sitting too long without reaching Ready surface automatically, with severity tiers and acknowledgement — nothing quietly slips through.",
  },
  {
    icon: UserPlusIcon,
    title: "A full audit trail",
    description:
      "Every status change, line add or void, and note is recorded permanently — visible on the order, editable by no one, not even a manager.",
  },
];

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-sm text-white">
              O
            </span>
            Order Management
          </span>
          <Link to="/login">
            <Button variant="secondary">Log in</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 animate-fade-in">
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
          <h1 className="mx-auto max-w-2xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Run the floor without the paper tickets
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-500 sm:text-lg">
            A shared, real-time order board for restaurant waiters and managers — replacing the
            paper-ticket and corkboard workflow with one system everyone can see and trust.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/login">
              <Button size="lg">Log in</Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            New here? Accounts are set up by your manager or admin — ask them to add you from the
            Team page.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="transition-transform duration-200 hover:-translate-y-0.5">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Icon width="18" height="18" />
                </div>
                <h2 className="mt-3 text-sm font-medium text-slate-800">{title}</h2>
                <p className="mt-1 text-sm text-slate-500">{description}</p>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <Footer variant="landing" />
    </div>
  );
}
