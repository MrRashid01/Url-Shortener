import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, CalendarDays, Clock, Inbox, MousePointerClick, Plus, Search, Trash2 } from "lucide-react";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import CopyButton from "../components/CopyButton";

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

type Status = "all" | "active" | "expired";

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
];

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const isExpired = (item: UrlItem) => !!item.expiresAt && new Date(item.expiresAt) <= new Date();

function hostLetter(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")[0] ?? "?";
  } catch {
    return "?";
  }
}

export default function Dashboard() {
  const { user } = useAuth();

  const [items, setItems] = useState<UrlItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loaded, setLoaded] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<Status>("all");

  const [newUrl, setNewUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [expiresDate, setExpiresDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // Wait 300ms after typing stops before searching
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

      if (data.items.length === 0 && page > 1) {
        setPage(page - 1);
        return;
      }
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoaded(true);
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
          expiresAt: expiresDate ? new Date(`${expiresDate}T23:59:59`).toISOString() : undefined,
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          {total} link{total === 1 ? "" : "s"} · {user?.email}
        </p>
      </div>

      {/* Create form */}
      <form className="card space-y-4" onSubmit={handleCreate}>
        <h2 className="flex items-center gap-2 font-semibold">
          <Plus className="size-4 text-indigo-600 dark:text-indigo-400" />
          Create a new link
        </h2>
        <div>
          <label className="label" htmlFor="long-url">Long URL</label>
          <input
            id="long-url"
            className="input"
            type="text"
            placeholder="https://example.com/some/very/long/link"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
          <div>
            <label className="label" htmlFor="alias">Custom alias (optional)</label>
            <input
              id="alias"
              className="input"
              type="text"
              placeholder="my-link"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="expires">Expires (optional)</label>
            <input
              id="expires"
              className="input"
              type="date"
              min={tomorrow}
              value={expiresDate}
              onChange={(e) => setExpiresDate(e.target.value)}
            />
          </div>
          <button className="btn btn-primary py-3" type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create link"}
          </button>
        </div>
        {error && <div className="alert-error">{error}</div>}
      </form>

      {/* Search and filter */}
      <div className="mt-8 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-11"
            type="search"
            placeholder="Search your links..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search links"
          />
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setStatus(option.value);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                status === option.value
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading skeleton */}
      {!loaded && (
        <ul className="space-y-3">
          {[0, 1, 2].map((i) => (
            <li key={i} className="card h-24 animate-pulse bg-slate-100 dark:bg-slate-800/60" />
          ))}
        </ul>
      )}

      {/* Links */}
      {loaded && (
        <ul className="space-y-3">
          {items.map((item) => {
            const expired = isExpired(item);
            return (
              <li key={item.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-base font-bold text-indigo-600 uppercase dark:bg-indigo-500/15 dark:text-indigo-300">
                    {hostLetter(item.originalUrl)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <a
                      href={item.shortUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`font-semibold break-all text-indigo-600 hover:underline dark:text-indigo-400 ${
                        expired ? "line-through opacity-60" : ""
                      }`}
                    >
                      {item.shortUrl}
                    </a>
                    <p className="truncate text-sm text-slate-500 dark:text-slate-400" title={item.originalUrl}>
                      {item.originalUrl}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <span className="badge badge-indigo">
                        <MousePointerClick className="size-3.5" />
                        {item.clicks} click{item.clicks === 1 ? "" : "s"}
                      </span>
                      <span className="badge badge-slate">
                        <CalendarDays className="size-3.5" />
                        {fmt(item.createdAt)}
                      </span>
                      {!item.expiresAt && <span className="badge badge-slate">Never expires</span>}
                      {item.expiresAt && !expired && (
                        <span className="badge badge-amber">
                          <Clock className="size-3.5" />
                          Expires {fmt(item.expiresAt)}
                        </span>
                      )}
                      {item.expiresAt && expired && (
                        <span className="badge badge-red">
                          <Clock className="size-3.5" />
                          Expired {fmt(item.expiresAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <CopyButton text={item.shortUrl} />
                  <Link to={`/dashboard/${item.id}`} className="btn btn-ghost btn-sm">
                    <Activity className="size-4" />
                    Stats
                  </Link>
                  <button
                    className="btn btn-danger btn-sm btn-icon"
                    onClick={() => handleDelete(item.id)}
                    aria-label="Delete link"
                    title="Delete link"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Empty state */}
      {loaded && items.length === 0 && (
        <div className="card flex flex-col items-center py-14 text-center">
          <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
            <Inbox className="size-7" />
          </div>
          <p className="font-medium">
            {debouncedSearch || status !== "all" ? "No links match your filters" : "No links yet"}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {debouncedSearch || status !== "all"
              ? "Try a different search or filter."
              : "Create your first short link above."}
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4 text-sm text-slate-500 dark:text-slate-400">
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}