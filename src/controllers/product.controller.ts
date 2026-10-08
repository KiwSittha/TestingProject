import { Response } from "express";
import { supabase } from "../config/supabase";
import { AuthRequest } from "../middleware/auth.middleware";

export async function getProducts(
  req: AuthRequest,
  res: Response
) {
  try {
    const { data: products, error } = await supabase
      .from("products")
      .select("*");

    console.log("Products:", products);
    console.log("Database error:", error);

    if (error) {
      return res.status(500).json({
        message: "Failed to get products"
      });
    }

    return res.status(200).json({
      products
    });

  } catch (error) {
    console.error("Get products error:", error);

    return res.status(500).json({
      message: "Internal server error"
    });
  }
}