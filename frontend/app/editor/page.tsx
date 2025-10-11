// app/editor/page.tsx
import React, { Suspense } from "react";
import EditorClient from "./EditorClient";

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading editor...</div>}>
      <EditorClient />
    </Suspense>
  );
}
