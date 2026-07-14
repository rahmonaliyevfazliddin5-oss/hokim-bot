import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/i18n/I18nProvider";
import { AdminProvider } from "@/contexts/AdminContext";
import { MahallaProvider } from "@/contexts/MahallaContext";
import { AppLayout } from "@/components/AppLayout";
import { AdminGuard } from "@/components/AdminGuard";
import { MahallaGuard } from "@/components/MahallaGuard";
import Home from "./pages/Home";
import Submit from "./pages/Submit";
import Track from "./pages/Track";
import Chat from "./pages/Chat";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminStats from "./pages/AdminStats";
import AdminUsers from "./pages/AdminUsers";
import AdminLogs from "./pages/AdminLogs";
import AdminMahallaPasswords from "./pages/AdminMahallaPasswords";
import MahallaLogin from "./pages/MahallaLogin";
import MahallaDashboard from "./pages/MahallaDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <AdminProvider>
        <MahallaProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/submit" element={<Submit />} />
                  <Route path="/track" element={<Track />} />
                  <Route path="/chat" element={<Chat />} />
                  <Route path="/admin/login" element={<AdminLogin />} />
                  <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                  <Route path="/admin/dashboard" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
                  <Route path="/admin/stats" element={<AdminGuard><AdminStats /></AdminGuard>} />
                  <Route path="/admin/users" element={<AdminGuard><AdminUsers /></AdminGuard>} />
                  <Route path="/admin/logs" element={<AdminGuard><AdminLogs /></AdminGuard>} />
                  <Route path="/admin/mahalla-passwords" element={<AdminGuard><AdminMahallaPasswords /></AdminGuard>} />
                  <Route path="/mahalla" element={<Navigate to="/mahalla/dashboard" replace />} />
                  <Route path="/mahalla/login" element={<MahallaLogin />} />
                  <Route path="/mahalla/dashboard" element={<MahallaGuard><MahallaDashboard /></MahallaGuard>} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </MahallaProvider>
      </AdminProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
