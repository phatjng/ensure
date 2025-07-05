export interface CreateEnsureOptions {
  environment?: "development" | "production" | "test";
  onSuccess?: (context: {
    tag?: string;
    data: unknown;
    retryCount: number;
  }) => Promise<void>;
  onError?: (context: {
    tag?: string;
    error: EnsureErrorData;
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
  onSuccess?: () => Promise<void>;
  onError?: (error: EnsureErrorData) => Promise<void>;
}

export interface EnsureErrorData {
  cause: unknown;
  message: string;
  tag?: string;
  retryCount: number;
  timestamp: number;
  operation?: string;
}

export type EnsureSuccess<T> = {
  data: T;
  error: undefined;
  retryCount: number;
};

export type EnsureError = {
  data: undefined;
  error: EnsureErrorData;
  retryCount: number;
};

export type EnsureResult<T> = EnsureSuccess<T> | EnsureError;
