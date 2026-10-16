import { useState } from "react";
import { api } from "../api";

export default function Home() {
  const [originalUrl, setOriginalUrl] = useState("");
  const [shortUrl, setShortUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");
    setShortUrl("");
    setCopied(false);
    setLoading(true);
    try {
      const data = await api<{ shortUrl: string }>("/api/urls", {
        method: "POST",
        body: JSON.stringify({ originalUrl }),
      });
      setShortUrl(data.shortUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ maxWidth: 560, margin: "60px auto" }}>
      <h1>URL Shortener</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          placeholder="Paste a long URL (https://...)"
          value={originalUrl}
          onChange={(e) => setOriginalUrl(e.target.value)}
          style={{ flex: 1, padding: 10 }}
        />
        <button type="submit" disabled={loading} style={{ padding: "10px 16px" }}>
          {loading ? "Shortening..." : "Shorten"}
        </button>
      </form>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {shortUrl && (
        <div style={{ marginTop: 24, padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
          <a href={shortUrl} target="_blank" rel="noreferrer">{shortUrl}</a>
          <button onClick={handleCopy} style={{ marginLeft: 12 }}>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}