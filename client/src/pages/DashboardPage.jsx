import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { isManagerOrAbove } from "../lib/roles";
import { formatCurrency } from "../lib/format";
import { statusStyle } from "../lib/statusStyles";
import { StatusBadge } from "../components/StatusBadge";
import {
  ReceiptIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  PlusIcon,
  CheckIcon,
  LayersIcon,
  UsersIcon,
  StarIcon,
  TrendingUpIcon,
} from "../components/icons";

const OPEN_STATUSES = new Set(["placed", "accepted", "preparing", "ready"]);
// Dashboards are read-mostly and worth keeping fresh without a manual refresh — 30s is frequent
// enough to feel live without hammering the aggregate query on every render.
const REFRESH_INTERVAL_MS = 30 * 1000;

// Every icon chip and decorative accent on this page shares the one brand-gradient — see
// index.css. This whole page lives on the same dark "chrome" surface as the nav/footer (not
// the app's light content background) so the frame reads as one continuous, designed thing.
const ACCENT_CHIP = "brand-gradient text-white shadow-lg shadow-indigo-900/40";
const TOOLTIP_STYLE = {
  contentStyle: { background: "#18181b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 },
  itemStyle: { color: "#e4e4e7" },
  labelStyle: { color: "#a1a1aa" },
};
const AXIS_TICK = { fontSize: 12, fill: "#71717a" };

function formatShortDate(isoDate) {
  return new Date(`${isoDate}T00:00:00.000Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function isTodayUtc(isoString) {
  const d = new Date(isoString);
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

function greetingForHour(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function GreetingBanner({ name, isManager }) {
  const greeting = greetingForHour(new Date().getHours());
  return (
    <div className="brand-gradient relative overflow-hidden rounded-3xl p-6 text-white shadow-xl shadow-indigo-950/40 sm:p-8">
      <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 left-1/4 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
      <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Dashboard</p>
      <h1 className="relative mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        {greeting}, {name?.split(" ")[0] ?? "there"}
      </h1>
      <p className="relative mt-2 max-w-md text-sm text-white/80">
        {isManager ? "Here's how the restaurant's doing right now." : "Here's your worklist at a glance."}
      </p>
    </div>
  );
}

function DeltaBadge({ delta, format = (n) => n }) {
  if (delta === 0) return <span className="text-xs font-medium text-zinc-500">same as yesterday</span>;
  const isUp = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        isUp ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
      }`}
    >
      {isUp ? <ChevronUpIcon width="12" height="12" /> : <ChevronDownIcon width="12" height="12" />}
      {isUp ? "+" : ""}
      {format(delta)} vs yesterday
    </span>
  );
}

