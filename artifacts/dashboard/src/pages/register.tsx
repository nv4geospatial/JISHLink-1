import { useState } from 'react';
import { useLocation, Link } from 'wouter';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import logoPath from '@assets/logo_1782993196781.jpeg';
import { Loader2, ArrowLeft } from 'lucide-react';

// API server base URL - ensure /api suffix
const rawApiUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3001`;
const API_BASE = rawApiUrl.replace(/\/$/, '') + '/api';

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Email registration state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Phone number for profile (optional, used for OTP login later)
  const [phone, setPhone] = useState('');

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (cooldown > 0) {
      toast({ title: `Please wait ${cooldown} seconds before trying again`, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Call API server for registration (bypasses Supabase client rate limits)
      const response = await fetch(`${API_BASE}/auth/admin/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.toLowerCase(),
          password,
          name,
          phone: phone && phone.length === 10 ? `+91${phone}` : null,
        }),
      });

      let result: any = {};
      try {
        result = await response.json();
      } catch {
        result = {};
      }

      if (!response.ok) {
        const rawError = result?.error ?? result?.message;
        const errorMsg =
          typeof rawError === 'string' && rawError.trim()
            ? rawError
            : `Registration failed (status ${response.status}). Please try a different password or contact admin.`;
        
        // Handle specific errors
        if (response.status === 409 || 
            errorMsg.toLowerCase().includes('already registered') ||
            errorMsg.toLowerCase().includes('already exists') ||
            errorMsg.toLowerCase().includes('user already')) {
          toast({ 
            title: "Email already registered", 
            description: "This email is already in use. Please log in or use forgot password.", 
            variant: "destructive" 
          });
          return;
        }
        if (response.status === 429) {
          const retryAfter = result.retry_after_seconds || 60;
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
        throw new Error(errorMsg);
      }

      if (result.auto_confirmed) {
        toast({
          title: "Registration successful",
          description: "Your account is ready — you can log in now.",
        });
        setLocation('/login?registered=true');
      } else {
        toast({
          title: "Registration successful",
          description: "Please check your email and click the confirmation link before logging in.",
        });
        setLocation('/confirm?type=email&email=' + encodeURIComponent(email.toLowerCase()));
      }
    } catch (err: any) {
      const errorMessage =
        (typeof err?.message === 'string' && err.message.trim()) ||
        (typeof err?.error === 'string' && err.error.trim()) ||
        'Something went wrong. Please try again.';
      toast({ title: "Registration failed", description: errorMessage, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-dvh flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[40vh] bg-sidebar -z-10" />
      
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardHeader className="space-y-4 pb-6 items-center text-center">
          <div className="bg-white p-4 rounded-md shadow-sm border mb-2">
            <img src={logoPath} alt="JISHLink Logo" className="h-12 object-contain" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
            <CardDescription>
              Register as admin or recruiter with email
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-11"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11"
                    placeholder="you@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <div className="flex h-11 items-center rounded-md border border-input bg-background overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                    <span className="px-3 text-sm text-muted-foreground border-r h-full flex items-center bg-muted/40 select-none">+91</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      maxLength={10}
                      className="flex-1 h-full px-3 bg-transparent outline-none text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Optional. Used for OTP login after account approval.</p>
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input 
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
                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <div className="relative">
                    <Input 
                      type={showConfirmPassword ? 'text' : 'password'} 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="h-11 pr-10"
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
                <Button type="submit" className="w-full h-11 text-base mt-2" disabled={loading || cooldown > 0}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {cooldown > 0 ? `Wait ${cooldown}s` : 'Create Account'}
                </Button>
              </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 border-t p-4 bg-muted/20">
          <Link href="/login" className="text-sm text-primary hover:underline flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Already have an account? Sign in
          </Link>
          <p className="text-xs text-muted-foreground text-center">
            &copy; {new Date().getFullYear()} JISHLink Consulting India Pvt. Ltd.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}