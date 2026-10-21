import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AppWindow,
  ArrowLeft,
  CalendarDays,
  Clock,
  Cpu,
  Globe,
  MousePointerClick,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { api } from "../api";

type Row = { name: string; count: number };

type Stats = {
  url: { originalUrl: string; shortUrl: string; createdAt: string };
  days: number;
  totalClicks: number;
  periodClicks: number;
  daily: { date: string; clicks: number }[];
  referrers: Row[];
  browsers: Row[];
  os: Row[];
  devices: Row[];
  recent: { id: number; clickedAt: string; referrer: string; browser: string; os: string; device: string }[];
};

function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
        <Icon className="size-5" />
      </div>
      <div>
        <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
      </div>
    </div>
  );
}

function Breakdown({ title, icon: Icon, rows }: { title: string; icon: LucideIcon; rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="card p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-indigo-600 dark:text-indigo-400" />
        {title}
      </h3>
      {rows.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No data yet</p>}
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.name}>
            <div className="flex justify-between text-sm">
              <span className="truncate pr-2">{r.name}</span>
              <span className="text-slate-500 tabular-nums dark:text-slate-400">{r.count}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-linear-to-r from-indigo-500 to-violet-500"
                style={{ width: `${(r.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Analytics() {
  const { id } = useParams();
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    api<Stats>(`/api/urls/${id}/stats?days=${days}`)
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [id, days]);

  if (error) {
    return (
      <div className="space-y-4">
        <div className="alert-error">{error}</div>
        <Link to="/dashboard" className="btn btn-ghost btn-sm">
          <ArrowLeft className="size-4" /> Back to dashboard
        </Link>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-4">
        <div className="card h-24 animate-pulse bg-slate-100 dark:bg-slate-800/60" />
        <div className="card h-72 animate-pulse bg-slate-100 dark:bg-slate-800/60" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
      >
        <ArrowLeft className="size-4" /> Back to dashboard
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight break-all sm:text-3xl">{stats.url.shortUrl}</h1>
          <p className="mt-1 text-sm break-all text-slate-500 dark:text-slate-400">{stats.url.originalUrl}</p>
        </div>
        <select
          className="input w-auto"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          aria-label="Time range"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={MousePointerClick} label="Total clicks" value={stats.totalClicks} />
        <StatCard icon={CalendarDays} label={`Last ${stats.days} days`} value={stats.periodClicks} />
        <StatCard icon={Clock} label="Created" value={new Date(stats.url.createdAt).toLocaleDateString()} />
      </div>

      <div className="card">
        <h2 className="mb-4 font-semibold">Clicks per day</h2>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={stats.daily}>
            <defs>
              <linearGradient id="clicksFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
            <Tooltip
              contentStyle={{
                background: "var(--tt-bg)",
                border: "1px solid var(--tt-border)",
                borderRadius: 12,
                color: "var(--tt-text)",
              }}
            />
            <Area type="monotone" dataKey="clicks" stroke="#6366f1" strokeWidth={2} fill="url(#clicksFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Breakdown title="Referrers" icon={Globe} rows={stats.referrers} />
        <Breakdown title="Browsers" icon={AppWindow} rows={stats.browsers} />
        <Breakdown title="Operating systems" icon={Cpu} rows={stats.os} />
        <Breakdown title="Devices" icon={Smartphone} rows={stats.devices} />
      </div>

      <div className="card">
        <h2 className="mb-4 font-semibold">Recent clicks</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-500 dark:text-slate-400">
                <th className="pr-4 pb-3 font-medium">Time</th>
                <th className="pr-4 pb-3 font-medium">Referrer</th>
                <th className="pr-4 pb-3 font-medium">Browser</th>
                <th className="pr-4 pb-3 font-medium">OS</th>
                <th className="pb-3 font-medium">Device</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent.map((c) => (
                <tr key={c.id}>
                  <td className="border-t border-slate-100 py-3 pr-4 whitespace-nowrap dark:border-slate-800">
                    {new Date(c.clickedAt).toLocaleString()}
                  </td>
                  <td className="border-t border-slate-100 py-3 pr-4 dark:border-slate-800">{c.referrer}</td>
                  <td className="border-t border-slate-100 py-3 pr-4 dark:border-slate-800">{c.browser}</td>
                  <td className="border-t border-slate-100 py-3 pr-4 dark:border-slate-800">{c.os}</td>
                  <td className="border-t border-slate-100 py-3 dark:border-slate-800">{c.device}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {stats.recent.length === 0 && (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No clicks yet.</p>
        )}
      </div>
    </div>
  );
}