function StatCard({ label, value, sub, icon }) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-zinc-800">
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl transition-colors duration-300 group-hover:bg-indigo-500/20" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-400">{label}</p>
          <p className="mt-1.5 text-3xl font-bold tracking-tight text-white">{value}</p>
        </div>
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${ACCENT_CHIP}`}>{icon}</span>
      </div>
      {sub && <div className="relative mt-2">{sub}</div>}
    </div>
  );
}

function SectionCard({ icon, title, subtitle, action, className = "", children }) {
  return (
    <div
      className={`rounded-3xl border border-white/10 bg-zinc-900 p-5 shadow-sm transition-colors duration-300 hover:border-white/20 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${ACCENT_CHIP}`}>{icon}</span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
            {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function EmptyRow({ text }) {
  return <p className="py-8 text-center text-sm text-zinc-500">{text}</p>;
}

function OrderRow({ order, showTime = false }) {
  return (
    <Link
      to={`/orders/${order.id}`}
      className="group flex items-center justify-between gap-3 rounded-2xl px-2 py-2.5 transition-colors duration-150 hover:bg-white/5"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className={`h-8 w-1.5 shrink-0 rounded-full ${statusStyle(order.status).solid}`} />
        <span className="flex items-center gap-1.5 truncate text-sm font-medium text-zinc-300 group-hover:text-white">
          <ReceiptIcon width="14" height="14" className="shrink-0 text-indigo-400" />
          Table {order.tableNumber}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        {showTime && <span className="hidden text-xs text-zinc-500 sm:inline">{new Date(order.createdAt).toLocaleString()}</span>}
        <StatusBadge status={order.status} />
      </span>
    </Link>
  );
}

function ManagerDashboard({ userName }) {
  const [chartMetric, setChartMetric] = useState("count");

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => api.get("/dashboard/summary"),
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const { data: recentOrdersData } = useQuery({
    queryKey: ["dashboard", "recent-orders"],
    queryFn: () => api.get("/orders?sort=placed&dir=desc&pageSize=8"),
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  return (
    <div>
      <GreetingBanner name={userName} isManager />

      {isLoading && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl border border-white/10 bg-zinc-900" />
          ))}
        </div>
      )}
      {error && <p className="mt-6 text-sm text-red-400">{error.message}</p>}
      {data && (
        <ManagerDashboardBody
          data={data}
          recentOrdersData={recentOrdersData}
          chartMetric={chartMetric}
          setChartMetric={setChartMetric}
        />
      )}
    </div>
  );
}

function ManagerDashboardBody({ data, recentOrdersData, chartMetric, setChartMetric }) {
  const perDay = data.servedPerDay;
  const todayBucket = perDay[perDay.length - 1];
  const yesterdayBucket = perDay[perDay.length - 2];
  const servedDelta = yesterdayBucket ? todayBucket.count - yesterdayBucket.count : 0;
  const revenueDelta = yesterdayBucket
    ? Math.round((Number(todayBucket.revenue) - Number(yesterdayBucket.revenue)) * 100) / 100
    : 0;

  return (
    <>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open orders" value={data.openOrders} icon={<ReceiptIcon width="20" height="20" />} />
        <StatCard label="Placed today" value={data.placedToday} icon={<PlusIcon width="20" height="20" />} />
        <StatCard
          label="Served today"
          value={data.servedToday}
          icon={<CheckIcon width="20" height="20" />}
          sub={<DeltaBadge delta={servedDelta} />}
        />
        <StatCard
          label="Revenue today"
          value={formatCurrency(data.revenueToday)}
          icon={<span className="text-lg font-bold">₹</span>}
          sub={
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-500">avg {formatCurrency(data.avgOrderValueToday)}/order</span>
              <DeltaBadge delta={revenueDelta} format={formatCurrency} />
            </div>
          }
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard icon={<LayersIcon width="16" height="16" />} title="Orders by status">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="status" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <Tooltip cursor={{ fill: "rgba(99,102,241,0.08)" }} {...TOOLTIP_STYLE} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {data.byStatus.map((row) => (
                    <Cell key={row.status} fill={statusStyle(row.status).chart} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[280px] text-left text-sm">
              <tbody className="divide-y divide-white/5">
                {data.byStatus.map((row) => (
                  <tr key={row.status}>
                    <td className="py-1.5">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="py-1.5 text-right font-semibold text-white">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard icon={<UsersIcon width="16" height="16" />} title="Orders by waiter">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="pb-2 font-medium">Waiter</th>
                <th className="pb-2 text-right font-medium">Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.byWaiter.map((row) => (
                <tr key={row.waiterId}>
                  <td className="py-1.5 text-zinc-200">{row.waiterName}</td>
                  <td className="py-1.5 text-right font-semibold text-white">{row.count}</td>
                </tr>
              ))}
              {data.byWaiter.length === 0 && (
                <tr>
                  <td colSpan={2}>
                    <EmptyRow text="No orders yet." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard icon={<StarIcon width="16" height="16" />} title="Top sellers today">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="pb-2 font-medium">Item</th>
                <th className="pb-2 text-right font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.topItemsToday.map((row) => (
                <tr key={row.menuItemId}>
                  <td className="py-1.5 text-zinc-200">{row.name}</td>
                  <td className="py-1.5 text-right font-semibold text-white">{row.quantity}</td>
                  <td className="py-1.5 text-right text-zinc-400">{formatCurrency(row.revenue)}</td>
                </tr>
              ))}
              {data.topItemsToday.length === 0 && (
                <tr>
                  <td colSpan={3}>
                    <EmptyRow text="Nothing served yet today." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </SectionCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          icon={<TrendingUpIcon width="16" height="16" />}
          title="Last 14 days"
          className="lg:col-span-2"
          action={
            <div className="flex items-center gap-1 rounded-full bg-white/5 p-1">
              <button
                onClick={() => setChartMetric("count")}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                  chartMetric === "count" ? "brand-gradient text-white shadow-sm" : "text-zinc-400 hover:text-white"
                }`}
              >
                Orders served
              </button>
              <button
                onClick={() => setChartMetric("revenue")}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                  chartMetric === "revenue" ? "brand-gradient text-white shadow-sm" : "text-zinc-400 hover:text-white"
                }`}
              >
                Revenue
              </button>
            </div>
          }
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={perDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatShortDate} tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <Tooltip
                  labelFormatter={formatShortDate}
                  formatter={(value) => (chartMetric === "revenue" ? formatCurrency(value) : value)}
                  {...TOOLTIP_STYLE}
                />
                <Line
                  type="monotone"
                  dataKey={chartMetric}
                  stroke="#818cf8"
                  strokeWidth={3}
                  dot={{ r: 3, fill: "#818cf8" }}
                  name={chartMetric === "revenue" ? "Revenue" : "Orders served"}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard icon={<ReceiptIcon width="16" height="16" />} title="Recent orders">
          <div className="divide-y divide-white/5">
            {recentOrdersData?.data.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
            {recentOrdersData && recentOrdersData.data.length === 0 && <EmptyRow text="No orders yet." />}
          </div>
        </SectionCard>
      </div>
    </>
  );
}

function WaiterDashboard({ userName }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["orders", "mine"],
    queryFn: () => api.get("/orders/mine"),
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  return (
    <div>
      <GreetingBanner name={userName} isManager={false} />

      {isLoading && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl border border-white/10 bg-zinc-900" />
          ))}
        </div>
      )}
      {error && <p className="mt-6 text-sm text-red-400">{error.message}</p>}
      {data && <WaiterDashboardBody data={data} />}
    </div>
  );
}

function WaiterDashboardBody({ data }) {
  const openOrders = data.orders.filter((order) => OPEN_STATUSES.has(order.status));
  const placedToday = data.orders.filter((order) => isTodayUtc(order.createdAt)).length;
  const servedToday = data.orders.filter((order) => order.status === "served" && isTodayUtc(order.updatedAt)).length;
  const oldestFirst = [...openOrders].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return (
    <>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Your open orders" value={openOrders.length} icon={<ReceiptIcon width="20" height="20" />} />
        <StatCard label="Placed today" value={placedToday} icon={<PlusIcon width="20" height="20" />} />
        <StatCard label="Served today" value={servedToday} icon={<CheckIcon width="20" height="20" />} />
      </div>

      <SectionCard
        icon={<ReceiptIcon width="16" height="16" />}
        title="Your open orders"
        subtitle="Oldest first — these need attention longest."
        className="mt-4"
      >
        <div className="divide-y divide-white/5">
          {oldestFirst.map((order) => (
            <OrderRow key={order.id} order={order} showTime />
          ))}
          {oldestFirst.length === 0 && <EmptyRow text="Nothing open right now — nice and clear." />}
        </div>
      </SectionCard>
    </>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const isManager = isManagerOrAbove(user?.role);

  return (
    <div className="relative overflow-hidden rounded-3xl  p-5 shadow-2xl shadow-black/30 sm:p-8">
      <div className="relative">
        {isManager ? <ManagerDashboard userName={user?.name} /> : <WaiterDashboard userName={user?.name} />}
      </div>
    </div>
  );
}
