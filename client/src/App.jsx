import { Routes, Route } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { MenuPage } from "./pages/MenuPage";
import { TablesPage } from "./pages/TablesPage";
import { TeamPage } from "./pages/TeamPage";
import { OrdersPage } from "./pages/OrdersPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { AlertsPage } from "./pages/AlertsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicOnlyRoute } from "./components/PublicOnlyRoute";
import { AppShell } from "./components/AppShell";

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/tables" element={<TablesPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
