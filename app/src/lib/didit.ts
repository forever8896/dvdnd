// Didit identity verification (server only). A session runs Didit's hosted
// check (ID document, liveness, face match, proof of address, AML screening)
// for one Stellar address; afterwards we read the decision from Didit's API
// and take the verified country of residence from it. Only the country and a
// hash of the ID document leave this module.

import "server-only";
import { IS_TESTNET } from "./config";
import { countryCode, IssueError } from "./issuer";

// Overridable for tests against a local stand-in.
const API = process.env.DIDIT_API_URL || "https://verification.didit.me/v3";

function config() {
  const apiKey = process.env.DIDIT_API_KEY;
  const workflowId = process.env.DIDIT_WORKFLOW_ID;
  if (!apiKey || !workflowId) throw new IssueError("Didit is not configured on the server.", 500);
  return { apiKey, workflowId };
}

async function didit<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "x-api-key": config().apiKey, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    // Didit's error bodies are plain explanations (e.g. no credits left); pass them on.
    const detail = await res.json().then((b: { detail?: unknown }) => (typeof b.detail === "string" ? b.detail : null)).catch(() => null);
    throw new IssueError(detail ? `Didit: ${detail}` : `Didit answered ${res.status}.`, 502);
  }
  return res.json() as Promise<T>;
}

/** A hosted verification session for `address`; Didit sends the user back to `callback`. */
export async function createSession(address: string, callback: string) {
  const { workflowId } = config();
  const s = await didit<{ session_id: string; url: string }>("/session/", {
    method: "POST",
    body: JSON.stringify({ workflow_id: workflowId, vendor_data: address, callback }),
  });
  return { sessionId: s.session_id, url: s.url };
}

type Address = { country?: string | null; category?: string | null; is_verified?: boolean | null };
type IdVerification = {
  status?: string;
  issuing_state?: string | null;
  document_number?: string | null;
  parsed_address?: Address | null;
};
type PoaVerification = { status?: string; poa_parsed_address?: Address | null; issuing_state?: string | null };
export type Decision = {
  session_id: string;
  status: string;
  vendor_data?: string | null;
  id_verifications?: IdVerification[] | null;
  poa_verifications?: PoaVerification[] | null;
  aml_screenings?: { status?: string }[] | null;
};

export async function getDecision(sessionId: string) {
  return didit<Decision>(`/session/${encodeURIComponent(sessionId)}/decision/`);
}

const approved = (s?: string | null) => (s ?? "").toLowerCase() === "approved";

export type DiditResidence = {
  country: number;
  basis: "proof of address" | "address on ID" | "ID document";
  /** Stable id of the ID document, so one document gets one credential. */
  documentId: string;
};

/**
 * The verified residence from an approved decision for `address`: an approved
 * proof of address first, then a verified residential address on the ID, and
 * on testnet only the document's issuing country.
 */
export function residenceFromDecision(d: Decision, address: string, testnet = IS_TESTNET): DiditResidence {
  if (!approved(d.status)) {
    const pending = /review|progress|not started|resubmitted|awaiting/i.test(d.status);
    throw new IssueError(pending ? "Didit is still reviewing your verification. Try again in a few minutes." : "Didit didn't approve the verification.", pending ? 409 : 403);
  }
  if (d.vendor_data !== address) throw new IssueError("This verification belongs to a different wallet.", 403);
  if ((d.aml_screenings ?? []).some((a) => !approved(a.status))) {
    throw new IssueError("dvdnd can't accept this verification (sanctions screening).", 403, true);
  }
  const id = (d.id_verifications ?? []).find((v) => approved(v.status));
  if (!id) throw new IssueError("Didit didn't verify an ID document.", 422);
  const documentId = `${id.issuing_state ?? ""}:${id.document_number ?? d.session_id}`;

  const poa = (d.poa_verifications ?? []).find((v) => approved(v.status) && v.poa_parsed_address?.country);
  if (poa) return { country: countryCode(poa.poa_parsed_address!.country), basis: "proof of address", documentId };
  const idAddress = id.parsed_address;
  if (idAddress?.country && idAddress.is_verified && (idAddress.category ?? "").toLowerCase() === "residential") {
    return { country: countryCode(idAddress.country), basis: "address on ID", documentId };
  }
  if (testnet && id.issuing_state) return { country: countryCode(id.issuing_state), basis: "ID document", documentId };
  throw new IssueError("Your verification has no verified residential address. Add a proof of address in Didit.", 422);
}
