export class LeanvoxError extends Error {
  code: string;
  statusCode: number;
  body?: unknown;

  constructor(message: string, code: string, statusCode: number, body?: unknown) {
    super(message);
    this.name = "LeanvoxError";
    this.code = code;
    this.statusCode = statusCode;
    this.body = body;
  }
}

export class InvalidRequestError extends LeanvoxError {
  constructor(message: string, code = "invalid_request", body?: unknown) {
    super(message, code, 400, body);
    this.name = "InvalidRequestError";
  }
}

export class AuthenticationError extends LeanvoxError {
  constructor(message: string, code = "invalid_api_key", body?: unknown) {
    super(message, code, 401, body);
    this.name = "AuthenticationError";
  }
}

export class InsufficientBalanceError extends LeanvoxError {
  balanceCents?: number;

  constructor(message: string, code = "insufficient_balance", body?: unknown, balanceCents?: number) {
    super(message, code, 402, body);
    this.name = "InsufficientBalanceError";
    this.balanceCents = balanceCents;
  }
}

export class NotFoundError extends LeanvoxError {
  constructor(message: string, code = "not_found", body?: unknown) {
    super(message, code, 404, body);
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends LeanvoxError {
  retryAfter?: number;

  constructor(message: string, code = "rate_limit_exceeded", body?: unknown, retryAfter?: number) {
    super(message, code, 429, body);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class ServerError extends LeanvoxError {
  constructor(message: string, code = "server_error", body?: unknown) {
    super(message, code, 500, body);
    this.name = "ServerError";
  }
}

export class StreamingFormatError extends InvalidRequestError {
  constructor(message = "Streaming is only supported for MP3 format") {
    super(message, "streaming_format_error");
    this.name = "StreamingFormatError";
  }
}

const STATUS_MAP: Record<number, new (message: string, code?: string, body?: unknown) => LeanvoxError> = {
  400: InvalidRequestError,
  401: AuthenticationError,
  404: NotFoundError,
  500: ServerError,
};

export function raiseForStatus(status: number, body: unknown): never {
  const parsed = body as { error?: { message?: string; code?: string; balance_cents?: number; retry_after?: number } };
  const errData = parsed?.error;
  const message = errData?.message ?? `API error (status ${status})`;
  const code = errData?.code ?? "unknown";

  if (status === 402) {
    throw new InsufficientBalanceError(message, code, body, errData?.balance_cents);
  }

  if (status === 429) {
    throw new RateLimitError(message, code, body, errData?.retry_after);
  }

  const ErrorClass = STATUS_MAP[status];
  if (ErrorClass) {
    throw new ErrorClass(message, code, body);
  }

  throw new LeanvoxError(message, code, status, body);
}
