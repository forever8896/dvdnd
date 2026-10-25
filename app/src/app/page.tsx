import Link from "next/link";
import { LandingFilm } from "@/components/landing-film";

export default function Home() {
  return (
    <main>
      <LandingFilm />

      <section className="page">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/discover" className="btn btn-primary btn-wide">
            Discover raises
          </Link>
          <Link href="/signin" className="btn btn-secondary btn-wide">
            Raise for your company
          </Link>
          <Link href="/docs" className="btn btn-link">
            How it works →
          </Link>
        </div>
      </section>
    </main>
  );
}
