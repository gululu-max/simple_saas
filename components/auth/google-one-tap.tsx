"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Script from "next/script";
import { createClient } from "@/utils/supabase/client";

const BLOCKED_PATH_PREFIXES = [
  "/auth/callback",
  "/reset-password",
  "/subscribe/scanner",
];

const GSI_SRC = "https://accounts.google.com/gsi/client";
const SCRIPT_READY_EVENT = "__one-tap-gsi-ready";

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function GoogleOneTap() {
  const pathname = usePathname();
  const router = useRouter();
  const initializedRef = useRef(false);

  const isBlockedPath = BLOCKED_PATH_PREFIXES.some((p) =>
    pathname?.startsWith(p),
  );

  useEffect(() => {
    if (isBlockedPath) {
      if (initializedRef.current && window.google?.accounts?.id) {
        window.google.accounts.id.cancel();
      }
      return;
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    let cancelled = false;

    const tryInit = async () => {
      if (cancelled) return;
      if (!window.google?.accounts?.id) return;
      if (initializedRef.current) return;

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || session) return;

      const rawNonce = crypto.randomUUID();
      const hashedNonce = await sha256Hex(rawNonce);
      if (cancelled) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential: string }) => {
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: response.credential,
            nonce: rawNonce,
          });
          if (error) {
            console.error("[OneTap] signInWithIdToken failed:", error.message);
            return;
          }
          window.dispatchEvent(new Event("auth-changed"));
          router.refresh();
        },
        nonce: hashedNonce,
        use_fedcm_for_prompt: true,
        auto_select: false,
        cancel_on_tap_outside: false,
      });

      initializedRef.current = true;
      window.google.accounts.id.prompt();
    };

    // Try once immediately (script may already be loaded on SPA navigation)
    tryInit();
    // And re-try when the script signals ready
    const onScriptReady = () => tryInit();
    window.addEventListener(SCRIPT_READY_EVENT, onScriptReady);

    // If user signs in via the regular auth modal, hide One Tap
    const onAuthChanged = () => {
      if (initializedRef.current && window.google?.accounts?.id) {
        window.google.accounts.id.cancel();
      }
    };
    window.addEventListener("auth-changed", onAuthChanged);

    return () => {
      cancelled = true;
      window.removeEventListener(SCRIPT_READY_EVENT, onScriptReady);
      window.removeEventListener("auth-changed", onAuthChanged);
    };
  }, [pathname, isBlockedPath, router]);

  if (isBlockedPath) return null;
  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return null;

  return (
    <Script
      src={GSI_SRC}
      strategy="afterInteractive"
      onReady={() => {
        window.dispatchEvent(new Event(SCRIPT_READY_EVENT));
      }}
    />
  );
}
