import { Router } from "express";
import {
  authenticateToken,
  requireRole
} from "../middleware/auth.middleware";
import {
  listCoupons,
  setCouponStatus,
  setProductStatus,
  updateProduct
} from "../controllers/admin.controller";

const router = Router();

router.use("/admin", authenticateToken, requireRole("Admin"));

router.patch("/admin/products/:id/update", updateProduct); // OP-15
router.patch("/admin/products/:id/set", setProductStatus); // OP-16
router.patch("/admin/coupons/:id/set", setCouponStatus);   // OP-17
router.get("/admin/coupons", listCoupons);                 // OP-18

export default router;
