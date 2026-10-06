import { createServer } from "node:http";
import app from "./app.js";
import config from "./config/index.js";
import { initSocketServer } from "./modules/socket/socket.service.js";
import { startReminderScheduler } from "./scheduler/reminderScheduler.js";

const httpServer = createServer(app);

initSocketServer(httpServer);
startReminderScheduler();

const server = httpServer.listen(config.port, () => {
	console.log(`DayPulse server listening on port ${config.port} in ${config.env} mode`);
});

const handleTermination = () => {
	console.log("Shutting down DayPulse server gracefully");
	server.close(() => {
		process.exit(0);
	});
};

process.on("SIGTERM", handleTermination);
process.on("SIGINT", handleTermination);
