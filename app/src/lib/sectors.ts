// Plain-language sectors from NACE activity codes (the EU classification that
// national registries use: France's NAF, Norway's SN2007, Finland's TOL, the
// Czech CZ-NACE, Denmark's DB07). The four-digit class wins when we know it.

const CLASSES: Record<string, string> = {
  "1071": "Bakery",
  "2219": "Rubber parts",
  "2229": "Plastic parts",
  "2511": "Metal structures",
  "2550": "Forging and stamping",
  "2561": "Metal treatment",
  "2562": "Precision machining",
  "2573": "Tooling",
  "2594": "Fasteners",
  "2712": "Electrical equipment",
  "2732": "Wiring and cables",
  "2811": "Engines and turbines",
  "2815": "Bearings and gears",
  "2822": "Lifting equipment",
  "2841": "Machine tools",
  "2899": "Industrial machinery",
  "2910": "Vehicle manufacturing",
  "2920": "Vehicle bodies and trailers",
  "2931": "Automotive electronics",
  "2932": "Automotive parts",
  "3020": "Rail equipment",
  "3030": "Aerospace parts",
  "3312": "Machinery repair",
  "1072": "Bakery",
  "1082": "Confectionery",
  "1083": "Coffee roasting",
  "1102": "Winery",
  "1105": "Brewery",
  "1107": "Soft drinks",
  "4711": "Grocery",
  "4721": "Food retail",
  "4724": "Bakery",
  "4725": "Drinks retail",
  "5510": "Hotels",
  "5610": "Restaurants",
  "5611": "Restaurants",
  "5612": "Street food",
  "5621": "Catering",
  "5630": "Bars and cafés",
  "6201": "Software",
  "6202": "IT consulting",
  "8621": "Clinics",
  "8623": "Dental clinics",
  "9311": "Sports facilities",
  "9313": "Fitness",
  "9602": "Hair and beauty",
  "9604": "Wellness",
};

const DIVISIONS: [number, number, string][] = [
  [1, 3, "Agriculture"],
  [10, 12, "Food and drink production"],
  [13, 15, "Textiles and fashion"],
  [16, 33, "Manufacturing"],
  [35, 39, "Energy and utilities"],
  [41, 43, "Construction"],
  [45, 45, "Motor trade"],
  [46, 46, "Wholesale"],
  [47, 47, "Retail"],
  [49, 53, "Transport and logistics"],
  [55, 55, "Hotels"],
  [56, 56, "Restaurants and cafés"],
  [58, 60, "Media"],
  [61, 63, "Software and IT"],
  [64, 66, "Financial services"],
  [68, 68, "Real estate"],
  [69, 75, "Professional services"],
  [77, 82, "Business services"],
  [85, 85, "Education"],
  [86, 88, "Healthcare"],
  [90, 92, "Arts and entertainment"],
  [93, 93, "Sports and leisure"],
  [94, 96, "Personal services"],
];

/** A readable sector for a NACE-style code like "10.71A", "10.710", "10710" or "702000". */
export function sectorFromNace(code: string | null | undefined): string | null {
  const digits = (code ?? "").replace(/\D/g, "");
  if (digits.length < 2 || digits === "00") return null;
  const cls = CLASSES[digits.slice(0, 4)];
  if (cls) return cls;
  const div = Number(digits.slice(0, 2));
  return DIVISIONS.find(([a, b]) => div >= a && div <= b)?.[2] ?? null;
}
