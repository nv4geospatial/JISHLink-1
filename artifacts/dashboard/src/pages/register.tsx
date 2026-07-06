import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

  // Phone registration state
  const [phone, setPhone] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneStep, setPhoneStep] = useState<'phone' | 'otp'>('phone');

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
          phone: phone || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific errors
        if (response.status === 409 || result.error?.includes('already registered')) {
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
        throw new Error(result.error || 'Registration failed');
      }

      toast({
        title: "Registration successful",
        description: "Please check your email and click the confirmation link before logging in.",
      });
      setLocation('/confirm?type=email&email=' + encodeURIComponent(email.toLowerCase()));
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) {
        // Provide helpful message for unsupported phone provider
        if (error.message?.includes('provider') || error.message?.includes('Unsupported') || error.status === 400) {
          toast({ 
            title: "Phone OTP not available", 
            description: "SMS provider is not configured in Supabase. Please use email registration or ask admin to enable Twilio in Supabase settings.", 
            variant: "destructive" 
          });
        } else {
          throw error;
        }
        return;
      }
      setPhoneStep('otp');
      toast({ title: "OTP sent", description: `Check your phone ${phone}` });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: phoneOtp,
        type: 'sms',
      });
      if (error) throw error;

      if (data.user) {
        // Insert into users table with pending status
        const { error: userError } = await supabase.from('users').insert({
          id: data.user.id,
          phone: phone,
          name: name || null,
          role_id: null,
          account_status: 'pending',
          phone_verified: true,
        });
        if (userError) console.error('User insert error:', userError);
      }

      toast({
        title: "Phone number confirmed!",
        description: "Your phone has been verified. An admin will assign your role. Please wait for approval.",
      });
      // Redirect to login with phone confirmed flag
      setLocation('/login?phone_confirmed=true');
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
            <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
            <CardDescription>
              Register as admin or recruiter
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="phone">Phone</TabsTrigger>
            </TabsList>
            
            <TabsContent value="email">
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
                  <Label>Password</Label>
                  <Input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <Input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                <Button type="submit" className="w-full h-11 text-base mt-2" disabled={loading || cooldown > 0}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {cooldown > 0 ? `Wait ${cooldown}s` : 'Create Account'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="phone">
              {phoneStep === 'phone' && (
                <form onSubmit={handlePhoneOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Full Name (Optional)</Label>
                    <Input 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-11"
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="h-11"
                      placeholder="+91-9876543210"
                    />
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Send OTP
                  </Button>
                </form>
              )}

              {phoneStep === 'otp' && (
                <form onSubmit={handlePhoneVerify} className="space-y-4">
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
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Verify & Register'}
                    </Button>
                  </div>
                </form>
              )}
            </TabsContent>
          </Tabs>
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