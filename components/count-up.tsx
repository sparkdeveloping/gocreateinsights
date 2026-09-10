"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

export default function CountUp({ value, formatter = (n) => Math.round(n).toLocaleString("en-US") }: { value: number; formatter?: (value: number) => string }) {
  const reduceMotion = useReducedMotion();
  const previous = useRef(value);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      previous.current = value;
      return;
    }
    const from = previous.current;
    const delta = value - from;
    const started = performance.now();
    const duration = 420;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + delta * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else previous.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduceMotion]);

  return <>{formatter(display)}</>;
}
