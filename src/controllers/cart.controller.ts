import { Request, Response } from "express";
import { supabase } from "../config/supabase";

export async function addCartItem(
  req: Request,
  res: Response
) {
  try {
    const { cart_id, product_id, quantity } = req.body;

    // ตรวจข้อมูล
    if (!cart_id || !product_id || !quantity) {
      return res.status(400).json({
        code: "INVALID_REQUEST",
        message: "cart_id, product_id and quantity are required"
      });
    }

    // ตรวจ quantity
    if (quantity <= 0) {
      return res.status(400).json({
        code: "INVALID_QUANTITY",
        message: "Quantity must be greater than 0"
      });
    }

    // เพิ่มสินค้าเข้าตะกร้า
    const { data, error } = await supabase
      .from("cart_items")
      .insert({
        cart_id: cart_id,
        product_id: product_id,
        quantity: quantity
      })
      .select()
      .single();

    if (error) {
      console.error("Add cart item error:", error);

      return res.status(500).json({
        message: "Failed to add item to cart"
      });
    }

    return res.status(201).json({
      message: "Item added to cart successfully",
      cartItem: data
    });

  } catch (error) {
    console.error("Add cart item error:", error);

    return res.status(500).json({
      message: "Internal server error"
    });
  }
}