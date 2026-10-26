import Link from "next/link";
import { ComplianceGate } from "@/components/compliance-gate";
import { HowItWorks } from "@/components/how-it-works";
import { FILM_A, FILM_B, LandingFilm } from "@/components/landing-film";

export default function Home() {
  return (
    <main>
      <LandingFilm film={FILM_A} />
      <LandingFilm film={FILM_B} />

      <HowItWorks />

      <ComplianceGate />

      <section className="page landing-cta" aria-label="Get started">
        <div className="landing-cta-grid">
          <div>
            <div className="aud-tag aud-tag-business">For businesses</div>
            <h2 className="h2">Raise growth capital from verified investors.</h2>
            <Link href="/company" className="btn btn-primary btn-block">
              Raise for your business
            </Link>
          </div>
          <div>
            <div className="aud-tag aud-tag-investor">For investors</div>
            <h2 className="h2">Own a share of profitable private businesses.</h2>
            <Link href="/signin" className="btn btn-primary btn-block">
              Start investing
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
