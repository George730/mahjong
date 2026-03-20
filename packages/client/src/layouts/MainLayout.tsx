// Shared page shell — header with logo, username, logout button, and <Outlet> for pages

import { Outlet, Link } from "react-router-dom";
import { useAuthStore } from "../stores/auth-store.ts";

export default function MainLayout() {
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-emerald-400">
          Mahjong
        </Link>
        {user && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-300">{user.username}</span>
            <button
              onClick={logout}
              className="text-sm text-gray-400 hover:text-white"
            >
              Logout
            </button>
          </div>
        )}
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
