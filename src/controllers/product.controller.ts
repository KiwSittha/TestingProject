import type { Request, Response } from "express";
import { supabase } from "../config/supabase";
import { dbCheck } from "../utils/errors";
import type { ProductRow } from "../types/db.types";

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
