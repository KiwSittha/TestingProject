import { Router } from "express";
import {
  authenticateToken,
  requireRole
} from "../middleware/auth.middleware";
import {
  addCartItem,
  applyCoupon,
  removeCartItem,
  updateCartItem,
  viewCart
} from "../controllers/cart.controller";

const router = Router();

router.use("/cart", authenticateToken, requireRole("Customer"));

router.post("/cart/items", addCartItem);          // OP-3
router.patch("/cart/items/:id", updateCartItem);  // OP-4
router.delete("/cart/items/:id", removeCartItem); // OP-5
router.put("/cart/items", applyCoupon);           // OP-6
router.get("/cart", viewCart);                    // OP-7, OP-12

export default router;
