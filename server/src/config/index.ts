import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const candidatePaths = [
  path.resolve(process.cwd(), "server", ".env"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../../../server/.env"),
  path.resolve(__dirname, "../../../.env"),
  path.resolve(__dirname, "../../.env"),
];

for (const p of candidatePaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
  }
}

export default {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  jwt: {
    secret: process.env.JWT_SECRET || "daypulse-server-jwt-secret-key-production-2026",
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  },
  vault: {
    secret: process.env.TOKEN_ENCRYPTION_SECRET || "daypulse-aes-gcm-secret-key-32-bytes-secure",
    algorithm: process.env.TOKEN_ENCRYPTION_ALGORITHM || "aes-256-gcm",
    rounds: Number(process.env.TOKEN_ENCRYPTION_ROUNDS) || 10000,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirectUri: process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/api/v1/sync/google/callback",
  },
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
};
