import { useCallback, useRef, useEffect } from "react";

/**
 * Returns a callback that, when called, runs after the given delay (ms).
 * If called again before the delay, the previous invocation is cancelled.
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
    callback: T,
    delayMs: number,
): T {
    const callbackRef = useRef(callback);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastArgsRef = useRef<Parameters<T> | null>(null);

    callbackRef.current = callback;

    const flush = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        if (lastArgsRef.current !== null) {
            const args = lastArgsRef.current;
            lastArgsRef.current = null;
            callbackRef.current(...args);
        }
    }, []);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const debounced = useCallback(
        (...args: Parameters<T>) => {
            lastArgsRef.current = args;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(flush, delayMs);
        },
        [delayMs, flush],
    ) as T;

    return debounced;
}
