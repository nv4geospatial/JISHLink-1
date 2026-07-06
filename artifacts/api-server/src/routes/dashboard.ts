import { Router, type IRouter, type Request, type Response } from "express";
import { supabase } from "../lib/supabase";
import { requireRole, getRecruiterSiteIds } from "../lib/rbac";

const router: IRouter = Router();

/** GET /dashboard/stats */
router.get(
  "/dashboard/stats",
  async (req: Request, res: Response): Promise<void> => {
    const authed = await requireRole(req, res, ["admin", "recruiter"]);
    if (!authed) return;

    const today = new Date().toISOString().split("T")[0];

    // Recruiters see only their assigned sites' data
    const isRecruiter = authed.roleName === "recruiter";
    const siteIds = isRecruiter
      ? await getRecruiterSiteIds(authed.userId)
      : null;

    // For recruiters with no sites, return zeroed stats
    if (isRecruiter && (!siteIds || siteIds.length === 0)) {
      res.json({
        total_employees: 0,
        present_today: 0,
        absent_today: 0,
        late_today: 0,
        total_sites: 0,
        total_clients: 0,
      });
      return;
    }

    // Build scoped queries
    let empQuery = supabase
      .from("employees")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");
    if (siteIds) empQuery = empQuery.in("site_id", siteIds);

    let presentQuery = supabase
      .from("attendance")
      .select("*", { count: "exact", head: true })
      .eq("date", today)
      .in("status", ["present", "late"]);
    if (siteIds) presentQuery = presentQuery.in("site_id", siteIds);

    let lateQuery = supabase
      .from("attendance")
      .select("*", { count: "exact", head: true })
      .eq("date", today)
      .eq("status", "late");
    if (siteIds) lateQuery = lateQuery.in("site_id", siteIds);

    let sitesQuery = supabase
      .from("sites")
      .select("*", { count: "exact", head: true });
    if (siteIds) sitesQuery = sitesQuery.in("id", siteIds);

    // Clients: admin sees all active; recruiter sees clients of their sites
    let clientsCount = 0;
    if (!isRecruiter) {
      const { count } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      clientsCount = count ?? 0;
    } else {
      // Get distinct client_ids from their sites
      const { data: siteData } = await supabase
        .from("sites")
        .select("client_id")
        .in("id", siteIds!);
      const clientIds = [
        ...new Set(
          (siteData ?? [])
            .map((s: { client_id: string | null }) => s.client_id)
            .filter(Boolean) as string[],
        ),
      ];
      clientsCount = clientIds.length;
    }

    const [
      { count: totalEmployees },
      { count: presentToday },
      { count: lateToday },
      { count: totalSites },
    ] = await Promise.all([empQuery, presentQuery, lateQuery, sitesQuery]);

    const present = presentToday ?? 0;
    const total = totalEmployees ?? 0;

    res.json({
      total_employees: total,
      present_today: present,
      absent_today: Math.max(0, total - present),
      late_today: lateToday ?? 0,
      total_sites: totalSites ?? 0,
      total_clients: clientsCount,
    });
  },
);

/** GET /dashboard/attendance-trend */
router.get(
  "/dashboard/attendance-trend",
  async (req: Request, res: Response): Promise<void> => {
    const authed = await requireRole(req, res, ["admin", "recruiter"]);
    if (!authed) return;

    const isRecruiter = authed.roleName === "recruiter";
    const siteIds = isRecruiter
      ? await getRecruiterSiteIds(authed.userId)
      : null;

    const siteIdParam = req.query.siteId as string | undefined;

    // Last 14 days
    const dates: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split("T")[0]);
    }

    const fromDate = dates[0];
    const toDate = dates[dates.length - 1];

    let query = supabase
      .from("attendance")
      .select("date, status")
      .gte("date", fromDate)
      .lte("date", toDate);

    if (siteIdParam) {
      // Validate recruiter access to specific site
      if (isRecruiter && siteIds && !siteIds.includes(siteIdParam)) {
        res.json({ data: dates.map((d) => ({ date: d, present: 0, absent: 0, late: 0 })) });
        return;
      }
      query = query.eq("site_id", siteIdParam);
    } else if (siteIds) {
      query = query.in("site_id", siteIds);
    }

    const { data: records } = await query;

    const statsMap = new Map<
      string,
      { date: string; present: number; absent: number; late: number }
    >();
    for (const d of dates) {
      statsMap.set(d, { date: d, present: 0, absent: 0, late: 0 });
    }

    for (const r of records || []) {
      const rec = r as { date: string; status: string };
      const entry = statsMap.get(rec.date);
      if (!entry) continue;
      if (rec.status === "present") entry.present++;
      else if (rec.status === "late") {
        entry.present++;
        entry.late++;
      } else if (rec.status === "absent") entry.absent++;
    }

    res.json({ data: Array.from(statsMap.values()) });
  },
);

/** GET /dashboard/recent-checkins */
router.get(
  "/dashboard/recent-checkins",
  async (req: Request, res: Response): Promise<void> => {
    const authed = await requireRole(req, res, ["admin", "recruiter"]);
    if (!authed) return;

    const isRecruiter = authed.roleName === "recruiter";
    const siteIds = isRecruiter
      ? await getRecruiterSiteIds(authed.userId)
      : null;

    const limit = Math.min(Number(req.query.limit) || 20, 50);

    let query = supabase
      .from("attendance")
      .select(
        `id, check_in_time, status,
         employees(employee_code, name, photo_url),
         sites(name)`,
      )
      .not("check_in_time", "is", null)
      .order("check_in_time", { ascending: false })
      .limit(limit);

    if (siteIds) query = query.in("site_id", siteIds);

    const { data: records, error } = await query;

    if (error) {
      res.status(500).json({ error: "Failed to fetch check-ins" });
      return;
    }

    type CheckinRow = {
      id: string;
      check_in_time: string;
      status: string;
      employees: { employee_code: string; name: string; photo_url?: string } | null;
      sites: { name: string } | null;
    };

    const mapped = (records || []).map((r) => {
      const row = r as unknown as CheckinRow;
      return {
        id: row.id,
        employee_name: row.employees?.name ?? "",
        employee_code: row.employees?.employee_code ?? "",
        site_name: row.sites?.name ?? "",
        check_in_time: row.check_in_time,
        status: row.status as "present" | "late",
        photo_url: row.employees?.photo_url ?? null,
      };
    });

    res.json({ data: mapped });
  },
);

export default router;
