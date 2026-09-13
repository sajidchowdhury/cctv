/**
 * Language store — React Context + localStorage (doc §6).
 *
 * Shares language state across all components via Context.
 * The sidebar's toggle updates the context → all consumers re-render.
 */
"use client";
import { createContext, useContext, useState, useCallback, createElement, type ReactNode } from "react";
import { translate, type Language } from "@/lib/i18n";

const LANG_KEY = "cctv-lang";

type LangContextValue = {
  lang: Language;
  setLang: (l: Language) => void;
  toggle: () => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LangContextValue>({
  lang: "en",
  setLang: () => {},
  toggle: () => {},
  t: (key: string) => translate("en", key),
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(LANG_KEY) as Language | null;
        if (saved === "en" || saved === "bn") return saved;
      } catch {}
    }
    return "en";
  });

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    try { localStorage.setItem(LANG_KEY, l); } catch {}
  }, []);

  const toggle = useCallback(() => {
    setLangState((prev) => {
      const next = prev === "en" ? "bn" : "en";
      try { localStorage.setItem(LANG_KEY, next); } catch {}
      return next;
    });
  }, []);

  const t = (key: string) => translate(lang, key);

  return createElement(LanguageContext.Provider, { value: { lang, setLang, toggle, t } }, children);
}

export function useTranslation() {
  return useContext(LanguageContext);
}

// Alias for backward compat.
export const useLanguage = useTranslation;
