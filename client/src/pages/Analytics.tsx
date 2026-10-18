import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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

function Breakdown({ title, rows }: { title: string; rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
      <h4 style={{ margin: "0 0 8px" }}>{title}</h4>
      {rows.length === 0 && <p style={{ color: "#888", margin: 0 }}>No data yet</p>}
      {rows.map((r) => (
        <div key={r.name} style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span>{r.name}</span>
            <span>{r.count}</span>
          </div>
          <div style={{ background: "#eee", height: 6, borderRadius: 3 }}>
            <div style={{ width: `${(r.count / max) * 100}%`, background: "#4f46e5", height: 6, borderRadius: 3 }} />
          </div>
        </div>
      ))}
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
      <div style={{ maxWidth: 960, margin: "40px auto", padding: 16 }}>
        <p style={{ color: "crimson" }}>{error}</p>
        <Link to="/dashboard">Back to dashboard</Link>
      </div>
    );
  }
  if (!stats) return <p style={{ padding: 16 }}>Loading...</p>;

  const card = { border: "1px solid #ddd", borderRadius: 8, padding: 16, flex: 1, minWidth: 140 } as const;

  return (
    <div style={{ maxWidth: 960, margin: "40px auto", padding: 16 }}>
      <Link to="/dashboard">← Back to dashboard</Link>
      <h2 style={{ marginBottom: 4 }}>{stats.url.shortUrl}</h2>
      <p style={{ color: "#666", marginTop: 0, wordBreak: "break-all" }}>{stats.url.originalUrl}</p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <div style={card}>
          <div style={{ color: "#666" }}>Total clicks</div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{stats.totalClicks}</div>
        </div>
        <div style={card}>
          <div style={{ color: "#666" }}>Last {stats.days} days</div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{stats.periodClicks}</div>
        </div>
        <div style={card}>
          <div style={{ color: "#666" }}>Created</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>
            {new Date(stats.url.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3>Clicks per day</h3>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ padding: 8 }}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={stats.daily}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="clicks" fill="#4f46e5" />
        </BarChart>
      </ResponsiveContainer>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, margin: "24px 0" }}>
        <Breakdown title="Referrers" rows={stats.referrers} />
        <Breakdown title="Browsers" rows={stats.browsers} />
        <Breakdown title="Operating systems" rows={stats.os} />
        <Breakdown title="Devices" rows={stats.devices} />
      </div>

      <h3>Recent clicks</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
              <th>Time</th><th>Referrer</th><th>Browser</th><th>OS</th><th>Device</th>
            </tr>
          </thead>
          <tbody>
            {stats.recent.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "6px 8px 6px 0" }}>{new Date(c.clickedAt).toLocaleString()}</td>
                <td>{c.referrer}</td>
                <td>{c.browser}</td>
                <td>{c.os}</td>
                <td>{c.device}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}