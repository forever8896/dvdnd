import { describe, expect, it } from "vitest";
import { residenceFromDecision, type Decision } from "./didit";

const ADDRESS = "GCJF7KYN6UKJEFTW3AZBJ6S2YWOBMJKGNFPIA6KHKKIXICLW52YYQ7K7";

// Shaped like Didit's documented /v3/session/{id}/decision/ response.
const decision = (over: Partial<Decision> = {}): Decision => ({
  session_id: "4c5c7f3a-1f82-4f3b-8d8e-1a8d2d2f9b7a",
  status: "APPROVED",
  vendor_data: ADDRESS,
  id_verifications: [
    {
      status: "Approved",
      issuing_state: "ESP",
      document_number: "CAA000000",
      parsed_address: { country: "ES", category: "Residential", is_verified: true },
    },
  ],
  poa_verifications: null,
  aml_screenings: [{ status: "Approved" }],
  ...over,
});

describe("residence from a Didit decision", () => {
  it("prefers an approved proof of address", () => {
    const r = residenceFromDecision(
      decision({ poa_verifications: [{ status: "Approved", poa_parsed_address: { country: "PT" } }] }),
      ADDRESS,
      false,
    );
    expect(r).toEqual({ country: 620, basis: "proof of address", documentId: "ESP:CAA000000" });
  });

  it("uses a verified residential address on the ID", () => {
    expect(residenceFromDecision(decision(), ADDRESS, false)).toMatchObject({ country: 724, basis: "address on ID" });
  });

  it("falls back to the document's country on testnet only", () => {
    const d = decision({ id_verifications: [{ status: "Approved", issuing_state: "DEU", document_number: "X1" }] });
    expect(residenceFromDecision(d, ADDRESS, true)).toMatchObject({ country: 276, basis: "ID document" });
    expect(() => residenceFromDecision(d, ADDRESS, false)).toThrow(/no verified residential address/);
  });

  it("treats a US document or US nationality as US residence", () => {
    const usPassport = decision({ id_verifications: [{ status: "Approved", issuing_state: "USA", document_number: "P1" }] });
    expect(residenceFromDecision(usPassport, ADDRESS, false)).toMatchObject({ country: 840, basis: "US document" });
    // Even with a non-US proof of address.
    const abroad = decision({
      id_verifications: [{ status: "Approved", issuing_state: "DEU", nationality: "USA", document_number: "R1" }],
      poa_verifications: [{ status: "Approved", poa_parsed_address: { country: "PT" } }],
    });
    expect(residenceFromDecision(abroad, ADDRESS, false)).toMatchObject({ country: 840 });
  });

  it("refuses unapproved, foreign or sanctioned verifications", () => {
    expect(() => residenceFromDecision(decision({ status: "In Review" }), ADDRESS)).toThrow(/still reviewing/);
    expect(() => residenceFromDecision(decision({ status: "Declined" }), ADDRESS)).toThrow(/didn't approve/);
    expect(() => residenceFromDecision(decision(), "GOTHER")).toThrow(/different wallet/);
    expect(() => residenceFromDecision(decision({ aml_screenings: [{ status: "Declined" }] }), ADDRESS)).toThrow(/sanctions/);
  });
});
