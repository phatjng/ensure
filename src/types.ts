export interface CreateEnsureOptions {
  environment?: "development" | "production" | "test";
  onError?: (context: {
    tag?: string;
    error: unknown;
    retryCount: number;
  }) => Promise<void>;
}

export interface EnsureOptions {
  tag?: string;
  retry?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
  timeout?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

export type EnsureSuccess<T> = {
  data: T;
  error: undefined;
  retryCount: number;
};

export type EnsureError = {
  data: undefined;
  error: unknown;
  retryCount: number;
};

export type EnsureResult<T> = EnsureSuccess<T> | EnsureError;
