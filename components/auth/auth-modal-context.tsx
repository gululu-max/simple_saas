"use client";

import { createContext, useContext, useState, ReactNode } from "react";

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

  const openAuthModal = (v: AuthView = "sign-in") => {
    setView(v);
    setIsOpen(true);
  };

  const closeAuthModal = () => setIsOpen(false);

  return (
    <AuthModalContext.Provider value={{ isOpen, view, openAuthModal, closeAuthModal, setView }}>
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}