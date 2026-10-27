import { Router } from "express";
import {
  authenticateToken,
  requireRole
} from "../middleware/auth.middleware";
import {
  cancelOrder,
  listOrders,
  orderPayment,
  viewOrder
} from "../controllers/order.controller";

const router = Router();

router.use("/orders", authenticateToken, requireRole("Customer"));

router.post("/orders/:id/payment", orderPayment); // OP-8, OP-10, OP-11
router.post("/orders/:id/cancel", cancelOrder);   // OP-9
router.get("/orders", listOrders);                // OP-13
router.get("/orders/:id", viewOrder);             // OP-14

export default router;
