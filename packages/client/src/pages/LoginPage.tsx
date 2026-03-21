// Login form with username/password, "Play as Guest" option, and link to register

import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/auth-store.ts";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, guest, loading, error } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from || "/";
  // Don't redirect back into a room after logout — always go to home
  const redirectTo = from.startsWith("/room/") ? "/" : from;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
      navigate(redirectTo);
    } catch {
      // error is set in store
    }
  };

  const handleGuest = async () => {
    try {
      await guest();
      navigate(redirectTo);
    } catch {
      // error is set in store
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16">
      <h1 className="text-2xl font-bold mb-6">Login</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-emerald-400"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-emerald-400"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded font-medium disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
      <div className="mt-4 space-y-3 text-center">
        <button
          onClick={handleGuest}
          disabled={loading}
          className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium disabled:opacity-50"
        >
          Play as Guest
        </button>
        <p className="text-sm text-gray-400">
          No account?{" "}
          <Link to="/register" state={{ from: redirectTo }} className="text-emerald-400 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
