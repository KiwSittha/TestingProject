import { Router } from "express";
import {
  authenticateToken,
  requireRole
} from "../middleware/auth.middleware";
import { addCartItem } from "../controllers/cart.controller";

const router = Router();

router.post(
  "/cart/items",
  authenticateToken,
  requireRole("Customer", "Admin"),
  addCartItem
);

export default router;