import { Link, useLocation } from 'wouter';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  MapPin, 
  Clock, 
  FileText, 
  Settings,
  LogOut,
  Menu,
  KeyRound,
  UserCircle,
  Loader2
} from 'lucide-react';
import { useAuth } from './auth-provider';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabase';
import { useState } from 'react';
import logoPath from '@assets/logo_1782993196781.jpeg';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/clients', label: 'Clients', icon: Building2 },
  { href: '/sites', label: 'Sites', icon: MapPin },
  { href: '/attendance', label: 'Attendance', icon: Clock },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings, allowedRoles: ['admin', 'recruiter'] },
];

export function Sidebar({ mobile = false, setOpen }: { mobile?: boolean, setOpen?: (open: boolean) => void }) {
  const [location] = useLocation();
  const { signOut, role } = useAuth();

  const content = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground w-60">
      <div className="p-4 flex items-center justify-center border-b border-sidebar-border h-16 shrink-0 bg-white">
        <img src={logoPath} alt="JISHLink Logo" className="h-10 object-contain" />
      </div>
      
      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        <div className="text-xs font-semibold text-sidebar-primary mb-2 px-3 uppercase tracking-wider">Management</div>
        {navItems.filter(item => !item.allowedRoles || (role && item.allowedRoles.includes(role))).map((item) => {
          const isActive = location.startsWith(item.href);
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.href} 
              href={item.href} 
              onClick={() => setOpen?.(false)}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground border-l-4 border-sidebar-primary pl-2' : ''
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-sidebar-border">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" 
          onClick={() => signOut()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log Out
        </Button>
      </div>
    </div>
  );

  if (mobile) {
    return content;
  }

  return (
    <aside className="hidden lg:flex flex-col w-60 fixed inset-y-0 left-0 z-50">
      {content}
    </aside>
  );
}

export function Topbar() {
  const [location] = useLocation();
  const { user, role, signOut } = useAuth();
  const { toast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  const currentNav = navItems.find(item => location.startsWith(item.href));
  const title = currentNav?.label || 'JISHLink';

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: "Password changed successfully", description: "Please use your new password next time you log in." });
      setShowChangePassword(false);
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      toast({ title: "Failed to change password", description: err.message, variant: "destructive" });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/login';
  };

  return (
    <>
      <header className="h-16 shrink-0 border-b border-border bg-card flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-fit border-none">
              <Sidebar mobile setOpen={setSheetOpen} />
            </SheetContent>
          </Sheet>
          
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-medium">{user?.email || 'User'}</span>
            <span className="text-xs text-muted-foreground capitalize">{role || 'No role assigned'}</span>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm hover:ring-2 hover:ring-primary/50 transition-all">
                {user?.email?.charAt(0).toUpperCase() || 'A'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {user?.email}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowChangePassword(true)}>
                <KeyRound className="mr-2 h-4 w-4" />
                Change Password
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Change Password Dialog */}
      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <DialogContent className="sm:max-w-100">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Min 6 characters"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input 
                type="password" 
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Re-enter password"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowChangePassword(false)}>Cancel</Button>
              <Button type="submit" disabled={passwordLoading}>
                {passwordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Change Password
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <Sidebar />
      <div className="lg:pl-60 flex flex-col min-h-dvh">
        <Topbar />
        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
