import { Router } from "express";
import { db, usersTable, subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// Middleware to check if user is admin
const isAdmin = (req: any, res: any, next: any) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin access required" });
  next();
};

router.use(authenticateToken, isAdmin);

router.get("/users", async (req, res) => {
  const users = await db.select().from(usersTable);
  res.json(users);
});

router.post("/activate-subscription", async (req, res) => {
  const { userId, days, maxSessions, maxDailyMessages } = req.body;
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + (days || 30));

  try {
    await db.update(subscriptionsTable)
      .set({
        status: "active",
        startDate: new Date(),
        endDate: endDate,
        maxSessions: maxSessions || 1,
        maxDailyMessages: maxDailyMessages || 500
      })
      .where(eq(subscriptionsTable.userId, userId));
    
    res.json({ message: "Subscription activated successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to activate subscription" });
  }
});

export default router;
