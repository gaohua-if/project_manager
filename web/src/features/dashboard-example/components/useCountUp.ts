import { useEffect, useRef, useState } from "react";

interface UseCountUpOptions {
  duration?: number;
  disabled?: boolean;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useCountUp(value: number, options?: UseCountUpOptions) {
  const duration = options?.duration ?? 760;
  const disabled = options?.disabled ?? false;
  const [displayValue, setDisplayValue] = useState(0);
  const previousValueRef = useRef(0);

  useEffect(() => {
    const previousValue = previousValueRef.current;
    previousValueRef.current = value;

    if (disabled || prefersReducedMotion() || previousValue === value) {
      const frame = window.requestAnimationFrame(() => setDisplayValue(value));
      return () => window.cancelAnimationFrame(frame);
    }

    let frame = 0;
    let startTime = 0;

    const tick = (time: number) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(previousValue + (value - previousValue) * eased);

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [disabled, duration, value]);

  return displayValue;
}
