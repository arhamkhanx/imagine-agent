"use client";

import SubjectManager from "@/components/SubjectManager";

export default function FacesPage() {
  return <SubjectManager kind="face" endpoint="/api/faces" />;
}
