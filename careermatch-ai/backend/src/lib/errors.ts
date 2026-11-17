export class AppError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: unknown) {
    super(message);
  }
}
export const badRequest = (m: string, d?: unknown) => new AppError(400, m, "BAD_REQUEST", d);
export const unauthorized = (m = "Authentication required") => new AppError(401, m, "UNAUTHORIZED");
export const forbidden = (m = "You do not have permission to do that") => new AppError(403, m, "FORBIDDEN");
export const notFound = (m = "Not found") => new AppError(404, m, "NOT_FOUND");
export const conflict = (m: string) => new AppError(409, m, "CONFLICT");
export const unavailable = (m: string, code = "SERVICE_UNAVAILABLE") => new AppError(503, m, code);
