import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Router as WouterRouter } from "wouter";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { useEffect } from "react";

import LoginPage from "@/pages/login";
import HomePage from "@/pages/home";
import ScanPage from "@/pages/scan";
import AttendPage from "@/pages/attend";
import HistoryPage from "@/pages/history";
import ProfilePage from "@/pages/profile";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

/** Redirects unauthenticated users to /login, preserving the intended path */
function PrivateRoute({ component: Component }: { component: React.ComponentType }) {
  const { token, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !token) {
      navigate("/login");
    }
  }, [token, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!token) return null;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/attend/:siteToken" component={AttendPage} />
      <Route path="/home" component={() => <PrivateRoute component={HomePage} />} />
      <Route path="/scan" component={() => <PrivateRoute component={ScanPage} />} />
      <Route path="/history" component={() => <PrivateRoute component={HistoryPage} />} />
      <Route path="/profile" component={() => <PrivateRoute component={ProfilePage} />} />
      {/* Root: redirect based on auth */}
      <Route path="/" component={RootRedirect} />
      <Route component={NotFound} />
    </Switch>
  );
}

function RootRedirect() {
  const { token, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      navigate(token ? "/home" : "/login");
    }
  }, [token, isLoading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary">
      <div className="w-12 h-12 rounded-full border-4 border-white/40 border-t-white animate-spin" />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
