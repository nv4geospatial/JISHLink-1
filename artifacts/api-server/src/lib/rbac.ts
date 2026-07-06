import type { Request, Response } from "express";
import { supabase } from "./supabase";
import { extractBearerToken } from "./auth";

export type RoleName = "admin" | "recruiter" | "employee";

export interface AuthenticatedUser {
  userId: string;
  roleName: RoleName;
}

/**
 * Verify a Supabase session token and look up the user's role.
 * Returns the authenticated user or sends a 401/403 and returns null.
 */
export async function requireRole(
  req: Request,
  res: Response,
  allowedRoles: RoleName[],
): Promise<AuthenticatedUser | null> {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }

  const { data: authData, error: authError } =
    await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    res.status(401).json({ error: "Invalid or expired session" });
    return null;
  }

  const userId = authData.user.id;

  // Look up role — deny by default if row is missing or role is malformed
  const { data: userRow, error: roleError } = await supabase
    .from("users")
    .select("role_id, roles(name)")
    .eq("id", userId)
    .single();

  if (roleError || !userRow) {
    res
      .status(403)
      .json({ error: "User account has no role assigned — contact admin" });
    return null;
  }

  // Cast via unknown to avoid TS overlap errors with Supabase's inferred type
  const roleRow = userRow as unknown as { roles?: { name: string } };
  const roleName = roleRow.roles?.name as RoleName | undefined;

  if (!roleName || !allowedRoles.includes(roleName)) {
    res.status(403).json({
      error: `Access denied. Required role: ${allowedRoles.join(" or ")}. Your role: ${roleName ?? "none"}`,
    });
    return null;
  }

  return { userId, roleName };
}

/**
 * For a recruiter, return the list of site IDs they are assigned to.
 * Admins should not call this — pass their queries unfiltered.
 */
export async function getRecruiterSiteIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("sites")
    .select("id")
    .eq("assigned_recruiter_id", userId);

  if (error || !data) return [];
  return data.map((s: { id: string }) => s.id);
}

/**
 * Verify a Supabase session token and return the authenticated user's role.
 * Does NOT send a response — caller decides what to do with null.
 */
export async function getAuthenticatedUser(
  req: Request,
): Promise<AuthenticatedUser | null> {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) return null;

  const { data: authData, error } = await supabase.auth.getUser(token);
  if (error || !authData.user) return null;

  const userId = authData.user.id;

  const { data: userRow } = await supabase
    .from("users")
    .select("role_id, roles(name)")
    .eq("id", userId)
    .single();

  const roleRow = userRow as unknown as { roles?: { name: string } } | null;
  const roleName = roleRow?.roles?.name as RoleName | undefined;

  if (!roleName) return null;
  return { userId, roleName };
}
