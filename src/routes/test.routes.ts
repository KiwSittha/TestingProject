import { Router } from "express";
import { resetTestData } from "../controllers/test.controller";

const router = Router();

router.post("/test/reset", resetTestData);

export default router;