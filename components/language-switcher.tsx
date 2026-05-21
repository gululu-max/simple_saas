"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { LOCALES, type Locale } from "@/lib/i18n/config";

const LABELS: Record<Locale, string> = {
  en: "English",
  ja: "日本語",
};

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, dict } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={dict.header.language}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-btn text-sm font-medium text-ink-muted hover:text-ink hover:bg-surface-soft transition-colors"
      >
        <Globe className="w-4 h-4" />
        <span>{LABELS[locale]}</span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-2 min-w-[140px] bg-canvas border border-hairline rounded-card shadow-ab-card p-1 z-50"
        >
          {LOCALES.map((code) => {
            const selected = code === locale;
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setOpen(false);
                  setLocale(code);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-btn transition-colors ${
                  selected
                    ? "text-ink bg-surface-soft"
                    : "text-ink-body hover:bg-surface-soft hover:text-ink"
                }`}
              >
                <span>{LABELS[code]}</span>
                {selected && <Check className="w-4 h-4 text-rausch" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
