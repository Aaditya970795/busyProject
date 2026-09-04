import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes.js";
import menuItemRoutes from "./routes/menuItem.routes.js";
import orderRoutes from "./routes/order.routes.js";
import userRoutes from "./routes/user.routes.js";
import tableRoutes from "./routes/table.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import alertRoutes from "./routes/alert.routes.js";
import notificationRoutes from "./routes/notification.routes.js";

const app = express();

// If this is missing or doesn't exactly match the deployed client's origin (no trailing slash,
// exact protocol/host), the `cors` package silently omits Access-Control-Allow-Origin from every
// response — which browsers report as a generic "blocked by CORS policy" with no server-side clue
// at all. Logging it at boot means a misconfigured env var shows up here instead of only being
// diagnosable from the browser console.
if (!process.env.CLIENT_ORIGIN) {
  console.warn("[cors] CLIENT_ORIGIN is not set — no browser origin will be allowed through CORS.");
} else {
  console.log(`[cors] Allowing requests from CLIENT_ORIGIN=${process.env.CLIENT_ORIGIN}`);
}

app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/menu-items", menuItemRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/notifications", notificationRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
