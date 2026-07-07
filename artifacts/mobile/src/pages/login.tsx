import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";

type LoginMode = "password" | "otp";
type OtpStep = "idle" | "sent" | "verifying";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { setAuth } = useAuth();

  const [mode, setMode] = useState<LoginMode>("password");
  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState<OtpStep>("idle");
  // Dev OTP removed — OTP is sent via SMS only

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Forgot password flow
  const [showForgot, setShowForgot] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetStep, setResetStep] = useState<"idle" | "sent" | "done">("idle");

  // Redirect to a pending site after login (from attend deep-link)
  const params = new URLSearchParams(window.location.search);
  const redirectTo = params.get("redirect");

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ token: string; employee: unknown }>(
        "/auth/employee/login",
        {
          method: "POST",
          body: JSON.stringify({ employee_code: employeeCode, password }),
        },
      );
      setAuth(data.token, data.employee as Parameters<typeof setAuth>[1]);
      navigate(redirectTo ?? "/home");
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

    async function handleSendOtp() {
    if (!employeeCode) { setError("Enter your Employee ID first"); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ sms_sent?: boolean; message?: string }>(
        "/auth/employee/send-otp",
        {
          method: "POST",
          body: JSON.stringify({ employee_code: employeeCode, purpose: "login" }),
        },
      );
      setOtpStep("sent");
      if (!res.sms_sent) {
        setError(res.message || "SMS could not be sent. Please try again or contact admin.");
        setOtpStep("idle");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
      setOtpStep("idle");
    } finally {
      setLoading(false);
    }
  }
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ token: string; employee: unknown }>(
        "/auth/employee/verify-otp",
        {
          method: "POST",
          body: JSON.stringify({ employee_code: employeeCode, otp, purpose: "login" }),
        },
      );
      setAuth(data.token, data.employee as Parameters<typeof setAuth>[1]);
      navigate(redirectTo ?? "/home");
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotSend() {
    if (!employeeCode) { setError("Enter your Employee ID first"); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ sms_sent?: boolean; message?: string }>(
        "/auth/employee/forgot-password",
        { method: "POST", body: JSON.stringify({ employee_code: employeeCode }) },
      );
      setResetStep("sent");
      if (!res.sms_sent) {
        setError(res.message || "SMS could not be sent. Please try again or contact admin.");
        setResetStep("idle");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
      setResetStep("idle");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/auth/employee/reset-password", {
        method: "POST",
        body: JSON.stringify({
          employee_code: employeeCode,
          reset_code: resetCode,
          new_password: newPassword,
        }),
      });
      setResetStep("done");
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-primary">
      {/* Header branding */}
      <div className="flex flex-col items-center pt-16 pb-8 px-6">
        <img
          src="/logo-icon.jpeg"
          alt="JISHLink"
          className="w-20 h-20 rounded-2xl shadow-lg mb-4 object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <h1 className="text-3xl font-bold text-white tracking-tight">JISHLink</h1>
        <p className="text-blue-200 text-sm mt-1">Employee Attendance Portal</p>
      </div>

      {/* Card */}
      <div className="flex-1 bg-background rounded-t-3xl px-6 pt-8 pb-10">
        {showForgot ? (
          /* ── Forgot Password ── */
          <div>
            <button onClick={() => { setShowForgot(false); setResetStep("idle"); setError(null); }}
              className="text-primary text-sm mb-4 flex items-center gap-1">
              ← Back to login
            </button>
            <h2 className="text-xl font-semibold text-foreground mb-6">Reset Password</h2>

            {resetStep === "done" ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">✅</div>
                <p className="font-semibold text-foreground">Password reset successfully!</p>
                <button onClick={() => { setShowForgot(false); setResetStep("idle"); }}
                  className="mt-6 w-full bg-primary text-white py-3 rounded-xl font-semibold">
                  Back to Login
                </button>
              </div>
            ) : resetStep === "sent" ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <input
                  value={resetCode} onChange={(e) => setResetCode(e.target.value)}
                  placeholder="6-digit SMS code" maxLength={6}
                  className="w-full border border-input rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono"
                  required
                />
                <input
                  type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 6 chars)"
                  className="w-full border border-input rounded-xl px-4 py-3"
                  required minLength={6}
                />
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full bg-primary text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                  {loading ? "Resetting…" : "Reset Password"}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)}
                  placeholder="Employee ID (e.g. JL1001)"
                  className="w-full border border-input rounded-xl px-4 py-3 uppercase"
                />
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <button onClick={handleForgotSend} disabled={loading}
                  className="w-full bg-primary text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                  {loading ? "Sending…" : "Send Reset Code via SMS"}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ── Main Login ── */
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Welcome back</h2>
            <p className="text-muted-foreground text-sm mb-6">Sign in to mark your attendance</p>

            {/* Mode toggle */}
            <div className="flex bg-muted rounded-xl p-1 mb-6">
              {(["password", "otp"] as const).map((m) => (
                <button key={m} onClick={() => { setMode(m); setError(null); setOtpStep("idle"); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mode === m ? "bg-white text-primary shadow-sm" : "text-muted-foreground"
                  }`}>
                  {m === "password" ? "Password" : "OTP"}
                </button>
              ))}
            </div>

            {mode === "password" ? (
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <input
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                  placeholder="Employee ID (e.g. JL1001)"
                  className="w-full border border-input rounded-xl px-4 py-3 font-mono tracking-wide"
                  autoComplete="username"
                  required
                />
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full border border-input rounded-xl px-4 py-3"
                  autoComplete="current-password"
                  required
                />
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full bg-primary text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                  {loading ? "Signing in…" : "Sign In"}
                </button>
                <button type="button" onClick={() => { setShowForgot(true); setError(null); }}
                  className="w-full text-primary text-sm text-center py-1">
                  Forgot password?
                </button>
              </form>
            ) : (
              /* OTP flow */
              <div className="space-y-4">
                <input
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                  placeholder="Employee ID (e.g. JL1001)"
                  className="w-full border border-input rounded-xl px-4 py-3 font-mono tracking-wide"
                  disabled={otpStep === "sent"}
                  required
                />

                {otpStep === "idle" ? (
                  <>
                    {error && <p className="text-red-600 text-sm">{error}</p>}
                    <button onClick={handleSendOtp} disabled={loading}
                      className="w-full bg-primary text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                      {loading ? "Sending…" : "Send OTP via SMS"}
                    </button>
                  </>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <input
                      value={otp} onChange={(e) => setOtp(e.target.value)}
                      placeholder="Enter 6-digit OTP" maxLength={6}
                      className="w-full border border-input rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono"
                      inputMode="numeric"
                      required
                    />
                    {error && <p className="text-red-600 text-sm">{error}</p>}
                    <button type="submit" disabled={loading}
                      className="w-full bg-primary text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                      {loading ? "Verifying…" : "Verify & Sign In"}
                    </button>
                    <button type="button" onClick={() => { setOtpStep("idle"); setOtp(""); }}
                      className="w-full text-muted-foreground text-sm text-center py-1">
                      Resend OTP
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
