import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import sessionsRouter from "./sessions";
import contactsRouter from "./contacts";
import templatesRouter from "./templates";
import campaignsRouter from "./campaigns";
import analyticsRouter from "./analytics";
import adminRouter from "./admin";
import { authenticateToken, checkSubscription } from "../middleware/auth";

const router: IRouter = Router();

// Public routes
router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/admin", adminRouter);

// Protected routes - require login
router.use(authenticateToken);

// Business routes - require active subscription
router.use(checkSubscription);
router.use(sessionsRouter);
router.use(contactsRouter);
router.use(templatesRouter);
router.use(campaignsRouter);
router.use(analyticsRouter);

export default router;
