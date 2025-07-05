import type {
  CreateEnsureOptions,
  EnsureError,
  EnsureErrorData,
  EnsureOptions,
  EnsureResult,
  EnsureSuccess,
} from "./types";

export function createEnsure(options: CreateEnsureOptions = {}) {
  const {
    environment,
    onSuccess: onSuccessGlobal,
    onError: onErrorGlobal,
  } = options;

  function createStructuredError(
    cause: unknown,
    tag?: string,
    retryCount: number = 0,
    operation?: string
  ): EnsureErrorData {
    let message: string;
    
    if (cause instanceof Error) {
      message = cause.message;
    } else if (typeof cause === "string") {
      message = cause;
    } else {
      message = "An unknown error occurred";
    }

    return {
      cause,
      message,
      tag,
      retryCount,
      timestamp: Date.now(),
      operation,
    };
  }

  async function ensure<T>(
    fn: () => Promise<T>,
    options: EnsureOptions = {}
  ): Promise<EnsureResult<T>> {
    const {
      tag = undefined,
      retry = 0,
      retryDelay = 0,
      exponentialBackoff = false,
      timeout,
      onRetry = () => {},
      onSuccess: onSuccessLocal = undefined,
      onError: onErrorLocal = undefined,
    } = options;

    let retryCount = 0;
    let lastError: unknown;
    let structuredError: EnsureErrorData | undefined;

    const onSuccess = onSuccessLocal ?? onSuccessGlobal;
    const onError = onErrorLocal ?? onErrorGlobal;

    const env = environment || process.env.NODE_ENV;

    const executeWithTimeout = async (): Promise<T> => {
      // If we're not retrying, just run the function
      if (!timeout) return fn();

      return new Promise<T>((resolve, reject) => {
        const timeoutID = setTimeout(() => {
          reject(new Error(`Ensure: operation timed out after ${timeout}ms`));
        }, timeout);

        fn()
          .then((result) => {
            clearTimeout(timeoutID);
            resolve(result);
          })
          .catch((error) => {
            clearTimeout(timeoutID);
            reject(error);
          });
      });
    };

    for (let attempt = 0; attempt <= retry; attempt++) {
      try {
        const data = await executeWithTimeout();

        // Call `onSuccess` handler if provided
        if (onSuccess) {
          onSuccess({ tag, data, retryCount }).catch((error) => {
            if (env !== "production") {
              console.error("Ensure: error in 'onSuccess' handler:", error);
            }
          });
        }

        return {
          data,
          error: undefined,
          retryCount,
        } as EnsureSuccess<T>;
      } catch (error) {
        if (env !== "production") {
          console.error(error);
        }

        lastError = error;
        structuredError = createStructuredError(error, tag, retryCount);

        if (attempt < retry) {
          retryCount++;

          onRetry(retryCount, error);

          // Wait before retrying
          if (retryDelay > 0) {
            const delay = exponentialBackoff
              ? retryDelay * Math.pow(2, attempt)
              : retryDelay;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
    }

    // Create final structured error with correct retry count
    const finalStructuredError = createStructuredError(lastError, tag, retryCount);

    // Call `onError` handler if provided (global handler)
    if (onErrorGlobal) {
      onErrorGlobal({ tag, error: finalStructuredError, retryCount }).catch((error) => {
        if (env !== "production") {
          console.error("Ensure: error in 'onError' handler:", error);
        }
      });
    }

    // Call local onError handler if provided
    if (onErrorLocal) {
      onErrorLocal(finalStructuredError).catch((error) => {
        if (env !== "production") {
          console.error("Ensure: error in 'onError' handler:", error);
        }
      });
    }

    return {
      data: undefined,
      error: finalStructuredError,
      retryCount,
    } as EnsureError;
  }

  return ensure;
}
