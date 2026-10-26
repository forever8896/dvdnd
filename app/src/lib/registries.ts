import "server-only";

// Company lookup across free public business registries, so a company can
// find itself by name and have its details filled in. Each source is
// normalised to one record shape. Sources without a key:
//   GLEIF (worldwide, companies with an LEI), France (Recherche d'entreprises,
//   including filed revenue and profit), Norway (Brønnøysund), Finland (PRH),
//   Czechia (ARES) and Denmark (cvrapi.dk, one best match per query).
// The UK's Companies House is used when COMPANIES_HOUSE_API_KEY is set.

import { isoNumeric } from "./iso3166";
import { sectorFromNace } from "./sectors";

export type RegistryRecord = {
  /** Stable key: source + registry id. */
  key: string;
  source: "gleif" | "fr" | "no" | "fi" | "cz" | "dk" | "gb";
  /** The registry's name, as shown to the user. */
  registry: string;
  /** The company's number in that registry (SIREN, org.nr, Y-tunnus, IČO, CVR, LEI…). */
  id: string;
  idLabel: string;
  name: string;
  /** ISO 3166-1 numeric. */
  country: number;
  city: string | null;
  address: string | null;
  sector: string | null;
  activity: string | null;
  founded: string | null;
  employees: string | null;
  website: string | null;
  lei: string | null;
  active: boolean;
  /** Latest filed accounts, when the registry publishes them. */
  accounts: { year: number; revenue: number | null; netProfit: number | null; currency: string } | null;
  /** The record on the registry's own site. */
  url: string;
};

const TIMEOUT = 6000;
const json = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT), next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  return res.json() as Promise<T>;
};
// Legal forms keep their usual spelling when an all-caps register name is title-cased.
const FORMS: Record<string, string> = Object.fromEntries(
  ["AS", "ASA", "SA", "SAS", "SASU", "SARL", "EURL", "SCI", "SCP", "SNC", "OY", "OYJ", "AB", "PLC", "LLC", "LLP", "BV", "NV", "SPA", "SRL", "KG", "AG", "SE", "IS", "IVS", "A/S", "I/S", "K/S"]
    .map((f) => [f.toLowerCase(), f])
    .concat([["aps", "ApS"], ["gmbh", "GmbH"], ["ltd", "Ltd"], ["s.r.o.", "s.r.o."], ["a.s.", "a.s."]]),
);
const title = (s: string) =>
  s !== s.toUpperCase()
    ? s
    : s
        .toLowerCase()
        .split(/(\s+)/)
        .map((w) => FORMS[w.replace(/[(),]/g, "")] ? w.replace(w.replace(/[(),]/g, ""), FORMS[w.replace(/[(),]/g, "")]) : w.replace(/(^|[\-(&/.])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()))
        .join("")
        // French place names: Marcq-en-Barœul, Saint-Paul-de-Varces.
        .replace(/-(En|De|Du|Des|La|Le|Les|Sur|Sous|Aux|Lès|Et)-/g, (m) => m.toLowerCase());
const site = (w: string | null | undefined) => (w ? (w.startsWith("http") ? w : `https://${w}`) : null);

// ── France: annuaire des entreprises ───────────────────────────────────
type FrResult = {
  siren: string;
  nom_complet: string;
  activite_principale: string | null;
  tranche_effectif_salarie: string | null;
  date_creation: string | null;
  etat_administratif: string;
  finances?: Record<string, { ca: number | null; resultat_net: number | null }> | null;
  siege: { libelle_commune: string | null; adresse: string | null };
};
const FR_EMPLOYEES: Record<string, string> = {
  "00": "0", "01": "1–2", "02": "3–5", "03": "6–9", "11": "10–19", "12": "20–49", "21": "50–99", "22": "100–199",
  "31": "200–249", "32": "250–499", "41": "500–999", "42": "1,000–1,999", "51": "2,000–4,999", "52": "5,000–9,999", "53": "10,000+",
};
async function france(q: string): Promise<RegistryRecord[]> {
  const r = await json<{ results: FrResult[] }>(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&per_page=6`);
  return r.results.map((c) => {
    const years = Object.keys(c.finances ?? {}).sort();
    const last = years.length ? c.finances![years[years.length - 1]] : null;
    return {
      key: `fr:${c.siren}`,
      source: "fr",
      registry: "Registre national des entreprises (France)",
      id: c.siren,
      idLabel: "SIREN",
      name: title(c.nom_complet),
      country: 250,
      city: c.siege.libelle_commune ? title(c.siege.libelle_commune) : null,
      address: c.siege.adresse,
      sector: sectorFromNace(c.activite_principale),
      activity: c.activite_principale,
      founded: c.date_creation,
      employees: c.tranche_effectif_salarie ? (FR_EMPLOYEES[c.tranche_effectif_salarie] ?? null) : null,
      website: null,
      lei: null,
      active: c.etat_administratif === "A",
      accounts: last ? { year: Number(years[years.length - 1]), revenue: last.ca, netProfit: last.resultat_net, currency: "EUR" } : null,
      url: `https://annuaire-entreprises.data.gouv.fr/entreprise/${c.siren}`,
    };
  });
}

