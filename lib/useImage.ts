"use client";

import { useEffect, useState } from "react";
import { loadImage, peekImageFromCache } from "./imageStore";

// Returns the displayable data URL for an opaque image ref. Inline data
// URLs return synchronously; IDB refs return null on the first render and
// flip to the data URL once IDB resolves (unless the cache already has it,
// in which case the first render returns it synchronously too).
export function useImage(ref: string | null | undefined): string | null {
  // Synchronous initial value so we don't flicker for inline data URLs or
  // cache hits.
  const [src, setSrc] = useState<string | null>(() => peekImageFromCache(ref));

  useEffect(() => {
    if (!ref) {
      setSrc(null);
      return;
    }
    const peek = peekImageFromCache(ref);
    if (peek !== null) {
      setSrc(peek);
      return;
    }
    let cancelled = false;
    loadImage(ref).then(
      (resolved) => {
        if (!cancelled) setSrc(resolved);
      },
      () => {
        if (!cancelled) setSrc(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [ref]);

  return src;
}
