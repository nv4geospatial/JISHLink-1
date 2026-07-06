import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { formatDate, formatTime, statusLabel } from "@/lib/utils";

type AttRecord = {
  id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  site_name?: string;
  check_in_lat?: number;
  check_in_lng?: number;
};

export default function HistoryPage() {
  const [, navigate] = useLocation();
  const { employee, token } = useAuth();
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Month selector: default to current month
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  useEffect(() => {
    if (!token || !employee) return;
    setLoading(true);
    setError(null);

    apiFetch<{ records: AttRecord[] }>(
      `/attendance/employee/${employee.id}?year=${year}&month=${month}`,
      { token },
    )
      .then((res) => setRecords(res.records ?? []))
      .catch((err: unknown) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [token, employee, year, month]);

  const presentDays = records.filter((r) => ["present", "late"].includes(r.status)).length;
  const absentDays = records.filter((r) => r.status === "absent").length;
  const lateDays = records.filter((r) => r.status === "late").length;

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    const today = new Date();
    if (year === today.getFullYear() && month === today.getMonth() + 1) return;
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="bg-primary text-white px-5 pt-12 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate("/home")} className="text-white text-xl">←</button>
          <h1 className="text-lg font-bold">Attendance History</h1>
        </div>

        {/* Month selector */}
        <div className="flex items-center justify-between bg-white/10 rounded-xl p-3">
          <button onClick={prevMonth} className="text-white text-xl px-2">‹</button>
          <span className="font-semibold text-sm">{monthLabel}</span>
          <button onClick={nextMonth} className="text-white text-xl px-2 disabled:opacity-40">›</button>
        </div>
      </div>

      {/* Summary */}
      <div className="mx-4 -mt-2 grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Present", value: presentDays, color: "bg-green-100 text-green-800" },
          { label: "Absent", value: absentDays, color: "bg-red-100 text-red-800" },
          { label: "Late", value: lateDays, color: "bg-yellow-100 text-yellow-800" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className={`text-2xl font-bold ${s.color.split(" ")[1]}`}>{loading ? "—" : s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Records list */}
      <div className="flex-1 px-4 pb-8">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-muted-foreground text-sm">No attendance records for {monthLabel}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {records.map((r) => {
              const s = statusLabel(r.status);
              return (
                <div key={r.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-sm text-foreground">{formatDate(r.date)}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.color}`}>{s.label}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>
                      Check In: <span className="text-foreground font-medium">{formatTime(r.check_in_time)}</span>
                    </span>
                    <span>
                      Check Out: <span className="text-foreground font-medium">{formatTime(r.check_out_time)}</span>
                    </span>
                  </div>
                  {r.site_name && (
                    <p className="text-xs text-muted-foreground mt-1">📍 {r.site_name}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
