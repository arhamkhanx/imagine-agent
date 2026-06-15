"use client";

import SubjectManager from "@/components/SubjectManager";

export default function ProductsPage() {
  return <SubjectManager kind="product" endpoint="/api/products" />;
}
