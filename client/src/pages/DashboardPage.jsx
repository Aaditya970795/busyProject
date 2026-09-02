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
import { StatusBadge } from "../components/StatusBadge";
import { ReceiptIcon, ChevronUpIcon, ChevronDownIcon } from "../components/icons";

const OPEN_STATUSES = new Set(["placed", "accepted", "preparing", "ready"]);
const STATUS_BAR_COLOR = {
  placed: "#0284c7",
  accepted: "#d97706",
  preparing: "#d97706",
  ready: "#7c3aed",
  served: "#059669",
  cancelled: "#dc2626",
};
// Dashboards are read-mostly and worth keeping fresh without a manual refresh — 30s is frequent
// enough to feel live without hammering the aggregate query on every render.
const REFRESH_INTERVAL_MS = 30 * 1000;

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

function DeltaBadge({ delta, format = (n) => n }) {
  if (delta === 0) return <span className="text-xs text-slate-400">same as yesterday</span>;
  const isUp = delta > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isUp ? "text-emerald-600" : "text-red-600"}`}>
      {isUp ? <ChevronUpIcon width="12" height="12" /> : <ChevronDownIcon width="12" height="12" />}
      {isUp ? "+" : ""}
      {format(delta)} vs yesterday
    </span>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {sub && <div className="mt-1">{sub}</div>}
    </div>
  );
}

function ManagerDashboard() {
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

  if (isLoading) return <p className="mt-6 text-sm text-slate-500">Loading…</p>;
  if (error) return <p className="mt-6 text-sm text-red-600">{error.message}</p>;
  if (!data) return null;

  const perDay = data.servedPerDay;
  const todayBucket = perDay[perDay.length - 1];
  const yesterdayBucket = perDay[perDay.length - 2];
  const servedDelta = yesterdayBucket ? todayBucket.count - yesterdayBucket.count : 0;
  const revenueDelta = yesterdayBucket
    ? Math.round((Number(todayBucket.revenue) - Number(yesterdayBucket.revenue)) * 100) / 100
    : 0;

  return (
    <>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open orders" value={data.openOrders} />
        <StatCard label="Placed today" value={data.placedToday} />
        <StatCard
          label="Served today"
          value={data.servedToday}
          sub={<DeltaBadge delta={servedDelta} />}
        />
        <StatCard
          label="Revenue today"
          value={formatCurrency(data.revenueToday)}
          sub={
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400">avg {formatCurrency(data.avgOrderValueToday)}/order</span>
              <DeltaBadge delta={revenueDelta} format={formatCurrency} />
            </div>
          }
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-slate-700">Orders by status</h2>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="status" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.byStatus.map((row) => (
                    <Cell key={row.status} fill={STATUS_BAR_COLOR[row.status] ?? "#64748b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
          <table className="mt-2 w-full min-w-[280px] text-left text-sm">
            <tbody className="divide-y divide-slate-100">
              {data.byStatus.map((row) => (
                <tr key={row.status}>
                  <td className="py-1.5">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="py-1.5 text-right font-medium text-slate-900">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-slate-700">Orders by waiter</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-2 font-medium">Waiter</th>
                <th className="pb-2 text-right font-medium">Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.byWaiter.map((row) => (
                <tr key={row.waiterId}>
                  <td className="py-1.5 text-slate-900">{row.waiterName}</td>
                  <td className="py-1.5 text-right font-medium text-slate-900">{row.count}</td>
                </tr>
              ))}
              {data.byWaiter.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-6 text-center text-slate-400">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-slate-700">Top sellers today</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-2 font-medium">Item</th>
                <th className="pb-2 text-right font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.topItemsToday.map((row) => (
                <tr key={row.menuItemId}>
                  <td className="py-1.5 text-slate-900">{row.name}</td>
                  <td className="py-1.5 text-right font-medium text-slate-900">{row.quantity}</td>
                  <td className="py-1.5 text-right text-slate-600">{formatCurrency(row.revenue)}</td>
                </tr>
              ))}
              {data.topItemsToday.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-slate-400">
                    Nothing served yet today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-slate-700">Last 14 days</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setChartMetric("count")}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  chartMetric === "count" ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                Orders served
              </button>
              <button
                onClick={() => setChartMetric("revenue")}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  chartMetric === "revenue" ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                Revenue
              </button>
            </div>
          </div>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={perDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  labelFormatter={formatShortDate}
                  formatter={(value) => (chartMetric === "revenue" ? formatCurrency(value) : value)}
                />
                <Line
                  type="monotone"
                  dataKey={chartMetric}
                  stroke="#4f46e5"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name={chartMetric === "revenue" ? "Revenue" : "Orders served"}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-slate-700">Recent orders</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {recentOrdersData?.data.map((order) => (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="flex items-center justify-between gap-2 py-2 text-sm transition-colors hover:bg-slate-50"
              >
                <span className="flex items-center gap-1.5 text-slate-700">
                  <ReceiptIcon width="14" height="14" className="text-indigo-600" />
                  Table {order.tableNumber}
                </span>
                <StatusBadge status={order.status} />
              </Link>
            ))}
            {recentOrdersData && recentOrdersData.data.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">No orders yet.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function WaiterDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["orders", "mine"],
    queryFn: () => api.get("/orders/mine"),
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  if (isLoading) return <p className="mt-6 text-sm text-slate-500">Loading…</p>;
  if (error) return <p className="mt-6 text-sm text-red-600">{error.message}</p>;
  if (!data) return null;

  const openOrders = data.orders.filter((order) => OPEN_STATUSES.has(order.status));
  const placedToday = data.orders.filter((order) => isTodayUtc(order.createdAt)).length;
  const servedToday = data.orders.filter((order) => order.status === "served" && isTodayUtc(order.updatedAt)).length;
  const oldestFirst = [...openOrders].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return (
    <>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Your open orders" value={openOrders.length} />
        <StatCard label="Placed today" value={placedToday} />
        <StatCard label="Served today" value={servedToday} />
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-slate-700">Your open orders</h2>
        <p className="mt-0.5 text-xs text-slate-400">Oldest first — these need attention longest.</p>
        <div className="mt-3 divide-y divide-slate-100">
          {oldestFirst.map((order) => (
            <Link
              key={order.id}
              to={`/orders/${order.id}`}
              className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:bg-slate-50"
            >
              <span className="flex items-center gap-1.5 text-slate-700">
                <ReceiptIcon width="14" height="14" className="text-indigo-600" />
                Table {order.tableNumber}
              </span>
              <span className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleString()}</span>
              <StatusBadge status={order.status} />
            </Link>
          ))}
          {oldestFirst.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">
              Nothing open right now — nice and clear.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const isManager = isManagerOrAbove(user?.role);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
      <p className="mt-0.5 text-sm text-slate-500">
        {isManager ? "How the restaurant's doing right now." : "Your worklist at a glance."}
      </p>

      {isManager ? <ManagerDashboard /> : <WaiterDashboard />}
    </div>
  );
}
