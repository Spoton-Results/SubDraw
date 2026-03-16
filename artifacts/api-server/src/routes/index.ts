import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import projectsRouter from "./projects.js";
import bidsRouter from "./bids.js";
import subcontractsRouter from "./subcontracts.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/projects", projectsRouter);
router.use("/projects/:projectId/bids", bidsRouter);
router.use("/subcontracts", subcontractsRouter);

export default router;
