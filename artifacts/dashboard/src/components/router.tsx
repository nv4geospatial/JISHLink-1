import { Switch, Route, Redirect } from "wouter";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@/components/auth-provider";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ConfirmPage from "@/pages/confirm";
import DashboardPage from "@/pages/dashboard";
import EmployeesPage from "@/pages/employees";
import ClientsPage from "@/pages/clients";
import SitesPage from "@/pages/sites";
import AttendancePage from "@/pages/attendance";
import ReportsPage from "@/pages/reports";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

// Protected Route Wrapper
const ProtectedRoute = ({ component: Component, adminOnly = false }: { component: any, adminOnly?: boolean }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-primary">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm font-medium">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
};

export function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/confirm" component={ConfirmPage} />
      <Route path="/">
        {() => <Redirect to="/dashboard" />}
      </Route>
      
      {/* Protected Routes */}
      <Route path="/dashboard">
        {() => <ProtectedRoute component={DashboardPage} />}
      </Route>
      <Route path="/employees">
        {() => <ProtectedRoute component={EmployeesPage} />}
      </Route>
      <Route path="/clients">
        {() => <ProtectedRoute component={ClientsPage} />}
      </Route>
      <Route path="/sites">
        {() => <ProtectedRoute component={SitesPage} />}
      </Route>
      <Route path="/attendance">
        {() => <ProtectedRoute component={AttendancePage} />}
      </Route>
      <Route path="/reports">
        {() => <ProtectedRoute component={ReportsPage} />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute component={SettingsPage} adminOnly />}
      </Route>

      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}
