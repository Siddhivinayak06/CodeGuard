// app/editor/page.js
import React, { Suspense } from "react";
import dynamic from "next/dynamic";

// dynamic import of client component with suspense enabled
const EditorClient = dynamic(() => import("./EditorClient"), {
  ssr: false,
  // note: ssr:false ensures the client code is not server-rendered; Suspense still good for UX
});

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading editor...</div>}>
      <EditorClient />
    </Suspense>
  );
}
