"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export type AuthView = "sign-in" | "sign-up" | "forgot-password";

interface AuthModalContextType {
  isOpen: boolean;
  view: AuthView;
  openAuthModal: (view?: AuthView) => void;
  closeAuthModal: () => void;
  setView: (view: AuthView) => void;
}

const AuthModalContext = createContext<AuthModalContextType | null>(null);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<AuthView>("sign-in");
  const router = useRouter();

  // ✅ 用 ref 稳定化，避免 effect 因引用变化而重复执行
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  const openAuthModal = useCallback((v: AuthView = "sign-in") => {
    setView(v);
    setIsOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => setIsOpen(false), []);

  // ✅ 统一的跨标签页 session 监听，提升到 Provider 层级
  // sign-up / sign-in 不再需要各自维护监听器
  useEffect(() => {
    const supabase = createClient();

    const checkSession = async () => {
      if (!isOpenRef.current) return; // modal 关着就不查
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setIsOpen(false);
        router.refresh();
      }
    };

    // 1. Supabase 原生状态变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session && isOpenRef.current) {
        setIsOpen(false);
        router.refresh();
      }
    });

    // 2. 页面可见性 + 焦点 — 兼容邮件验证场景
    const onVisible = () => {
      if (document.visibilityState === "visible") checkSession();
    };

    window.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", checkSession);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", checkSession);
    };
  }, [router]);

  return (
    <AuthModalContext.Provider
      value={{ isOpen, view, openAuthModal, closeAuthModal, setView }}
    >
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx)
    throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}