// Company registry check through GLEIF, the global Legal Entity Identifier
// registry (free public API, no key). An LEI record carries the legal name,
// legal address, national registry number and whether the entity is active.

const API = "https://api.gleif.org/api/v1/lei-records/";

/** ISO 17442: 20 characters, the last two a mod-97 check over the rest. */
export function isValidLei(lei: string) {
  const v = lei.trim().toUpperCase();
  if (!/^[A-Z0-9]{18}[0-9]{2}$/.test(v)) return false;
  const digits = v.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const d of digits) rem = (rem * 10 + Number(d)) % 97;
  return rem === 1;
}

export type LeiRecord = {
  lei: string;
  legalName: string;
  /** ISO 3166-1 alpha-2 of the legal address. */
  country: string;
  jurisdiction: string;
  /** National company-registry number, when GLEIF has it. */
  registeredAs: string | null;
  entityStatus: string;
  registrationStatus: string;
  nextRenewal: string | null;
};

export async function fetchLei(lei: string, fetchFn: typeof fetch = fetch): Promise<LeiRecord | null> {
  const id = lei.trim().toUpperCase();
  const res = await fetchFn(API + encodeURIComponent(id), { headers: { accept: "application/vnd.api+json" }, cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GLEIF answered ${res.status}`);
  const { data } = (await res.json()) as {
    data: {
      attributes: {
        lei: string;
        entity: {
          legalName: { name: string };
          legalAddress: { country: string };
          jurisdiction: string;
          registeredAs: string | null;
          status: string;
        };
        registration: { status: string; nextRenewalDate?: string };
      };
    };
  };
  const a = data.attributes;
  return {
    lei: a.lei,
    legalName: a.entity.legalName.name,
    country: a.entity.legalAddress.country,
    jurisdiction: a.entity.jurisdiction,
    registeredAs: a.entity.registeredAs ?? null,
    entityStatus: a.entity.status,
    registrationStatus: a.registration.status,
    nextRenewal: a.registration.nextRenewalDate ?? null,
  };
}

// Legal-form words that don't identify the business.
const LEGAL_FORMS = new Set(
  "sa s a sgps lda ltd limited plc llc inc corp corporation co company gmbh ag kg ug bv nv srl sl sas sarl spa oy ab as aps ou oü pte pty sro kft zrt".split(" "),
);

function nameTokens(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !LEGAL_FORMS.has(t));
}

/** Whether a registered name and the name on dvdnd plausibly refer to the same business. */
export function namesMatch(registered: string, declared: string) {
  const a = nameTokens(registered);
  const b = nameTokens(declared);
  if (!a.length || !b.length) return false;
  const shared = b.filter((t) => a.includes(t)).length;
  return shared / Math.min(a.length, b.length) >= 0.6;
}

export type LeiCheck = { record: LeiRecord | null; ok: boolean; problems: string[] };

/** Checks an LEI against the company as registered on dvdnd. */
export async function checkLei(
  lei: string,
  company: { name: string; countryAlpha2: string },
  fetchFn: typeof fetch = fetch,
): Promise<LeiCheck> {
  if (!isValidLei(lei)) return { record: null, ok: false, problems: ["That isn't a valid LEI (20 characters with a valid checksum)."] };
  const record = await fetchLei(lei, fetchFn);
  if (!record) return { record, ok: false, problems: ["GLEIF has no record for this LEI."] };
  const problems: string[] = [];
  if (record.entityStatus !== "ACTIVE") problems.push(`GLEIF lists the entity as ${record.entityStatus.toLowerCase()}.`);
  if (!["ISSUED", "PENDING_TRANSFER", "PENDING_ARCHIVAL"].includes(record.registrationStatus)) {
    problems.push(`The LEI registration is ${record.registrationStatus.toLowerCase().replace(/_/g, " ")}.`);
  }
  if (record.country !== company.countryAlpha2) {
    problems.push(`GLEIF's legal address is in ${record.country}, not ${company.countryAlpha2}.`);
  }
  if (!namesMatch(record.legalName, company.name)) {
    problems.push(`The legal name "${record.legalName}" doesn't match "${company.name}".`);
  }
  return { record, ok: problems.length === 0, problems };
}
