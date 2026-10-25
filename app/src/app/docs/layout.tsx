import type { Metadata } from "next";
import { DocsNav } from "@/components/docs";

export const metadata: Metadata = { title: { default: "Docs", template: "%s · dvdnd docs" } };

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="page docs">
      <div className="docs-layout">
        <DocsNav />
        <article className="docs-body">{children}</article>
      </div>
    </main>
  );
}
