import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import projectsRouter from "./projects.js";
import bidsRouter from "./bids.js";
import subcontractsRouter from "./subcontracts.js";
import planFilesRouter from "./plan-files.js";
import storageRouter from "./storage.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/projects", projectsRouter);
router.use("/projects/:projectId/bids", bidsRouter);
router.use("/projects/:projectId/plan-files", planFilesRouter);
router.use("/subcontracts", subcontractsRouter);
router.use("/storage", storageRouter);

export default router;
