/**
 * Error codes for categorization and programmatic handling
 */
export enum ErrorCode {
  // User errors - display to user, usually recoverable
  InvalidInput = 'INVALID_INPUT',
  MissingConfig = 'MISSING_CONFIG',
  SkillNotFound = 'SKILL_NOT_FOUND',

  // System errors - log + display, may be recoverable
  FileReadError = 'FILE_READ_ERROR',
  FileWriteError = 'FILE_WRITE_ERROR',
  NetworkError = 'NETWORK_ERROR',
  ApiError = 'API_ERROR',
  ParseError = 'PARSE_ERROR',

  // Fatal errors - must abort
  CircularReference = 'CIRCULAR_REFERENCE',
  InvalidState = 'INVALID_STATE',
  ConfigCorruption = 'CONFIG_CORRUPTION',
}

/**
 * Base error class with cause chain support
 * Provides consistent error structure throughout the application
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Type guard for AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Helper to wrap unknown errors with context
 */
export function wrapError(
  error: unknown,
  code: ErrorCode,
  message: string
): AppError {
  const cause = error instanceof Error ? error : undefined;
  return new AppError(message, code, cause);
}
