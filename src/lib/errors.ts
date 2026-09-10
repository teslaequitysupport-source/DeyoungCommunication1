// Standard API error shape and helpers. Route handlers throw ApiError and the
// wrapper in http.ts converts it into a consistent JSON response.

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (msg: string, details?: unknown) =>
  new ApiError(400, "BAD_REQUEST", msg, details);
export const unauthorized = (msg = "Authentication required") =>
  new ApiError(401, "UNAUTHORIZED", msg);
export const forbidden = (msg = "Insufficient permissions") =>
  new ApiError(403, "FORBIDDEN", msg);
export const notFound = (msg = "Resource not found") =>
  new ApiError(404, "NOT_FOUND", msg);
export const conflict = (msg: string) => new ApiError(409, "CONFLICT", msg);
export const tooMany = (msg = "Rate limit exceeded", retryAfterSec?: number) =>
  new ApiError(429, "RATE_LIMITED", msg, { retryAfterSec });
export const payloadTooLarge = (msg: string) =>
  new ApiError(413, "PAYLOAD_TOO_LARGE", msg);
export const unprocessable = (msg: string, details?: unknown) =>
  new ApiError(422, "UNPROCESSABLE", msg, details);
export const internal = (msg = "Internal server error") =>
  new ApiError(500, "INTERNAL", msg);
