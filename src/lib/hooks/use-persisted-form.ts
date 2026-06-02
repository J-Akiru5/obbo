"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export function usePersistedForm<T extends Record<string, unknown>>(
    key: string,
    initial: T,
): [T, (update: Partial<T> | ((prev: T) => T)) => void, () => void] {
    const [state, setState] = useState<T>(() => {
        if (typeof window === "undefined") return initial;
        try {
            const stored = sessionStorage.getItem(key);
            if (stored) {
                const parsed = JSON.parse(stored) as T;
                return { ...initial, ...parsed };
            }
        } catch {
            // ignore parse errors
        }
        return initial;
    });

    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => {
        if (typeof window === "undefined") return;
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            try {
                const serializable = { ...state };
                // Strip File objects — they can't be serialized
                for (const k of Object.keys(serializable)) {
                    if (serializable[k] instanceof File) {
                        (serializable as Record<string, unknown>)[k] = null;
                    }
                }
                sessionStorage.setItem(key, JSON.stringify(serializable));
            } catch {
                // storage full or blocked
            }
        }, 300);
        return () => clearTimeout(timerRef.current);
    }, [key, state]);

    const update = useCallback(
        (update: Partial<T> | ((prev: T) => T)) => {
            setState((prev) =>
                typeof update === "function" ? (update as (prev: T) => T)(prev) : { ...prev, ...update },
            );
        },
        [],
    );

    const clear = useCallback(() => {
        sessionStorage.removeItem(key);
        setState(initial);
    }, [key, initial]);

    return [state, update, clear];
}
