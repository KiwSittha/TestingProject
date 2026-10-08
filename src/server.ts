import "dotenv/config";
import express from "express";
import authRoutes from "./routes/auth.routes";
import productRoutes from "./routes/product.routes";
import cartRoutes from "./routes/cart.routes";

const app = express();

app.use(express.json());

app.use("/", authRoutes);
app.use("/", productRoutes);
app.use("/", cartRoutes);

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});