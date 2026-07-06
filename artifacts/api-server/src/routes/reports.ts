import { Router, type IRouter, type Request, type Response } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { supabase } from "../lib/supabase";
import { requireRole, getRecruiterSiteIds } from "../lib/rbac";

const router: IRouter = Router();

type FetchParams = {
  date?: string;
  year?: number;
  month?: number;
  siteId?: string;
  employeeId?: string;
  /** When set, restrict results to these site IDs (recruiter scope) */
  siteIds?: string[];
};

async function fetchAttendanceRecords(params: FetchParams) {
  let query = supabase
    .from("attendance")
    .select(
      `id, employee_id, site_id, date, check_in_time, check_out_time, status, check_in_lat, check_in_lng,
       employees(employee_code, name, client_id),
       sites(name)`,
    );

  if (params.date) query = query.eq("date", params.date);
  if (params.siteId) query = query.eq("site_id", params.siteId);
  // Recruiter scope: restrict to their assigned sites unless a specific site override is within scope
  if (params.siteIds !== undefined) {
    // siteIds present means recruiter scope — deny by default when list is empty
    if (params.siteIds.length === 0) {
      // Recruiter has no assigned sites — return nothing
      query = query.eq("site_id", "00000000-0000-0000-0000-000000000000");
    } else if (params.siteId) {
      // Caller specified a siteId — validate it is within their allowed list
      if (!params.siteIds.includes(params.siteId)) {
        query = query.eq("site_id", "00000000-0000-0000-0000-000000000000");
      }
      // else: the .eq("site_id", params.siteId) applied above is already scoped
    } else {
      query = query.in("site_id", params.siteIds);
    }
  }
  if (params.employeeId) query = query.eq("employee_id", params.employeeId);
  if (params.year && params.month) {
    const monthStr = String(params.month).padStart(2, "0");
    query = query
      .gte("date", `${params.year}-${monthStr}-01`)
      .lt(
        "date",
        params.month === 12
          ? `${params.year + 1}-01-01`
          : `${params.year}-${String(params.month + 1).padStart(2, "0")}-01`,
      );
  }

  return query.order("date", { ascending: false });
}

type AttRow = {
  id: string;
  employee_id: string;
  site_id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  check_in_lat: number | null;
  check_in_lng: number | null;
  employees: { employee_code: string; name: string } | null;
  sites: { name: string } | null;
};

/** GET /reports/daily */
router.get(
  "/reports/daily",
  async (req: Request, res: Response): Promise<void> => {
    const authed = await requireRole(req, res, ["admin", "recruiter"]);
    if (!authed) return;

    const date = req.query.date as string;
    if (!date) {
      res.status(400).json({ error: "date is required" });
      return;
    }

    // Recruiters can only see their assigned sites
    const siteIds =
      authed.roleName === "recruiter"
        ? await getRecruiterSiteIds(authed.userId)
        : undefined;

    const { data: records, error } = await fetchAttendanceRecords({
      date,
      siteId: req.query.siteId as string | undefined,
      employeeId: req.query.employeeId as string | undefined,
      siteIds,
    });

    if (error) {
      res.status(500).json({ error: "Failed to fetch attendance" });
      return;
    }

    const mapped = (records || []).map((r) => {
      const row = r as unknown as AttRow;
      return {
        id: row.id,
        employee_id: row.employee_id,
        employee_code: row.employees?.employee_code ?? "",
        employee_name: row.employees?.name ?? "",
        site_id: row.site_id,
        site_name: row.sites?.name ?? "",
        date: row.date,
        check_in_time: row.check_in_time,
        check_out_time: row.check_out_time,
        status: row.status,
        check_in_lat: row.check_in_lat,
        check_in_lng: row.check_in_lng,
      };
    });

    const present = mapped.filter((r) =>
      ["present", "late"].includes(r.status),
    ).length;
    const late = mapped.filter((r) => r.status === "late").length;
    const earlyOut = mapped.filter((r) => r.status === "early_out").length;
    const absent = mapped.filter((r) => r.status === "absent").length;

    res.json({
      date,
      total: mapped.length,
      present,
      absent,
      late,
      early_out: earlyOut,
      records: mapped,
    });
  },
);

