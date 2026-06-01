import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable, subscriptionsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-key-123";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Authentication required" });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token" });
    req.user = user;
    next();
  });
};

export const checkSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: "Authentication required" });

  const [sub] = await db.select().from(subscriptionsTable).where(
    and(
      eq(subscriptionsTable.userId, req.user.id),
      eq(subscriptionsTable.status, "active"),
      gt(subscriptionsTable.endDate, new Date())
    )
  );

  if (!sub && req.user.role !== "admin") {
    return res.status(403).json({ error: "Active subscription required to use this feature" });
  }

  next();
};
