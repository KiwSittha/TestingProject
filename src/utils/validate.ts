import type { Request } from "express";
import { ApiError } from "./errors";

type Body = Record<string, unknown>;

export function getBody(req: Request): Body {
  const body: unknown = req.body;
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Body)
    : {};
}

export function getParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError("VALIDATION_ERROR", `Path parameter '${name}' is required`);
  }
  return value;
}

export function requireString(body: Body, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError("VALIDATION_ERROR", `'${key}' must be a non-empty string`);
  }
  return value.trim();
}

export function optionalString(body: Body, key: string): string | undefined {
  return body[key] === undefined ? undefined : requireString(body, key);
}

export function requireInteger(body: Body, key: string): number {
  const value = body[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new ApiError("VALIDATION_ERROR", `'${key}' must be an integer`);
  }
  return value;
}

export function optionalInteger(body: Body, key: string): number | undefined {
  return body[key] === undefined ? undefined : requireInteger(body, key);
}

// ถ้า body ส่ง id มาด้วย ต้องตรงกับ :id ใน path
export function assertMatchesPath(
  bodyValue: string | undefined,
  pathValue: string,
  key: string
) {
  if (bodyValue !== undefined && bodyValue !== pathValue) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `'${key}' in body does not match the id in the path`
    );
  }
}
