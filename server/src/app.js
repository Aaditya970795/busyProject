import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes.js";
import menuItemRoutes from "./routes/menuItem.routes.js";
import orderRoutes from "./routes/order.routes.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/menu-items", menuItemRoutes);
app.use("/api/orders", orderRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