// ── Norway: Enhetsregisteret ───────────────────────────────────────────
type NoUnit = {
  organisasjonsnummer: string;
  navn: string;
  hjemmeside?: string;
  naeringskode1?: { kode: string; beskrivelse: string };
  antallAnsatte?: number;
  stiftelsesdato?: string;
  registreringsdatoEnhetsregisteret?: string;
  konkurs?: boolean;
  underAvvikling?: boolean;
  forretningsadresse?: { poststed?: string; adresse?: string[] };
};
async function norway(q: string): Promise<RegistryRecord[]> {
  const r = await json<{ _embedded?: { enheter: NoUnit[] } }>(`https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(q)}&size=6`);
  return (r._embedded?.enheter ?? []).map(noRecord);
}
function noRecord(u: NoUnit): RegistryRecord {
  return {
    key: `no:${u.organisasjonsnummer}`,
    source: "no",
    registry: "Brønnøysund Register Centre (Norway)",
    id: u.organisasjonsnummer,
    idLabel: "Org. no.",
    name: title(u.navn),
    country: 578,
    city: u.forretningsadresse?.poststed ? title(u.forretningsadresse.poststed) : null,
    address: u.forretningsadresse?.adresse?.join(", ") ?? null,
    sector: sectorFromNace(u.naeringskode1?.kode),
    activity: u.naeringskode1?.beskrivelse ?? null,
    founded: u.stiftelsesdato ?? u.registreringsdatoEnhetsregisteret ?? null,
    employees: u.antallAnsatte ? String(u.antallAnsatte) : null,
    website: site(u.hjemmeside),
    lei: null,
    active: !u.konkurs && !u.underAvvikling,
    accounts: null,
    url: `https://virksomhet.brreg.no/nb/oppslag/enheter/${u.organisasjonsnummer}`,
  };
}

// ── Finland: PRH open data ─────────────────────────────────────────────
type FiCompany = {
  businessId: { value: string; registrationDate?: string };
  names: { name: string; type: string; endDate?: string }[];
  mainBusinessLine?: { type: string; descriptions: { languageCode: string; description: string }[] };
  website?: { url: string } | null;
  addresses?: { postOffices?: { city: string; languageCode: string }[] }[];
  status: string;
};
async function finland(q: string): Promise<RegistryRecord[]> {
  const r = await json<{ companies: FiCompany[] }>(`https://avoindata.prh.fi/opendata-ytj-api/v3/companies?name=${encodeURIComponent(q)}&page=1`);
  return r.companies.slice(0, 6).map(fiRecord);
}
function fiRecord(c: FiCompany): RegistryRecord {
  const name = c.names.find((n) => n.type === "1" && !n.endDate)?.name ?? c.names[0]?.name ?? "";
  const city = c.addresses?.[0]?.postOffices?.find((p) => p.languageCode === "1")?.city ?? null;
  return {
    key: `fi:${c.businessId.value}`,
    source: "fi",
    registry: "Finnish Patent and Registration Office",
    id: c.businessId.value,
    idLabel: "Business ID",
    name,
    country: 246,
    city: city ? title(city) : null,
    address: null,
    sector: sectorFromNace(c.mainBusinessLine?.type),
    activity: c.mainBusinessLine?.descriptions.find((d) => d.languageCode === "3")?.description ?? null,
    founded: c.businessId.registrationDate ?? null,
    employees: null,
    website: site(c.website?.url),
    lei: null,
    active: c.status === "2",
    accounts: null,
    url: `https://tietopalvelu.ytj.fi/yritys/${c.businessId.value}`,
  };
}