/** GET /reports/monthly */
router.get(
  "/reports/monthly",
  async (req: Request, res: Response): Promise<void> => {
    const authed = await requireRole(req, res, ["admin", "recruiter"]);
    if (!authed) return;

    const year = Number(req.query.year);
    const month = Number(req.query.month);

    if (!year || !month) {
      res.status(400).json({ error: "year and month are required" });
      return;
    }

    const siteIds =
      authed.roleName === "recruiter"
        ? await getRecruiterSiteIds(authed.userId)
        : undefined;

    const { data: records } = await fetchAttendanceRecords({
      year,
      month,
      siteId: req.query.siteId as string | undefined,
      employeeId: req.query.employeeId as string | undefined,
      siteIds,
    });

    type MonthRow = {
      employee_id: string;
      status: string;
      employees: { employee_code: string; name: string } | null;
    };

    const empMap = new Map<
      string,
      {
        employee_id: string;
        employee_code: string;
        employee_name: string;
        present_days: number;
        absent_days: number;
        late_days: number;
      }
    >();

    for (const r of records || []) {
      const rec = r as unknown as MonthRow;
      if (!empMap.has(rec.employee_id)) {
        empMap.set(rec.employee_id, {
          employee_id: rec.employee_id,
          employee_code: rec.employees?.employee_code ?? "",
          employee_name: rec.employees?.name ?? "",
          present_days: 0,
          absent_days: 0,
          late_days: 0,
        });
      }
      const entry = empMap.get(rec.employee_id)!;
      if (rec.status === "present") entry.present_days++;
      else if (rec.status === "late") {
        entry.present_days++;
        entry.late_days++;
      } else if (rec.status === "absent") entry.absent_days++;
    }

    const monthlyRecords = Array.from(empMap.values()).map((e) => ({
      ...e,
      attendance_percentage:
        e.present_days + e.absent_days > 0
          ? Math.round(
              (e.present_days / (e.present_days + e.absent_days)) * 100 * 10,
            ) / 10
          : 0,
    }));

    const daysInMonth = new Date(year, month, 0).getDate();

    res.json({
      year,
      month,
      working_days: daysInMonth,
      records: monthlyRecords,
    });
  },
);

