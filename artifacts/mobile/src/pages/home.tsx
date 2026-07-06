import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import { formatTime, formatDate, statusLabel } from "@/lib/utils";

type AttRecord = {
  id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  site_name?: string;
};

type TodayStatus = {
  status: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  site_name?: string;
};

export default function HomePage() {
  const { employee, token, clearAuth } = useAuth();
  const [, navigate] = useLocation();
  const [today, setToday] = useState<TodayStatus | null>(null);
  const [recent, setRecent] = useState<AttRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!token) return;
      try {
        const res = await apiFetch<{ records: AttRecord[] }>(
          `/attendance/employee/${employee!.id}?limit=7`,
          { token },
        );
        const recs = res.records ?? [];
        setRecent(recs.slice(1));
        const todayStr = new Date().toISOString().split("T")[0];
        const todayRec = recs.find((r) => r.date === todayStr) ?? null;
        setToday(todayRec);
      } catch {
        // ignore — show empty state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token, employee]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="bg-primary text-white px-5 pt-12 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-sm">{greeting()},</p>
            <h1 className="text-xl font-bold mt-0.5">{employee?.name ?? "Employee"}</h1>
            <p className="text-blue-200 text-xs mt-0.5 font-mono">{employee?.employee_code}</p>
          </div>
          <button onClick={() => navigate("/profile")}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold text-lg">
            {(employee?.name ?? "?")[0].toUpperCase()}
          </button>
        </div>
      </div>

      {/* Today status card */}
      <div className="mx-4 -mt-4 bg-white rounded-2xl shadow-lg p-5 mb-5">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Today's Status</p>
        {loading ? (
          <div className="h-12 bg-muted animate-pulse rounded-lg" />
        ) : today ? (
          <div className="flex items-center justify-between">
            <div>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusLabel(today.status ?? "").color}`}>
                {statusLabel(today.status ?? "").label}
              </span>
              <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                <span>In: <b className="text-foreground">{formatTime(today.check_in_time)}</b></span>
                <span>Out: <b className="text-foreground">{formatTime(today.check_out_time)}</b></span>
              </div>
            </div>
            {!today.check_out_time && (
              <button onClick={() => navigate("/scan")}
                className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold">
                Check Out
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">Not checked in yet</p>
            <button onClick={() => navigate("/scan")}
              className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold">
              Check In
            </button>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="px-4 mb-6">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate("/scan")}
            className="bg-primary text-white rounded-2xl p-5 flex flex-col items-center gap-2 shadow-sm active:scale-95 transition-transform">
            <span className="text-3xl">📷</span>
            <span className="font-semibold text-sm">Scan QR</span>
            <span className="text-blue-200 text-xs">Check in / out</span>
          </button>
          <button onClick={() => navigate("/history")}
            className="bg-white border border-border rounded-2xl p-5 flex flex-col items-center gap-2 shadow-sm active:scale-95 transition-transform">
            <span className="text-3xl">📋</span>
            <span className="font-semibold text-sm text-foreground">History</span>
            <span className="text-muted-foreground text-xs">View attendance</span>
          </button>
          <button onClick={() => navigate("/profile")}
            className="bg-white border border-border rounded-2xl p-5 flex flex-col items-center gap-2 shadow-sm active:scale-95 transition-transform">
            <span className="text-3xl">👤</span>
            <span className="font-semibold text-sm text-foreground">Profile</span>
            <span className="text-muted-foreground text-xs">My details</span>
          </button>
          <button onClick={() => { clearAuth(); navigate("/login"); }}
            className="bg-white border border-border rounded-2xl p-5 flex flex-col items-center gap-2 shadow-sm active:scale-95 transition-transform">
            <span className="text-3xl">🚪</span>
            <span className="font-semibold text-sm text-foreground">Sign Out</span>
            <span className="text-muted-foreground text-xs">Log off</span>
          </button>
        </div>
      </div>

      {/* Recent attendance */}
      <div className="px-4 pb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Recent Attendance</p>
          <button onClick={() => navigate("/history")} className="text-primary text-xs font-medium">See all</button>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-6">No recent records</p>
        ) : (
          <div className="space-y-2">
            {recent.map((r) => {
              const s = statusLabel(r.status);
              return (
                <div key={r.id} className="bg-white rounded-xl p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="font-medium text-sm text-foreground">{formatDate(r.date)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatTime(r.check_in_time)} → {formatTime(r.check_out_time)}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${s.color}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