// ── Czechia: ARES ──────────────────────────────────────────────────────
type CzSubject = { ico: string; obchodniJmeno: string; datumVzniku?: string; datumZaniku?: string; czNace?: string[]; sidlo?: { nazevObce?: string; textovaAdresa?: string } };
async function czechia(q: string): Promise<RegistryRecord[]> {
  const r = await json<{ ekonomickeSubjekty?: CzSubject[] }>("https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/vyhledat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ obchodniJmeno: q, pocet: 6 }),
  });
  return (r.ekonomickeSubjekty ?? []).map(czRecord);
}
function czRecord(s: CzSubject): RegistryRecord {
  const nace = s.czNace?.find((c) => c !== "00") ?? null;
  return {
    key: `cz:${s.ico}`,
    source: "cz",
    registry: "ARES (Czech Republic)",
    id: s.ico,
    idLabel: "IČO",
    name: s.obchodniJmeno,
    country: 203,
    city: s.sidlo?.nazevObce ?? null,
    address: s.sidlo?.textovaAdresa ?? null,
    sector: sectorFromNace(nace),
    activity: nace,
    founded: s.datumVzniku ?? null,
    employees: null,
    website: null,
    lei: null,
    active: !s.datumZaniku,
    accounts: null,
    url: `https://ares.gov.cz/ekonomicke-subjekty?ico=${s.ico}`,
  };
}

// ── Denmark: CVR through cvrapi.dk (one best match) ────────────────────
type DkCompany = { vat: number; name: string; city: string | null; address: string | null; startdate: string | null; enddate: string | null; employees: string | null; industrycode: number | null; industrydesc: string | null; error?: string };
async function denmark(q: string): Promise<RegistryRecord[]> {
  const c = await json<DkCompany>(`https://cvrapi.dk/api?search=${encodeURIComponent(q)}&country=dk`, { headers: { "user-agent": "dvdnd company lookup" } });
  if (c.error || !c.vat) return [];
  const [d, m, y] = (c.startdate ?? "").split(/[/\s-]+/).map((x) => x.trim());
  return [
    {
      key: `dk:${c.vat}`,
      source: "dk",
      registry: "Central Business Register (Denmark)",
      id: String(c.vat),
      idLabel: "CVR",
      name: c.name,
      country: 208,
      city: c.city,
      address: c.address,
      sector: sectorFromNace(c.industrycode ? String(c.industrycode) : null),
      activity: c.industrydesc,
      founded: y && m && d ? `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : null,
      employees: c.employees,
      website: null,
      lei: null,
      active: !c.enddate,
      accounts: null,
      url: `https://datacvr.virk.dk/enhed/virksomhed/${c.vat}`,
    },
  ];
}

// ── United Kingdom: Companies House (needs a free API key) ─────────────
type GbItem = { company_number: string; title: string; company_status: string; date_of_creation?: string; address?: { locality?: string }; address_snippet?: string };
async function britain(q: string): Promise<RegistryRecord[]> {
  const key = process.env.COMPANIES_HOUSE_API_KEY;
  if (!key) return [];
  const r = await json<{ items?: GbItem[] }>(`https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(q)}&items_per_page=6`, {
    headers: { authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` },
  });
  return (r.items ?? []).map((i) => ({
    key: `gb:${i.company_number}`,
    source: "gb",
    registry: "Companies House (UK)",
    id: i.company_number,
    idLabel: "Company no.",
    name: title(i.title),
    country: 826,
    city: i.address?.locality ?? null,
    address: i.address_snippet ?? null,
    sector: null,
    activity: null,
    founded: i.date_of_creation ?? null,
    employees: null,
    website: null,
    lei: null,
    active: i.company_status === "active",
    accounts: null,
    url: `https://find-and-update.company-information.service.gov.uk/company/${i.company_number}`,
  }));
}

// ── GLEIF: worldwide, companies with an LEI ────────────────────────────
type GleifRecord = {
  id: string;
  attributes: {
    entity: {
      legalName: { name: string };
      legalAddress: { city?: string; country: string; addressLines?: string[] };
      registeredAs?: string | null;
      status: string;
      creationDate?: string | null;
    };
  };
};
function fromGleif(r: GleifRecord): RegistryRecord {
  const e = r.attributes.entity;
  return {
    key: `gleif:${r.id}`,
    source: "gleif",
    registry: "GLEIF (Legal Entity Identifiers)",
    id: r.id,
    idLabel: "LEI",
    name: title(e.legalName.name),
    country: isoNumeric(e.legalAddress.country) ?? 0,
    city: e.legalAddress.city ? title(e.legalAddress.city) : null,
    address: e.legalAddress.addressLines?.join(", ") ?? null,
    sector: null,
    activity: null,
    founded: e.creationDate?.slice(0, 10) ?? null,
    employees: null,
    website: null,
    lei: r.id,
    active: e.status === "ACTIVE",
    accounts: null,
    url: `https://search.gleif.org/#/record/${r.id}`,
  };
}
async function gleif(q: string): Promise<RegistryRecord[]> {
  // Prefix autocompletion ranks far better than GLEIF's full-text search.
  const c = await json<{ data: { relationships?: { "lei-records"?: { data: { id: string } } } }[] }>(
    `https://api.gleif.org/api/v1/autocompletions?field=fulltext&q=${encodeURIComponent(q)}`,
  );
  const ids = [...new Set(c.data.map((d) => d.relationships?.["lei-records"]?.data.id).filter(Boolean))].slice(0, 6) as string[];
  if (!ids.length) return [];
  const r = await json<{ data: GleifRecord[] }>(`https://api.gleif.org/api/v1/lei-records?filter%5Blei%5D=${ids.join(",")}&page%5Bsize%5D=6`);
  return r.data.map(fromGleif);
}

