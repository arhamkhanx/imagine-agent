"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/client";

export type Brand = { id: string; name: string; created_at: number };

type Ctx = {
  brands: Brand[];
  current?: Brand;
  setCurrentId: (id: string) => void;
  createBrand: (name: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const BrandCtx = createContext<Ctx | null>(null);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [currentId, setCurrentIdState] = useState<string>("");

  const refresh = useCallback(async () => {
    const list = await api<Brand[]>("/api/brands");
    setBrands(list);
    setCurrentIdState((prev) => {
      if (prev && list.some((b) => b.id === prev)) return prev;
      const stored = typeof window !== "undefined" ? localStorage.getItem("kive.brand") : null;
      if (stored && list.some((b) => b.id === stored)) return stored;
      return list[0]?.id ?? "";
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setCurrentId = (id: string) => {
    setCurrentIdState(id);
    if (typeof window !== "undefined") localStorage.setItem("kive.brand", id);
  };

  const createBrand = async (name: string) => {
    const b = await api<Brand>("/api/brands", { method: "POST", body: JSON.stringify({ name }) });
    await refresh();
    setCurrentId(b.id);
  };

  const current = brands.find((b) => b.id === currentId);

  return (
    <BrandCtx.Provider value={{ brands, current, setCurrentId, createBrand, refresh }}>
      {children}
    </BrandCtx.Provider>
  );
}

export function useBrand() {
  const ctx = useContext(BrandCtx);
  if (!ctx) throw new Error("useBrand must be used within BrandProvider");
  return ctx;
}
