import { Router } from "express";
import {
  authenticateToken,
  requireRole
} from "../middleware/auth.middleware";
import { getProducts } from "../controllers/product.controller";

const router = Router();

router.get(
  "/list",
  authenticateToken,
  requireRole("Customer", "Admin"),
  getProducts
);

export default router;