import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const { employee, token, clearAuth } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Change password via reset flow (OTP)
  const [cpStep, setCpStep] = useState<"idle" | "sent" | "done">("idle");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError] = useState<string | null>(null);
  const [otpForDev, setOtpForDev] = useState<string | null>(null);

  async function sendResetOtp() {
    if (!employee) return;
    setCpLoading(true);
    setCpError(null);
    try {
      const res = await apiFetch<{ otp_for_dev?: string }>(
        "/auth/employee/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({ employee_code: employee.employee_code }),
        },
      );
      setCpStep("sent");
      if (res.otp_for_dev) setOtpForDev(res.otp_for_dev);
    } catch (err: unknown) {
      setCpError((err as Error).message);
    } finally {
      setCpLoading(false);
    }
  }

  async function submitPasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!employee) return;
    if (newPassword !== confirmPassword) {
      setCpError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setCpError("Password must be at least 6 characters");
      return;
    }
    setCpLoading(true);
    setCpError(null);
    try {
      await apiFetch("/auth/employee/reset-password", {
        method: "POST",
        body: JSON.stringify({
          employee_code: employee.employee_code,
          reset_code: resetCode,
          new_password: newPassword,
        }),
      });
      setCpStep("done");
    } catch (err: unknown) {
      setCpError((err as Error).message);
    } finally {
      setCpLoading(false);
    }
  }

  if (!employee) {
    navigate("/login");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="bg-primary text-white px-5 pt-12 pb-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/home")} className="text-white text-xl">←</button>
          <h1 className="text-lg font-bold">My Profile</h1>
        </div>
        <div className="flex items-center gap-4">
          {employee.photo_url ? (
            <img src={employee.photo_url} alt={employee.name}
              className="w-16 h-16 rounded-full object-cover ring-2 ring-white/40" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white text-2xl font-bold">
              {employee.name[0].toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold">{employee.name}</h2>
            <p className="text-blue-200 font-mono text-sm">{employee.employee_code}</p>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
              employee.status === "active" ? "bg-green-400/20 text-green-200" : "bg-red-400/20 text-red-200"
            }`}>
              {employee.status}
            </span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="px-4 -mt-2 mb-4">
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <Field label="Mobile" value={employee.mobile} />
          {employee.email && <Field label="Email" value={employee.email} />}
        </div>
      </div>

      {/* Change Password */}
      <div className="px-4 mb-4">
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <button
            onClick={() => { setShowChangePassword(!showChangePassword); setCpStep("idle"); setCpError(null); }}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🔒</span>
              <span className="font-semibold text-sm text-foreground">Change Password</span>
            </div>
            <span className="text-muted-foreground">{showChangePassword ? "▲" : "▼"}</span>
          </button>

          {showChangePassword && (
            <div className="mt-4 border-t border-border pt-4">
              {cpStep === "done" ? (
                <div className="text-center py-4">
                  <div className="text-3xl mb-2">✅</div>
                  <p className="font-semibold text-foreground text-sm">Password changed!</p>
                  <button onClick={() => { setCpStep("idle"); setShowChangePassword(false); }}
                    className="mt-3 text-primary text-sm font-medium">
                    Close
                  </button>
                </div>
              ) : cpStep === "idle" ? (
                <div>
                  <p className="text-muted-foreground text-xs mb-4">
                    We'll send a verification code to your registered mobile number.
                  </p>
                  {cpError && <p className="text-red-600 text-xs mb-3">{cpError}</p>}
                  <button onClick={sendResetOtp} disabled={cpLoading}
                    className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50">
                    {cpLoading ? "Sending…" : "Send Verification Code"}
                  </button>
                </div>
              ) : (
                <form onSubmit={submitPasswordChange} className="space-y-3">
                  {otpForDev && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                      <b>Dev OTP:</b> {otpForDev}
                    </div>
                  )}
                  <input
                    value={resetCode} onChange={(e) => setResetCode(e.target.value)}
                    placeholder="Verification code" maxLength={6}
                    className="w-full border border-input rounded-xl px-4 py-3 text-center text-xl tracking-[0.4em] font-mono"
                    inputMode="numeric" required
                  />
                  <input
                    type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password" minLength={6}
                    className="w-full border border-input rounded-xl px-4 py-3"
                    required
                  />
                  <input
                    type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full border border-input rounded-xl px-4 py-3"
                    required
                  />
                  {cpError && <p className="text-red-600 text-xs">{cpError}</p>}
                  <button type="submit" disabled={cpLoading}
                    className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50">
                    {cpLoading ? "Changing…" : "Change Password"}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sign out */}
      <div className="px-4 pb-10">
        <button
          onClick={() => { clearAuth(); navigate("/login"); }}
          className="w-full border border-red-200 text-red-600 py-3 rounded-xl font-semibold text-sm"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-foreground text-sm font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}
