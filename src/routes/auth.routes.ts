import { Router } from "express";
import { login, me } from "../controllers/auth.controller";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

router.post("/login", login);
router.get("/me", authenticateToken, me);

export default router;
