import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import logoPath from '@assets/logo_1782993196781.jpeg';
import { Loader2, ArrowLeft } from 'lucide-react';


export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Admin state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [adminStep, setAdminStep] = useState<'login' | 'forgot' | 'reset'>('login');
  const [resetToken, setResetToken] = useState('');
  const [resetRefreshToken, setResetRefreshToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneStep, setPhoneStep] = useState<'phone' | 'otp'>('phone');

  // Hooks

  // Detect recovery token or confirmation from URL on mount
  useEffect(() => {
    const hash = window.location.hash;
    const search = new URLSearchParams(window.location.search);
    
    // Check for successful registration
    if (search.get('registered') === 'true') {
      toast({ 
        title: "Registration successful!", 
        description: "Your account has been created. Please log in with your email and password." 
      });
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    // Check for email confirmation
    if (search.get('confirmed') === 'true') {
      toast({ 
        title: "Email confirmed!", 
        description: "Your email has been verified. You can now log in." 
      });
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    // Check for phone confirmation
    if (search.get('phone_confirmed') === 'true') {
      toast({ 
        title: "Phone confirmed!", 
        description: "Your phone number has been verified. You can now log in." 
      });
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    // Check for password recovery
    if (hash && hash.includes('type=recovery')) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token') || '';
      if (accessToken) {
        setResetToken(accessToken);
        setResetRefreshToken(refreshToken);
        setAdminStep('reset');
        // Clear the hash so it doesn't trigger auto-login
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }, []);

  // Redirect if already logged in (but NOT if we're in reset mode)
  if (user && adminStep !== 'reset') {
    setLocation('/dashboard');
    return null;
  }

// API server base URL - ensure /api suffix
const rawApiUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3001`;
const API_BASE = rawApiUrl.replace(/\/$/, '') + '/api';

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Call API server for login (enforces email confirmation check server-side)
      const response = await fetch(`${API_BASE}/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase(), password }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle email not confirmed
        if (response.status === 403 && result.error?.includes('not confirmed')) {
          toast({
            title: "Email not confirmed",
            description: result.message || "Please confirm your email before logging in. Check your inbox for the confirmation link.",
            variant: "destructive",
          });
          return;
        }
        // Handle account deactivated
        if (response.status === 403 && result.error?.includes('deactivated')) {
          toast({
            title: "Account deactivated",
            description: result.message || "Your account has been deactivated. Contact admin.",
            variant: "destructive",
          });
          return;
        }
        throw new Error(result.error || 'Login failed');
      }

      // Set the session in Supabase client so auth state works globally
      if (result.session) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });
        if (sessionError) throw sessionError;
      }

      toast({
        title: "Login successful",
        description: "Welcome to JISHLink Dashboard",
      });
      
      setLocation('/dashboard');
    } catch (err: any) {
      toast({
        title: "Login failed",
        description: err.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdminForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0) {
      toast({ title: `Please wait ${cooldown} seconds before trying again`, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // Call API server for forgot-password (bypasses Supabase client rate limits)
      const response = await fetch(`${API_BASE}/auth/admin/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific errors
        if (response.status === 404 || result.error?.includes('not registered')) {
          toast({ 
            title: "Email not registered", 
            description: "This email is not registered in our system. Please check or create an account.", 
            variant: "destructive" 
          });
          return;
        }
        if (response.status === 429) {
          const retryAfter = result.retry_after_seconds || 300;
          toast({ 
            title: "Too many attempts", 
            description: `Please wait ${retryAfter} seconds before trying again.`, 
            variant: "destructive" 
          });
          setCooldown(retryAfter);
          const interval = setInterval(() => {
            setCooldown((prev) => {
              if (prev <= 1) { clearInterval(interval); return 0; }
              return prev - 1;
            });
          }, 1000);
          return;
        }
        throw new Error(result.error || 'Failed to send reset link');
      }

      toast({ 
        title: "Reset link sent", 
        description: result.message || "Password reset link sent to your email. Please check your inbox and spam folder." 
      });
      setCooldown(300); // 5 minute cooldown
      const interval = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) { clearInterval(interval); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAdminPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0) {
      toast({ title: `Please wait ${cooldown} seconds before trying again`, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/admin/send-phone-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          toast({ 
            title: "Phone not found", 
            description: "No account found with this phone number. Please check or use email login.", 
            variant: "destructive" 
          });
          return;
        }
        throw new Error(result.error || 'Failed to send OTP');
      }

      setPhoneStep('otp');
      toast({ title: "OTP sent", description: result.message || `Check your phone ${phone}` });
      setCooldown(60); // 1 minute cooldown
      const interval = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) { clearInterval(interval); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Set the session using the recovery token
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: resetToken,
        refresh_token: resetRefreshToken,
      });
      if (sessionError) throw sessionError;

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      toast({ title: "Password reset successful", description: "Please log in with your new password." });
      setAdminStep('login');
      setNewPassword('');
      setConfirmPassword('');
      setResetToken('');
    } catch (err: any) {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAdminPhoneVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/admin/verify-phone-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: phoneOtp }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Verification failed');
      }

      // Set the session in Supabase client so auth state works globally
      if (result.token) {
        // For custom token, store it and set auth state manually
        localStorage.setItem('admin_token', result.token);
        // Trigger auth state update by setting Supabase session if possible
        // Or use a custom auth context that checks for admin_token
      }

      toast({ title: "Login successful", description: "Welcome to JISHLink Dashboard" });
      setLocation('/dashboard');
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[40vh] bg-sidebar -z-10" />
      
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardHeader className="space-y-4 pb-6 items-center text-center">
          <div className="bg-white p-4 rounded-md shadow-sm border mb-2">
            <img src={logoPath} alt="JISHLink Logo" className="h-12 object-contain" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Portal Login</CardTitle>
            <CardDescription>
              Sign in to manage operations or access your account
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full">
              {adminStep === 'login' && (
                <>
                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder="admin@jishlink.com" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="password">Password</Label>
                        <button type="button" onClick={() => setAdminStep('forgot')} className="text-xs text-primary hover:underline">
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Input 
                          id="password" 
                          type={showPassword ? 'text' : 'password'} 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="h-11 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-11 text-base mt-2" disabled={loading}>
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Sign In (Admin)
                    </Button>
                  </form>
                  
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <div className="text-center">
                      <span className="text-xs text-muted-foreground">Or login with phone</span>
                    </div>
                    <form onSubmit={handleAdminPhoneOtp} className="space-y-3">
                      <div className="flex gap-2">
                        <Input 
                          placeholder="+91-9876543210" 
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="h-11 flex-1"
                        />
                        <Button type="submit" variant="outline" className="h-11" disabled={loading}>
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send OTP'}
                        </Button>
                      </div>
                    </form>
                    
                    <div className="text-center pt-2">
                      <span className="text-sm text-muted-foreground">Don't have an account? </span>
                      <Link href="/register" className="text-sm text-primary hover:underline font-medium">
                        Create Account
                      </Link>
                    </div>
                  </div>
                </>
              )}

              {adminStep === 'forgot' && (
                <form onSubmit={handleAdminForgot} className="space-y-4">
                  <button type="button" onClick={() => setAdminStep('login')} className="text-xs text-primary flex items-center gap-1 mb-2">
                    <ArrowLeft className="w-3 h-3" /> Back to login
                  </button>
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input 
                      type="email" 
                      placeholder="Enter your email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={loading || cooldown > 0}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {cooldown > 0 ? `Wait ${cooldown}s` : 'Send Reset Link'}
                  </Button>
                </form>
              )}

              {adminStep === 'reset' && (
                <form onSubmit={handleAdminResetPassword} className="space-y-4">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold">Reset Password</h3>
                    <p className="text-sm text-muted-foreground">Enter your new password below</p>
                  </div>
                  <div className="space-y-2">
                    <Label>New Password</Label>
                    <div className="relative">
                      <Input 
                        type={showNewPassword ? 'text' : 'password'} 
                        placeholder="Min 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        className="h-11 pr-10"
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm Password</Label>
                    <div className="relative">
                      <Input 
                        type={showConfirmPassword ? 'text' : 'password'} 
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="h-11 pr-10"
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Reset Password
                  </Button>
                </form>
              )}

              {phoneStep === 'otp' && (
                <form onSubmit={handleAdminPhoneVerify} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Enter OTP sent to {phone}</Label>
                    <Input 
                      value={phoneOtp}
                      onChange={(e) => setPhoneOtp(e.target.value)}
                      required
                      className="h-11"
                      placeholder="6-digit code"
                      maxLength={6}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => setPhoneStep('phone')}>
                      Back
                    </Button>
                    <Button type="submit" className="h-11 flex-1" disabled={loading}>
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Verify'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
        </CardContent>
        <CardFooter className="flex justify-center border-t p-4 bg-muted/20">
          <p className="text-xs text-muted-foreground text-center">
            &copy; {new Date().getFullYear()} JISHLink Consulting India Pvt. Ltd.<br/>
            All rights reserved.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
