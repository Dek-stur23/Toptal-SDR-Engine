"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { signMeetingImageUrl } from "@/lib/storage/images";

// Module-level cache — a rendered thumbnail across cards should reuse
// the same signed URL until it expires. Keyed by storage path. TTL
// tracked alongside so we can refresh before it lapses.
const CACHE = new Map<string, { url: string; expiresAt: number }>();
const REFRESH_MARGIN_MS = 60 * 1000; // refresh 1 min before expiry

export function useImage(key: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!key) return null;
    const hit = CACHE.get(key);
    if (hit && hit.expiresAt > Date.now() + REFRESH_MARGIN_MS) return hit.url;
    return null;
  });

  useEffect(() => {
    let cancelled = false;
    if (!key) {
      setUrl(null);
      return;
    }
    const hit = CACHE.get(key);
    if (hit && hit.expiresAt > Date.now() + REFRESH_MARGIN_MS) {
      setUrl(hit.url);
      return;
    }
    const supabase = createClient();
    signMeetingImageUrl(supabase, key)
      .then((signed) => {
        if (cancelled) return;
        CACHE.set(key, {
          url: signed,
          expiresAt: Date.now() + 60 * 60 * 1000,
        });
        setUrl(signed);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return url;
}
