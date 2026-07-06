import type { Request, Response, NextFunction } from "express";
import { requireRole, getAuthenticatedUser } from "../lib/rbac";
import type { RoleName, AuthenticatedUser } from "../lib/rbac";

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

export function requireAuth(allowedRoles: RoleName[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await requireRole(req, res, allowedRoles);
    if (!user) return;
    req.authUser = user;
    next();
  };
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const user = await getAuthenticatedUser(req);
  if (user) req.authUser = user;
  next();
}