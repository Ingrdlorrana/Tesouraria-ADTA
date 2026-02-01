import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Entradas from "./pages/Entradas";
import Saidas from "./pages/Saidas";
import AcaoSocial from "./pages/AcaoSocial";
import Membros from "./pages/Membros";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/entradas"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Entradas />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/saidas"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Saidas />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/acaosocial"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AcaoSocial />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/membros"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Membros />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/relatorios"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Relatorios />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/configuracoes"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Configuracoes />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
