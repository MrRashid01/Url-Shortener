import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
import { api } from "../api";

type UrlItem = {
  id: number;
  originalUrl: string;
  shortCode: string;
  shortUrl: string;
  clicks: number;
  createdAt: string;
  expiresAt: string | null;
};

type ListResponse = {
  items: UrlItem[];
  total: number;
  page: number;
  totalPages: number;
};

export default function Dashboard() {
  const { user } = useAuth();

  const [items, setItems] = useState<UrlItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [newUrl, setNewUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [expiresDate, setExpiresDate] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "expired">("all");

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Wait 300ms after typing stops before searching (fewer requests)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (status !== "all") params.set("status", status);

      const data = await api<ListResponse>(`/api/urls?${params}`);

      // If we deleted the last item on a page, step back one page
      if (data.items.length === 0 && page > 1) {
        setPage(page - 1);
        return;
      }
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [page, debouncedSearch, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      await api("/api/urls", {
        method: "POST",
        body: JSON.stringify({
          originalUrl: newUrl,
          alias: alias || undefined,
          expiresAt: expiresDate
            ? new Date(`${expiresDate}T23:59:59`).toISOString()
            : undefined,
        }),
      });
      setNewUrl("");
      setAlias("");
      setExpiresDate("");
      setSearch("");
      setDebouncedSearch("");
      setPage(1);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this link? This cannot be undone.")) return;
    try {
      await api(`/api/urls/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    }
  }

  async function handleCopy(item: UrlItem) {
    await navigator.clipboard.writeText(item.shortUrl);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString();

  return (
    <div style={{ maxWidth: 960, margin: "40px auto", padding: 16 }}>
      <h2>Dashboard</h2>
      <p style={{ color: "#666" }}>Logged in as {user?.email}</p>

      <form onSubmit={handleCreate} style={{ display: "grid", gap: 8, marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Paste a long URL (https://...)"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          style={{ padding: 10 }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Custom alias (optional)"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            style={{ padding: 10, flex: 1, minWidth: 160 }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Expires
            <input
              type="date"
              min={tomorrow}
              value={expiresDate}
              onChange={(e) => setExpiresDate(e.target.value)}
              style={{ padding: 8 }}
            />
          </label>
          <button type="submit" disabled={creating} style={{ padding: "10px 16px" }}>
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </form>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          type="search"
          placeholder="Search your links..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, padding: 10 }}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "all" | "active" | "expired");
            setPage(1);
          }}
          style={{ padding: 10 }}
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <p style={{ color: "#666" }}>{total} link{total === 1 ? "" : "s"}</p>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
              <th>Short URL</th>
              <th>Original URL</th>
              <th>Clicks</th>
              <th>Created</th>
              <th>Expires</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px 8px 8px 0" }}>
                  <a href={item.shortUrl} target="_blank" rel="noreferrer">
                    {item.shortUrl}
                  </a>
                </td>
                <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={item.originalUrl}>
                  {item.originalUrl}
                </td>
                <td>{item.clicks}</td>
                <td>{fmt(item.createdAt)}</td>
                <td>
                  {item.expiresAt ? fmt(item.expiresAt) : "Never"}
                  {item.expiresAt && new Date(item.expiresAt) <= new Date() && (
                    <span style={{ color: "crimson", marginLeft: 6 }}>Expired</span>
                  )}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button onClick={() => handleCopy(item)}>
                    {copiedId === item.id ? "Copied!" : "Copy"}
                  </button>{" "}
                  <button onClick={() => handleDelete(item.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {items.length === 0 && (
        <p style={{ color: "#666", marginTop: 16 }}>
          {debouncedSearch ? "No links match your search." : "No links yet. Create your first one above."}
        </p>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16 }}>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}