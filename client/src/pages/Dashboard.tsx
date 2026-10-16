import { useAuth } from "../AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  return (
    <div style={{ maxWidth: 700, margin: "60px auto" }}>
      <h2>Dashboard</h2>
      <p>Logged in as {user?.email}</p>
      <p>Your links will appear here in Phase 3.</p>
    </div>
  );
}