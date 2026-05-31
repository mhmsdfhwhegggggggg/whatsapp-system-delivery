import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sessionsRouter from "./sessions";
import contactsRouter from "./contacts";
import templatesRouter from "./templates";
import campaignsRouter from "./campaigns";
import analyticsRouter from "./analytics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sessionsRouter);
router.use(contactsRouter);
router.use(templatesRouter);
router.use(campaignsRouter);
router.use(analyticsRouter);

export default router;
