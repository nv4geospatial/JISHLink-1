import { Router, type IRouter, type Request, type Response } from "express";
import { supabase } from "../lib/supabase";
import {
  extractBearerToken,
  verifyEmployeeToken,
} from "../lib/auth";
import { haversineDistance, isWithinGeofence } from "../lib/geofence";

const router: IRouter = Router();

/** POST /attendance/scan — full QR scan validation pipeline */
router.post(
  "/attendance/scan",
  async (req: Request, res: Response): Promise<void> => {
    // 1. Authenticate employee
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const payload = verifyEmployeeToken(token);
    if (!payload) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    const { site_token, latitude, longitude, device_id } = req.body ?? {};

    if (!site_token || latitude == null || longitude == null || !device_id) {
      res
        .status(400)
        .json({ error: "Missing required fields", code: "INVALID_QR" });
      return;
    }

    // Use authoritative server time — never trust client-supplied timestamp
    // for shift-window and late/early-out decisions
    const now = new Date();
    const todayDateStr = now.toISOString().split("T")[0];

    // 2. Validate site token
    const { data: site, error: siteError } = await supabase
      .from("sites")
      .select(
        "id, name, latitude, longitude, geofence_radius_meters, client_id",
      )
      .eq("qr_token", site_token)
      .single();

    if (siteError || !site) {
      res
        .status(400)
        .json({ error: "This QR code is not recognized", code: "INVALID_QR" });
      return;
    }

    // 3. Verify employee is assigned to this site
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("id, employee_code, shift_id, site_id, name, status")
      .eq("id", payload.employee_id)
      .single();

    if (empError || !employee || employee.status !== "active") {
      res
        .status(401)
        .json({ error: "Employee not found or inactive", code: "NOT_ASSIGNED" });
      return;
    }

    if (employee.site_id !== site.id) {
      res.status(400).json({
        error: "You are not assigned to this site. Please move to your assigned site location or contact your supervisor.",
        code: "WRONG_SITE",
      });
      return;
    }

    // 4. Geofence check
    const distanceMeters = haversineDistance(
      latitude,
      longitude,
      site.latitude,
      site.longitude,
    );
    const withinGeofence = isWithinGeofence(
      latitude,
      longitude,
      site.latitude,
      site.longitude,
      site.geofence_radius_meters,
    );

    if (!withinGeofence) {
      res.status(400).json({
        error: `You are ${Math.round(distanceMeters)}m away from the site. Please move closer to the site entrance to check in.`,
        code: "OUTSIDE_GEOFENCE",
        distance_meters: Math.round(distanceMeters),
      });
      return;
    }

    // 5. Shift window check using server time
    const { data: shift } = await supabase
      .from("shift_master")
      .select("name, start_time, end_time, grace_minutes")
      .eq("id", employee.shift_id)
      .single();

    let attendanceStatus: "present" | "late" | "early_out" = "present";

    if (shift) {
      const [sh, sm] = shift.start_time.split(":").map(Number);
      const [eh, em] = shift.end_time.split(":").map(Number);
      const shiftStart = new Date(now);
      shiftStart.setHours(sh, sm, 0, 0);
      const shiftEnd = new Date(now);
      shiftEnd.setHours(eh, em, 0, 0);
      const graceEnd = new Date(
        shiftStart.getTime() + (shift.grace_minutes || 0) * 60000,
      );

      // Allow scanning 2 hours before shift start and up to 2 hours after shift end
      const windowStart = new Date(shiftStart.getTime() - 2 * 3600000);
      const windowEnd = new Date(shiftEnd.getTime() + 2 * 3600000);

      if (now < windowStart || now > windowEnd) {
        res.status(400).json({
          error: `Outside attendance window. Shift: ${shift.start_time} – ${shift.end_time}`,
          code: "OUTSIDE_SHIFT_WINDOW",
          shift_start: shift.start_time,
          shift_end: shift.end_time,
        });
        return;
      }

      if (now > graceEnd) attendanceStatus = "late";
    }

    // 6. Check existing attendance record for today
    // Select `status` so we can preserve it on check-out
    const { data: existing } = await supabase
      .from("attendance")
      .select("id, check_in_time, check_out_time, status")
      .eq("employee_id", employee.id)
      .eq("date", todayDateStr)
      .single();

    let action: "check_in" | "check_out";
    let attendanceId: string;

    if (!existing || !existing.check_in_time) {
      // Check in
      action = "check_in";
      const { data: inserted, error: insertError } = await supabase
        .from("attendance")
        .upsert({
          employee_id: employee.id,
          site_id: site.id,
          date: todayDateStr,
          check_in_time: now.toISOString(),
          check_in_lat: latitude,
          check_in_lng: longitude,
          device_id,
          status: attendanceStatus,
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        res.status(500).json({ error: "Failed to record attendance" });
        return;
      }
      attendanceId = inserted.id;
    } else if (!existing.check_out_time) {
      // Check out — preserve existing status unless it's worse now
      action = "check_out";
      const checkInTime = new Date(existing.check_in_time);
      const hoursWorked =
        (now.getTime() - checkInTime.getTime()) / 3600000;

      // Override to early_out only if worked < 6 hours AND not already flagged late
      let finalStatus: string = existing.status;
      if (hoursWorked < 6 && existing.status === "present") {
        finalStatus = "early_out";
      }

      const { error: updateError } = await supabase
        .from("attendance")
        .update({
          check_out_time: now.toISOString(),
          check_out_lat: latitude,
          check_out_lng: longitude,
          status: finalStatus,
        })
        .eq("id", existing.id);

      if (updateError) {
        res.status(500).json({ error: "Failed to record check-out" });
        return;
      }
      attendanceId = existing.id;
      attendanceStatus = finalStatus as "present" | "late" | "early_out";
    } else {
      res.status(400).json({
        error: "You have already checked in and out today",
        code: "ALREADY_CHECKED_OUT",
      });
      return;
    }

    res.json({
      success: true,
      action,
      status: attendanceStatus,
      site_name: site.name,
      time: now.toISOString(),
      attendance_id: attendanceId,
      distance_meters: Math.round(distanceMeters),
    });
  },
);

/**
 * GET /attendance/employee/:employeeId
 * Employee's own attendance history — authenticated by employee JWT.
 * Supports ?year=&month= for monthly filter, or ?limit= for recent N records.
 */
router.get(
  "/attendance/employee/:employeeId",
  async (req: Request, res: Response): Promise<void> => {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const payload = verifyEmployeeToken(token);
    if (!payload) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    // Employees can only fetch their own records
    if (payload.employee_id !== req.params.employeeId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const { year, month, limit } = req.query;

    let query = supabase
      .from("attendance")
      .select(
        "id, date, check_in_time, check_out_time, status, check_in_lat, check_in_lng, sites(name)",
      )
      .eq("employee_id", payload.employee_id);

    if (year && month) {
      const y = Number(year);
      const m = Number(month);
      const monthStr = String(m).padStart(2, "0");
      query = query
        .gte("date", `${y}-${monthStr}-01`)
        .lt(
          "date",
          m === 12
            ? `${y + 1}-01-01`
            : `${y}-${String(m + 1).padStart(2, "0")}-01`,
        );
    }

    query = query.order("date", { ascending: false });

    if (limit && !year) {
      query = query.limit(Math.min(Number(limit), 90));
    }

    const { data, error } = await query;

    if (error) {
      res.status(500).json({ error: "Failed to fetch attendance history" });
      return;
    }

    type HistRow = {
      id: string;
      date: string;
      check_in_time: string | null;
      check_out_time: string | null;
      status: string;
      check_in_lat: number | null;
      check_in_lng: number | null;
      sites: { name: string } | null;
    };

    const records = (data ?? []).map((r) => {
      const row = r as unknown as HistRow;
      return {
        id: row.id,
        date: row.date,
        check_in_time: row.check_in_time,
        check_out_time: row.check_out_time,
        status: row.status,
        site_name: row.sites?.name ?? null,
        check_in_lat: row.check_in_lat,
        check_in_lng: row.check_in_lng,
      };
    });

    res.json({ records });
  },
);

export default router;

