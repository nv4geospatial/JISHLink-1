import { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import logoPath from '@assets/logo_1782993196781.jpeg';
import { Mail, Phone, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// API server base URL
const rawApiUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3001`;
const API_BASE = rawApiUrl.replace(/\/$/, '') + '/api';

export default function ConfirmPage() {
  const [location] = useLocation();
  const { toast } = useToast();
  const [resending, setResending] = useState(false);
  
  const search = new URLSearchParams(window.location.search);
  const type = search.get('type') || 'email';
  const email = search.get('email') || '';

  // State for confirmation flow
  const [confirmState, setConfirmState] = useState<'idle' | 'confirming' | 'success' | 'error'>('idle');
  const [confirmError, setConfirmError] = useState('');
  const [hasTokens, setHasTokens] = useState(false);
  
  // Extract tokens from hash on mount
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  // Check if user arrived from Supabase confirmation link
  // Supabase redirects to: /confirm?type=email#access_token=xxx&refresh_token=xxx&type=signup
  useEffect(() => {
    const hash = window.location.hash;
    
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      const refresh = params.get('refresh_token') || '';
      const typeParam = params.get('type');
      
      if (token && typeParam === 'signup') {
        setAccessToken(token);
        setRefreshToken(refresh);
        setHasTokens(true);
      }
    }
  }, []);

  const handleConfirmEmail = async () => {
    if (!accessToken) return;
    
    setConfirmState('confirming');
    try {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
      });
      
      if (error) {
        setConfirmState('error');
        setConfirmError(error.message);
        toast({
          title: "Confirmation failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setConfirmState('success');
        toast({
          title: "Email confirmed!",
          description: "Your email has been verified. You can now log in.",
        });
        // Clear the hash
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } catch (err: any) {
      setConfirmState('error');
      setConfirmError(err.message);
      toast({
        title: "Confirmation failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleResendEmail = async () => {
    if (!email) {
      toast({ title: "No email provided", variant: "destructive" });
      return;
    }
    setResending(true);
    try {
      // Call API server to resend confirmation email (bypasses client rate limits)
      const response = await fetch(`${API_BASE}/auth/admin/resend-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle rate limit specifically
        if (response.status === 429 || result.error?.includes('Rate limit')) {
          toast({ 
            title: "Rate limit exceeded", 
            description: result.message || "Too many requests. Please wait 1 hour before trying again, or check your spam folder.", 
            variant: "destructive" 
          });
          return;
        }
        throw new Error(result.error || 'Failed to resend confirmation email');
      }

      toast({ 
        title: "Confirmation email resent", 
        description: result.message || "Please check your inbox and spam folder." 
      });
    } catch (err: any) {
      toast({ title: "Failed to resend", description: err.message, variant: "destructive" });
    } finally {
      setResending(false);
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
            <CardTitle className="text-2xl font-bold">
              {type === 'email' ? (
                <span className="flex items-center justify-center gap-2">
                  <Mail className="w-6 h-6" /> Check Your Email
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Phone className="w-6 h-6" /> Check Your Phone
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {type === 'email' 
                ? "We've sent a confirmation link to your email address." 
                : "We've sent a confirmation code to your phone number."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Step 1: Account Created</p>
                <p className="text-xs text-muted-foreground">Your account has been successfully created.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Step 2: Confirm Your {type === 'email' ? 'Email' : 'Phone'}</p>
                <p className="text-xs text-muted-foreground">
                  {type === 'email' 
                    ? `Click the link we sent to ${email || 'your email'} to verify your account.`
                    : "Enter the OTP code we sent to your phone to verify your account."}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Step 3: Login</p>
                <p className="text-xs text-muted-foreground">Once confirmed, you can log in to your account.</p>
              </div>
            </div>
          </div>

          {/* Show Confirm Email button when user arrives from confirmation link */}
          {hasTokens && confirmState !== 'success' && (
            <div className="space-y-3">
              <div className="bg-primary/10 rounded-lg p-4 text-center">
                <CheckCircle className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium">Confirmation Link Detected</p>
                <p className="text-xs text-muted-foreground">Click the button below to verify your email address.</p>
              </div>
              <Button 
                className="w-full h-11" 
                onClick={handleConfirmEmail}
                disabled={confirmState === 'confirming'}
              >
                {confirmState === 'confirming' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Confirm Email Address
              </Button>
              {confirmState === 'error' && (
                <p className="text-sm text-destructive text-center">{confirmError}</p>
              )}
            </div>
          )}

          {/* Show success state */}
          {confirmState === 'success' && (
            <div className="space-y-3 text-center">
              <div className="bg-green-50 rounded-lg p-4">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-green-800">Email Confirmed Successfully!</p>
                <p className="text-xs text-green-600">Your email has been verified. You can now log in to your account.</p>
              </div>
              <Link href="/login">
                <Button className="w-full h-11">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Go to Login
                </Button>
              </Link>
            </div>
          )}

          {/* Show resend option only when NOT on confirmation link */}
          {type === 'email' && email && !hasTokens && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  <strong>Note:</strong> Confirmation emails may take a few minutes. Please check your <strong>spam/junk folder</strong> before resending. You can only resend once per hour.
                </p>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Didn't receive the email?
              </p>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleResendEmail}
                disabled={resending}
              >
                {resending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Resend Confirmation Email
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2 border-t p-4 bg-muted/20">
          {!hasTokens && (
            <Link href="/login" className="text-sm text-primary hover:underline flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Already confirmed? Go to Login
            </Link>
          )}
          <p className="text-xs text-muted-foreground text-center">
            &copy; {new Date().getFullYear()} JISHLink Consulting India Pvt. Ltd.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}