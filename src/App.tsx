import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/canvas/ThemeToggle";
import { MobileThemeProvider } from "@/mobile/layout/MobileDrawer";
import Dashboard from "./pages/Dashboard";
import WorkspacePage from "./pages/WorkspacePage";
import ViewWorkspacePage from "./pages/ViewWorkspacePage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import AdminPage from "./pages/AdminPage";
import ImportPage from "./pages/ImportPage";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";
import { useSyncManager } from "@/hooks/useSyncManager";
import { PWABanner } from "@/components/PWABanner";

// Mobile components - lazy loaded
import { MobileDashboard } from "@/mobile/pages/MobileDashboard";
import { MobileCanvas } from "@/mobile/pages/MobileCanvas";
import { MobileSettings } from "@/mobile/pages/MobileSettings";
import { MobileSearch } from "@/mobile/pages/MobileSearch";
import { MobileInstallBanner } from "@/mobile/components/MobileInstallBanner";
import { MobileRouteGuard } from "@/mobile/components/MobileRouteGuard";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <div onContextMenu={(e) => e.preventDefault()}>
      <Routes>
        {/* Desktop Routes */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/workspace/:workspaceId" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route path="/import" element={<ProtectedRoute><ImportPage /></ProtectedRoute>} />
        <Route path="/view/:workspaceId" element={<ViewWorkspacePage />} />
        
        {/* Mobile Routes - Completely separate from desktop */}
        <Route path="/mobile-mode" element={<ProtectedRoute><MobileDashboard /></ProtectedRoute>} />
        <Route path="/mobile-mode/workspace/:workspaceId" element={<ProtectedRoute><MobileCanvas /></ProtectedRoute>} />
        <Route path="/mobile-mode/settings" element={<ProtectedRoute><MobileSettings /></ProtectedRoute>} />
        <Route path="/mobile-mode/search" element={<ProtectedRoute><MobileSearch /></ProtectedRoute>} />
        
        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

const App = () => {
  useSyncManager();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MobileThemeProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <MobileInstallBanner />
            <BrowserRouter>
              <AuthProvider>
                <MobileRouteGuard>
                  <AppRoutes />
                </MobileRouteGuard>
              </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </MobileThemeProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
