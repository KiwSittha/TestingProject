<<<<<<< HEAD
import type { Request, Response } from "express";
import { supabase } from "../config/supabase";
import { dbCheck } from "../utils/errors";
import type { ProductRow } from "../types/db.types";
=======
import type { Response } from "express";
import { supabase } from "../config/supabase";
import type { AuthRequest } from "../middleware/auth.middleware";
>>>>>>> 27f31714b74e899d6ab14bfa3ed130a1bd3332cf

// OP-2 listProducts: GET /list
export async function getProducts(_req: Request, res: Response) {
  const products = dbCheck(
    await supabase
      .from("products")
      .select("*")
      .order("id")
      .returns<ProductRow[]>(),
    "List products"
  );

  res.status(200).json({ products });
}
