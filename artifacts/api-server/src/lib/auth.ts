import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { serialize, parse } from "cookie";
import type { Request, Response } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-in-prod";
const COOKIE_NAME = "auth_token";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  companyName: string;
}

export function generateToken(user: TokenPayload): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, companyName: user.companyName },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function setAuthCookie(res: Response, token: string): void {
  res.setHeader(
    "Set-Cookie",
    serialize(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    })
  );
}

export function clearAuthCookie(res: Response): void {
  res.setHeader(
    "Set-Cookie",
    serialize(COOKIE_NAME, "", { httpOnly: true, maxAge: 0, path: "/" })
  );
}

export function getAuthUser(req: Request): TokenPayload | null {
  const cookies = parse(req.headers.cookie || "");
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifyToken(token);
}
