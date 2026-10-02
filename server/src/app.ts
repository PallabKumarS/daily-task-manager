import express, { Application, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { applicationRoutes } from "./routes/index.js";
import { globalErrorHandler } from "./middlewares/globalErrorHandler.js";

const app: Application = express();

app.use(
  cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    message: "DayPulse Core API is operational",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/v1", applicationRoutes);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.originalUrl}`,
  });
});

app.use(globalErrorHandler);

export default app;
