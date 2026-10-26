import Link from "next/link";
import { HowItWorks } from "@/components/how-it-works";
import { FILM_A, FILM_B, LandingFilm } from "@/components/landing-film";

export default function Home() {
  return (
    <main>
      <LandingFilm film={FILM_A} />
      <LandingFilm film={FILM_B} />

      <HowItWorks />

      <section className="page landing-compliance" aria-labelledby="compliance-title">
        <div className="label">Compliance</div>
        <h2 id="compliance-title" className="h1">Built for Reg D 506(c) and Reg S.</h2>
        <p className="muted" style={{ fontSize: 16, maxWidth: 680 }}>
          For US and non-US businesses, and for US and non-US investors. Accredited US investors are verified under
          Rule 506(c). Non-US investors prove residence under Regulation S. Tokens can only be held by verified wallets.
        </p>
        <p className="small" style={{ maxWidth: 680 }}>
          Nothing on this site is an offer to sell, or a solicitation of an offer to buy, any security. Offerings are made
          only to eligible investors through each issuer&apos;s own offering documents.
        </p>
      </section>

      <section className="page landing-cta" aria-label="Get started">
        <div className="landing-cta-grid">
          <div>
            <div className="label">For businesses</div>
            <h2 className="h2">Raise growth capital from verified investors.</h2>
            <Link href="/company" className="btn btn-primary btn-block">
              Raise for your business
            </Link>
          </div>
          <div>
            <div className="label">For investors</div>
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