/** The LEI of a company known by its national registry number, if it has one. */
export async function leiFor(registryId: string, country: number): Promise<string | null> {
  const r = await json<{ data: GleifRecord[] }>(`https://api.gleif.org/api/v1/lei-records?filter%5Bentity.registeredAs%5D=${encodeURIComponent(registryId)}&page%5Bsize%5D=5`);
  return r.data.map(fromGleif).find((x) => x.country === country && x.active)?.lei ?? null;
}

const SOURCES = { fr: france, no: norway, fi: finland, cz: czechia, dk: denmark, gb: britain, gleif } as const;
export const COUNTRY_SOURCE: Record<number, keyof typeof SOURCES> = { 250: "fr", 578: "no", 246: "fi", 203: "cz", 208: "dk", 826: "gb" };

/** Which sources a search uses: a country's own registry plus GLEIF, or every keyless one. */
function sourcesFor(country?: number): (keyof typeof SOURCES)[] {
  const own = country ? COUNTRY_SOURCE[country] : undefined;
  if (own) return [own, "gleif"];
  if (country) return ["gleif"];
  return ["fr", "no", "fi", "cz", "gb", "gleif"];
}

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function searchRegistries(q: string, country?: number) {
  const settled = await Promise.allSettled(sourcesFor(country).map((s) => SOURCES[s](q)));
  const failed = settled.flatMap((s, i) => (s.status === "rejected" ? [sourcesFor(country)[i]] : []));
  let all = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
  if (country) all = all.filter((r) => r.country === country);
  // A national record and its GLEIF twin are one company: keep the national one with the LEI attached.
  const national = all.filter((r) => r.source !== "gleif");
  const gleifOnly = all.filter((r) => r.source === "gleif" && !national.some((n) => n.country === r.country && norm(n.name) === norm(r.name)));
  for (const n of national) {
    const twin = all.find((r) => r.source === "gleif" && r.country === n.country && norm(r.name) === norm(n.name));
    if (twin) n.lei = twin.lei;
  }
  const nq = norm(q);
  const score = (r: RegistryRecord) => {
    const n = norm(r.name);
    return (n === nq ? 0 : n.startsWith(nq) ? 1 : n.includes(nq) ? 2 : 3) + (r.active ? 0 : 4) + (r.source === "gleif" ? 0.5 : 0);
  };
  // Best matches first; within a tier, take turns across registries so one country doesn't crowd out the rest.
  const ranked = [...national, ...gleifOnly].sort((a, b) => Math.floor(score(a)) - Math.floor(score(b)));
  const results: RegistryRecord[] = [];
  for (const tier of [...new Set(ranked.map((r) => Math.floor(score(r))))]) {
    const queues = new Map<string, RegistryRecord[]>();
    for (const r of ranked.filter((x) => Math.floor(score(x)) === tier)) queues.set(r.source, [...(queues.get(r.source) ?? []), r]);
    while ([...queues.values()].some((q) => q.length)) for (const q of queues.values()) if (q.length) results.push(q.shift()!);
  }
  results.splice(12);
  return { results, failed };
}

/** One company by its registry number, straight from its registry (for verification). */
export async function lookupById(source: string, id: string): Promise<RegistryRecord | null> {
  const clean = id.replace(/\s/g, "");
  switch (source) {
    case "fr":
      return (await france(clean)).find((r) => r.id === clean) ?? null;
    case "dk":
      return (await denmark(clean)).find((r) => r.id === clean) ?? null;
    case "gb":
      return (await britain(clean)).find((r) => r.id === clean) ?? null;
    case "no":
      return noRecord(await json<NoUnit>(`https://data.brreg.no/enhetsregisteret/api/enheter/${encodeURIComponent(clean)}`));
    case "fi": {
      const r = await json<{ companies: FiCompany[] }>(`https://avoindata.prh.fi/opendata-ytj-api/v3/companies?businessId=${encodeURIComponent(clean)}`);
      return r.companies[0] ? fiRecord(r.companies[0]) : null;
    }
    case "cz":
      return czRecord(await json<CzSubject>(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${encodeURIComponent(clean)}`));
    default:
      return null;
  }
}

/** Whether two company names are the same once case, accents and punctuation are ignored. */
export const sameName = (a: string, b: string) => norm(a) === norm(b);
