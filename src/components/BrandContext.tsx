"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/client";

export type Brand = { id: string; name: string; created_at: number };

type Ctx = {
  brands: Brand[];
  current?: Brand;
  setCurrentId: (id: string) => void;
  createBrand: (name: string) => Promise<void>;
  renameBrand: (id: string, name: string) => Promise<void>;
  deleteBrand: (id: string) => Promise<void>;
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
      const stored = typeof window !== "undefined" ? localStorage.getItem("imagine-agent.brand") : null;
      if (stored && list.some((b) => b.id === stored)) return stored;
      return list[0]?.id ?? "";
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setCurrentId = (id: string) => {
    setCurrentIdState(id);
    if (typeof window !== "undefined") localStorage.setItem("imagine-agent.brand", id);
  };

  const createBrand = async (name: string) => {
    const b = await api<Brand>("/api/brands", { method: "POST", body: JSON.stringify({ name }) });
    await refresh();
    setCurrentId(b.id);
  };

  const renameBrand = async (id: string, name: string) => {
    await api(`/api/brands/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
    await refresh();
  };

  const deleteBrand = async (id: string) => {
    await api(`/api/brands/${id}`, { method: "DELETE" });
    if (id === currentId) setCurrentIdState("");
    await refresh();
  };

  const current = brands.find((b) => b.id === currentId);

  return (
    <BrandCtx.Provider value={{ brands, current, setCurrentId, createBrand, renameBrand, deleteBrand, refresh }}>
      {children}
    </BrandCtx.Provider>
  );
}

export function useBrand() {
  const ctx = useContext(BrandCtx);
  if (!ctx) throw new Error("useBrand must be used within BrandProvider");
  return ctx;
}
