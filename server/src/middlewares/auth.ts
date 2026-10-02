import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import config from "../config/index.js";
import { AppError } from "../errors/AppError.js";

export interface AuthRequestUser {
  userId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthRequestUser;
    }
  }
}

export const auth = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      let token: string | undefined;

      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
      }

      if (!token) {
        throw new AppError(401, "You are not authorized. Please log in.");
      }

      const decoded = jwt.verify(token, config.jwt.secret) as AuthRequestUser;
      req.user = decoded;
      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        next(new AppError(401, "Invalid authentication token."));
      } else if (error instanceof jwt.TokenExpiredError) {
        next(new AppError(401, "Authentication token expired."));
      } else {
        next(error);
      }
    }
  };
};
