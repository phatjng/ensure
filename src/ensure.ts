import type {
  CreateEnsureOptions,
  EnsureError,
  EnsureOptions,
  EnsureResult,
  EnsureSuccess,
} from "./types";

export function createEnsure(options: CreateEnsureOptions = {}) {
  const { environment, onError: onErrorGlobal } = options;

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
      onError: onErrorLocal = undefined,
    } = options;

    let retryCount = 0;
    let lastError: unknown;
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

    // Call `onError` handler if provided
    if (onError) {
      onError({ tag, error: lastError, retryCount }).catch((error) => {
        if (env !== "production") {
          console.error("Ensure: error in 'onError' handler:", error);
        }
      });
    }

    return {
      data: undefined,
      error: lastError,
      retryCount,
    } as EnsureError;
  }

  return ensure;
}
