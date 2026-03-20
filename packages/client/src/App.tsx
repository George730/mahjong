// Top-level route definitions — public (login/register) and auth-guarded (home/room) pages

import { Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout.tsx";
import HomePage from "./pages/HomePage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import RegisterPage from "./pages/RegisterPage.tsx";
import RoomPage from "./pages/RoomPage.tsx";
import AuthGuard from "./components/AuthGuard.tsx";

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <AuthGuard>
              <HomePage />
            </AuthGuard>
          }
        />
        <Route
          path="/room/:roomCode"
          element={
            <AuthGuard>
              <RoomPage />
            </AuthGuard>
          }
        />
      </Route>
    </Routes>
  );
}
