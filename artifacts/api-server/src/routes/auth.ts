import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db, usersTable, subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-key-123";

router.post("/register", async (req, res) => {
  const { email, password, name } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({
      email,
      passwordHash: hashedPassword,
      name,
    }).returning();

    // Create a trial subscription for new users (optional)
    await db.insert(subscriptionsTable).values({
      userId: user.id,
      status: "inactive", // Needs admin approval or payment
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    res.status(201).json({ message: "User registered successfully. Waiting for admin approval." });
  } catch (err) {
    res.status(500).json({ error: "Email already exists or registration failed" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

export default router;
