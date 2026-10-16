const API_URL = import.meta.env.VITE_API_URL;

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include", // send and receive cookies
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "Something went wrong");
  return data as T;
}