/** GET /reports/export/excel */
router.get(
  "/reports/export/excel",
  async (req: Request, res: Response): Promise<void> => {
    const authed = await requireRole(req, res, ["admin", "recruiter"]);
    if (!authed) return;

    const siteIds =
      authed.roleName === "recruiter"
        ? await getRecruiterSiteIds(authed.userId)
        : undefined;

    const type = req.query.type as string;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "JISHLink";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Attendance Report");
    sheet.columns = [
      { header: "Employee Code", key: "employee_code", width: 16 },
      { header: "Employee Name", key: "employee_name", width: 24 },
      { header: "Site", key: "site_name", width: 20 },
      { header: "Date", key: "date", width: 14 },
      { header: "Check In", key: "check_in_time", width: 20 },
      { header: "Check Out", key: "check_out_time", width: 20 },
      { header: "Status", key: "status", width: 12 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0B3B63" },
    };

    const fetchParams: FetchParams = { siteIds };
    if (type === "daily") fetchParams.date = req.query.date as string;
    if (type === "monthly") {
      fetchParams.year = Number(req.query.year);
      fetchParams.month = Number(req.query.month);
    }
    fetchParams.siteId = req.query.siteId as string | undefined;
    fetchParams.employeeId = req.query.employeeId as string | undefined;

    type ExcelRow = {
      employees: { employee_code: string; name: string } | null;
      sites: { name: string } | null;
      date: string;
      check_in_time: string | null;
      check_out_time: string | null;
      status: string;
    };

    const { data: records } = await fetchAttendanceRecords(fetchParams);
    for (const r of records || []) {
      const rec = r as unknown as ExcelRow;
      sheet.addRow({
        employee_code: rec.employees?.employee_code ?? "",
        employee_name: rec.employees?.name ?? "",
        site_name: rec.sites?.name ?? "",
        date: rec.date,
        check_in_time: rec.check_in_time
          ? new Date(rec.check_in_time).toLocaleTimeString()
          : "-",
        check_out_time: rec.check_out_time
          ? new Date(rec.check_out_time).toLocaleTimeString()
          : "-",
        status: rec.status,
      });
    }

    const filename = `jishlink-attendance-${type}-${Date.now()}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    await workbook.xlsx.write(res);
    res.end();
  },
);

/** GET /reports/export/pdf */
router.get(
  "/reports/export/pdf",
  async (req: Request, res: Response): Promise<void> => {
    const authed = await requireRole(req, res, ["admin", "recruiter"]);
    if (!authed) return;

    const siteIds =
      authed.roleName === "recruiter"
        ? await getRecruiterSiteIds(authed.userId)
        : undefined;

    const type = req.query.type as string;
    const fetchParams: FetchParams = { siteIds };
    if (type === "daily") fetchParams.date = req.query.date as string;
    if (type === "monthly") {
      fetchParams.year = Number(req.query.year);
      fetchParams.month = Number(req.query.month);
    }
    fetchParams.siteId = req.query.siteId as string | undefined;
    fetchParams.employeeId = req.query.employeeId as string | undefined;

    const { data: records } = await fetchAttendanceRecords(fetchParams);

    const filename = `jishlink-attendance-${type}-${Date.now()}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    doc.pipe(res);

    // Header
    doc
      .fontSize(18)
      .fillColor("#0B3B63")
      .text("JISHLink Consulting India Private Limited", { align: "center" });
    doc
      .fontSize(12)
      .fillColor("#5C6B7A")
      .text(
        `Attendance Report — ${
          type === "daily"
            ? fetchParams.date
            : `${fetchParams.year}-${String(fetchParams.month).padStart(2, "0")}`
        }`,
        { align: "center" },
      );
    doc.moveDown();

    const cols = [
      { label: "Emp Code", x: 40, width: 80 },
      { label: "Name", x: 120, width: 120 },
      { label: "Site", x: 240, width: 100 },
      { label: "Date", x: 340, width: 70 },
      { label: "Check In", x: 410, width: 70 },
      { label: "Status", x: 480, width: 70 },
    ];

    const headerY = doc.y;
    doc.rect(40, headerY - 4, 520, 20).fill("#0B3B63");
    doc.fillColor("#FFFFFF").fontSize(9);
    for (const col of cols) {
      doc.text(col.label, col.x, headerY, { width: col.width });
    }
    doc.moveDown(0.5);

    type PdfRow = {
      employees: { employee_code: string; name: string } | null;
      sites: { name: string } | null;
      date: string;
      check_in_time: string | null;
      status: string;
    };

    let rowY = doc.y;
    doc.fillColor("#12233A").fontSize(8);
    for (const r of (records || []).slice(0, 100)) {
      const rec = r as unknown as PdfRow;
      if (rowY > 750) {
        doc.addPage();
        rowY = 40;
      }
      doc.text(rec.employees?.employee_code ?? "", 40, rowY, { width: 80 });
      doc.text(rec.employees?.name ?? "", 120, rowY, { width: 120 });
      doc.text(rec.sites?.name ?? "", 240, rowY, { width: 100 });
      doc.text(rec.date ?? "", 340, rowY, { width: 70 });
      doc.text(
        rec.check_in_time
          ? new Date(rec.check_in_time).toLocaleTimeString()
          : "-",
        410,
        rowY,
        { width: 70 },
      );
      doc.text(rec.status ?? "", 480, rowY, { width: 70 });
      rowY += 16;
    }

    doc.end();
  },
);

export default router;
