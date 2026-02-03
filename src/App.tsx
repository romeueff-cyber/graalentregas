import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { AdminRoute } from "@/components/AdminRoute";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import NewDeliveryPage from "./pages/NewDeliveryPage";
import EditDeliveryPage from "./pages/EditDeliveryPage";
import EquipmentDetailPage from "./pages/EquipmentDetailPage";
import UsersManagementPage from "./pages/UsersManagementPage";
import SettingsPage from "./pages/SettingsPage";
import InstallPage from "./pages/InstallPage";
import ClientConfirmationPage from "./pages/ClientConfirmationPage";
import DailyOrdersPage from "./pages/DailyOrdersPage";
import HygienePage from "./pages/HygienePage";
import FinanceiroPage from "./pages/FinanceiroPage";
import RoutesPage from "./pages/RoutesPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/new-delivery" element={<NewDeliveryPage />} />
            <Route path="/edit-delivery/:id" element={<EditDeliveryPage />} />
            <Route path="/equipment/:id" element={<EquipmentDetailPage />} />
            <Route path="/users" element={<AdminRoute><UsersManagementPage /></AdminRoute>} />
            <Route path="/settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
            <Route path="/analytics" element={<AdminRoute><AnalyticsPage /></AdminRoute>} />
            <Route path="/install" element={<InstallPage />} />
            <Route path="/confirmar/:token" element={<ClientConfirmationPage />} />
            <Route path="/pedidos-dia" element={<DailyOrdersPage />} />
            <Route path="/higienizacao" element={<HygienePage />} />
            <Route path="/financeiro" element={<FinanceiroPage />} />
            <Route path="/rotas" element={<RoutesPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <PWAInstallBanner />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
