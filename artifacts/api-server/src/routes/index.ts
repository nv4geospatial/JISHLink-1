import "../lib/env";
import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import attendanceRouter from "./attendance";
import qrRouter from "./qr";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";
import clientsRouter from "./clients";
import employeesRouter from './employees';

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use('/employees', employeesRouter);
router.use(attendanceRouter);
router.use(qrRouter);
router.use(reportsRouter);
router.use(dashboardRouter);
router.use("/clients", clientsRouter);

export default router;
