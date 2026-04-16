"use client";

import { useState, useCallback } from "react";

/**
 * Generic wrapper for next-safe-action server actions.
 * Provides loading, error, and data state management.
 *
 * Usage:
 * ```ts
 * const { execute, data, loading, error } = useServerAction(getCats);
 * // Then: execute({ color: "Black" })
 * ```
 */
export function useServerAction<TInput, TData>(
  action: (input: TInput) => Promise<{
    data?: TData;
    serverError?: string;
    validationErrors?: Record<string, { _errors: string[] }>;
  }>,
) {
  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (input: TInput): Promise<TData | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await action(input);
        if (result.serverError) {
          setError(result.serverError);
          return null;
        }
        if (result.validationErrors) {
          const messages = Object.entries(result.validationErrors)
            .map(([field, err]) => `${field}: ${err._errors.join(", ")}`)
            .join("; ");
          setError(messages);
          return null;
        }
        setData(result.data ?? null);
        return result.data ?? null;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [action],
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { execute, data, loading, error, reset };
}

/**
 * Wrapper for bound server actions (editCat.bind(null, id)).
 * These actions don't take input — they return the already-bound action result.
 */
export function useBoundServerAction<TData>(
  action: () => Promise<{
    data?: TData;
    serverError?: string;
    validationErrors?: Record<string, { _errors: string[] }>;
  }>,
) {
  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (): Promise<TData | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await action();
      if (result.serverError) {
        setError(result.serverError);
        return null;
      }
      setData(result.data ?? null);
      return result.data ?? null;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [action]);

  return { execute, data, loading, error };
}
