import { useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Link2, Sparkles, Zap, type LucideIcon } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import CopyButton from "../components/CopyButton";

type RecentLink = { shortUrl: string; originalUrl: string; createdAt: string };

const STORAGE_KEY = "recentLinks";

function loadRecent(): RecentLink[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecent(items: RecentLink[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* storage can be blocked. The app still works without it. */
  }
}

const FEATURES: { icon: LucideIcon; title: string; text: string; tint: string }[] = [
  {
    icon: Zap,
    title: "Fast redirects",
    text: "Popular links are served from a Redis cache, so they open in a blink.",
    tint: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  },
  {
    icon: Activity,
    title: "Click analytics",
    text: "See clicks per day, browsers, devices and where your visitors came from.",
    tint: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  {
    icon: Link2,
    title: "Custom aliases",
    text: "Pick a name like /my-portfolio and set an expiry date. Free with an account.",
    tint: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
];

export default function Home() {
  const { user } = useAuth();
  const [originalUrl, setOriginalUrl] = useState("");
  const [shortUrl, setShortUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<RecentLink[]>(loadRecent);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");
    setShortUrl("");
    setLoading(true);

    try {
      const data = await api<{ shortUrl: string; originalUrl: string }>("/api/urls", {
        method: "POST",
        body: JSON.stringify({ originalUrl }),
      });
      setShortUrl(data.shortUrl);
      setOriginalUrl("");

      // Anonymous visitors: remember the last 5 links in this browser
      if (!user) {
        const next = [
          { shortUrl: data.shortUrl, originalUrl: data.originalUrl, createdAt: new Date().toISOString() },
          ...recent,
        ].slice(0, 5);
        setRecent(next);
        saveRecent(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function clearRecent() {
    setRecent([]);
    saveRecent([]);
  }

  return (
    <div>
      <section className="pt-8 text-center sm:pt-14">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
          <Sparkles className="size-3.5" />
          Free, fast, and no account needed
        </span>

        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
          Shorten links.
          <br />
          <span className="gradient-text">Track every click.</span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600 dark:text-slate-400">
          Paste a long URL and get a clean short link in a second.
        </p>

        <div className="card mx-auto mt-10 max-w-3xl p-3 text-left sm:p-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Link2 className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-400" />
              <input
                className="input py-3.5 pl-12"
                type="text"
                placeholder="Paste a long URL (https://...)"
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
                aria-label="Long URL"
              />
            </div>
            <button className="btn btn-primary px-6 py-3.5" type="submit" disabled={loading}>
              {loading ? "Shortening..." : "Shorten"}
            </button>
          </form>

          {error && <div className="alert-error mt-3">{error}</div>}

          {shortUrl && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <a
                href={shortUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold break-all text-emerald-800 hover:underline dark:text-emerald-300"
              >
                {shortUrl}
              </a>
              <CopyButton text={shortUrl} />
            </div>
          )}

          <p className="mt-3 px-1 text-sm text-slate-500 dark:text-slate-400">
            {user ? (
              <>
                Manage all your links in your{" "}
                <Link to="/dashboard" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                  dashboard
                </Link>
                .
              </>
            ) : (
              <>
                <Link to="/register" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                  Sign up
                </Link>{" "}
                to track clicks, use custom aliases and set expiry dates.
              </>
            )}
          </p>
        </div>
      </section>

      {!user && recent.length > 0 && (
        <section className="mx-auto mt-12 max-w-3xl">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-lg font-bold">Your recent links</h2>
            <button className="btn btn-ghost btn-sm" onClick={clearRecent}>Clear list</button>
          </div>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            Saved only in this browser. Create an account to manage your links on any device.
          </p>
          <ul className="space-y-2">
            {recent.map((item) => (
              <li key={item.shortUrl} className="card flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <a
                    href={item.shortUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold break-all text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {item.shortUrl}
                  </a>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400" title={item.originalUrl}>
                    {item.originalUrl}
                  </p>
                </div>
                <CopyButton text={item.shortUrl} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text, tint }) => (
          <div key={title} className="card">
            <div className={`mb-4 grid size-11 place-items-center rounded-xl ${tint}`}>
              <Icon className="size-5" />
            </div>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}