import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    "SESSION_SECRET environment variable is required but was not provided.",
  );
}

export interface EmployeeTokenPayload {
  employee_id: string;
  employee_code: string;
  site_id: string | null;
}

export function signEmployeeToken(payload: EmployeeTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: "7d" });
}

export function verifyEmployeeToken(
  token: string,
): EmployeeTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET!) as EmployeeTokenPayload;
  } catch {
    return null;
  }
}

export function extractBearerToken(
  authHeader: string | undefined,
): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}
