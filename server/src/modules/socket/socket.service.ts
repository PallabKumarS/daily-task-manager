import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { type Socket, Server as SocketIOServer } from "socket.io";
import config from "../../config/index.js";
import type { AuthRequestUser } from "../../middlewares/auth.js";

let io: SocketIOServer | null = null;

export const initSocketServer = (httpServer: HttpServer): SocketIOServer => {
	io = new SocketIOServer(httpServer, {
		cors: {
			origin: "*",
			methods: ["GET", "POST"],
			credentials: true,
		},
	});

	// Authenticate socket connections
	io.use((socket: Socket, next) => {
		const token =
			socket.handshake.auth?.token ||
			socket.handshake.headers?.authorization?.replace("Bearer ", "");

		if (!token) {
			return next(new Error("Authentication token required for WebSocket"));
		}

		try {
			const decoded = jwt.verify(token, config.jwt.secret) as AuthRequestUser;
			socket.data.user = decoded;
			next();
		} catch {
			next(new Error("Invalid WebSocket authentication token"));
		}
	});

	io.on("connection", (socket: Socket) => {
		const user = socket.data.user as AuthRequestUser | undefined;
		if (user?.userId) {
			socket.join(`user:${user.userId}`);
		}

		socket.on("ping", () => {
			socket.emit("pong", { timestamp: Date.now() });
		});

		socket.on("disconnect", () => {
			// Client disconnected
		});
	});

	return io;
};

export const getIO = (): SocketIOServer => {
	if (!io) {
		throw new Error("Socket.io has not been initialized yet");
	}
	return io;
};

export const sendToUser = (userId: string, event: string, data: unknown): void => {
	if (io) {
		io.to(`user:${userId}`).emit(event, data);
	}
};

export const broadcastSyncUpdate = (
	userId: string,
	entityType: "routine" | "task" | "transaction" | "drive_sync" | "sync" | "tracker",
	action:
		| "create"
		| "update"
		| "delete"
		| "sync"
		| "connected"
		| "disconnected"
		| "upload"
		| "restore",
	data?: unknown,
): void => {
	sendToUser(userId, "sync:update", {
		entityType,
		action,
		data,
		timestamp: new Date().toISOString(),
	});
};

export const sendAlarmNotification = (
	userId: string,
	alarm: {
		id: string;
		title: string;
		message: string;
		type: "task" | "event" | "routine";
		leadMinutes?: number;
	},
): void => {
	sendToUser(userId, "notification:alarm", {
		...alarm,
		timestamp: new Date().toISOString(),
	});
};
