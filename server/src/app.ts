import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Application, type Request, type Response } from "express";
import { globalErrorHandler } from "./middlewares/globalErrorHandler.js";
import { applicationRoutes } from "./routes/index.js";

const app: Application = express();

app.use(
	cors({
		origin: (origin, callback) => callback(null, true),
		credentials: true,
	}),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const healthHandler = (_req: Request, res: Response) => {
	res.status(200).json({
		status: "ok",
		message: "DayPulse Core API is operational",
		timestamp: new Date().toISOString(),
	});
};

app.get("/health", healthHandler);
app.get("/api/v1/health", healthHandler);

app.use("/api/v1", applicationRoutes);

app.use((req: Request, res: Response) => {
	res.status(404).json({
		success: false,
		message: `API route not found: ${req.originalUrl}`,
	});
});

app.use(globalErrorHandler);

export default app;
