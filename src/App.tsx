import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { EmpresaProvider } from "@/contexts/EmpresaContext";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { PWAUpdateBanner } from "@/components/PWAUpdateBanner";
import { AdminRoute } from "@/components/AdminRoute";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
import ClientHealthPage from "./pages/ClientHealthPage";
import AlocacoesPage from "./pages/AlocacoesPage";
import EtiquetasPage from "./pages/EtiquetasPage";
import PedidosVendaPage from "./pages/PedidosVendaPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("[Global] Unhandled promise rejection:", event.reason);
      toast.error("Ocorreu um erro inesperado. Tente novamente.", { id: "global-unhandled" });
      // Prevent some environments from crashing/reloading the app
      event.preventDefault();
    };

    const onError = (event: ErrorEvent) => {
      console.error("[Global] Unhandled error:", event.error || event.message);
      toast.error("Ocorreu um erro inesperado. Tente novamente.", { id: "global-error" });
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onError);

    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <EmpresaProvider>
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/new-delivery" element={<NewDeliveryPage />} />
                  <Route path="/edit-delivery/:id" element={<EditDeliveryPage />} />
                  <Route path="/equipment/:id" element={<EquipmentDetailPage />} />
                  <Route
                    path="/users"
                    element={
                      <AdminRoute>
                        <UsersManagementPage />
                      </AdminRoute>
                    }
                  />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/saude-cliente" element={<ClientHealthPage />} />
                  <Route path="/install" element={<InstallPage />} />
                  <Route path="/confirmar/:token" element={<ClientConfirmationPage />} />
                  <Route path="/pedidos-dia" element={<DailyOrdersPage />} />
                  <Route path="/higienizacao" element={<HygienePage />} />
                  <Route path="/financeiro" element={<FinanceiroPage />} />
                  <Route path="/rotas" element={<RoutesPage />} />
                  <Route path="/alocacoes" element={<AlocacoesPage />} />
                  <Route path="/etiquetas" element={<EtiquetasPage />} />
                  <Route path="/pedidos-venda" element={<PedidosVendaPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </ErrorBoundary>
              <PWAInstallBanner />
              <PWAUpdateBanner />
            </EmpresaProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
