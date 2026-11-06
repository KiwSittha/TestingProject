import { Router } from "express";
import {
  authenticateToken,
  requireRole
} from "../middleware/auth.middleware";
import {
  addCartItem,
  applyCoupon,
  continueShopping,
  removeCartItem,
  updateCartItem,
  viewCart
} from "../controllers/cart.controller";
import { requireStage } from "../middleware/stage.middleware";

const router = Router();

router.use("/cart", authenticateToken, requireRole("Customer"));

router.post("/cart/items", requireStage("ตะกร้า"), addCartItem);          // OP-3
router.patch("/cart/items/:id", requireStage("ตะกร้า"), updateCartItem);  // OP-4
router.delete("/cart/items/:id", requireStage("ตะกร้า"), removeCartItem); // OP-5
router.put("/cart/items", requireStage("ตะกร้า"), applyCoupon);           // OP-6
router.get("/cart", viewCart);                    // OP-7
router.post("/cart/continue", requireStage("สำเร็จ"), continueShopping); // OP-12

export default router;
