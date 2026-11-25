import { describe, expect, it } from "vitest";
import { Exemption, holderExemption, parseUnits, toDecimal } from "./chain";
import type { ComplianceEntry, Holder } from "./compliance";
import { auditLogCsv, capTableCsv, cell, type CsvRaise } from "./csv";

const NOW = new Date("2026-11-24T12:00:00.000Z");
const A = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const B = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
const C = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ";
const raise: CsvRaise = { id: 7, company: "Andes Coffee, Ltd.", exemption: Exemption.RegSAnd506c };
const holder = (o: Partial<Holder> & { account: string }): Holder => ({ wallet: 0n, locked: 0n, authorized: true, eligibleUntil: 0, ...o });
const lines = (text: string) => text.split("\r\n");

describe("exact amounts", () => {
  it("round-trips decimal strings through units without floats", () => {
    expect(parseUnits("12.3456789")).toBe(123456789n);
    expect(parseUnits("0.0000001")).toBe(1n);
    expect(parseUnits("100")).toBe(1_000_000_000n);
    expect(toDecimal(123456789n)).toBe("12.3456789");
    expect(toDecimal(1n)).toBe("0.0000001");
    expect(toDecimal(0n)).toBe("0.0000000");
    expect(toDecimal(-5n)).toBe("-0.0000005");
    expect(toDecimal(parseUnits("922337203685.4775807"))).toBe("922337203685.4775807");
  });

  it("keeps amounts a float would round", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(toDecimal(parseUnits("0.1") + parseUnits("0.2"))).toBe("0.3000000");
  });

  it("refuses more decimals than the token has", () => {
    expect(() => parseUnits("1.00000001")).toThrow(RangeError);
  });
});

describe("cell", () => {
  it("leaves plain text alone", () => {
    expect(cell("Court order 2026/114")).toBe("Court order 2026/114");
  });

  it("quotes commas, quotes and line breaks, doubling quotes", () => {
    expect(cell("a,b")).toBe('"a,b"');
    expect(cell('said "no"')).toBe('"said ""no"""');
    expect(cell("line\nbreak")).toBe('"line\nbreak"');
    expect(cell("cr\r\nlf")).toBe('"cr\r\nlf"');
  });

  it("defuses text a spreadsheet would run as a formula", () => {
    expect(cell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(cell("+1")).toBe("'+1");
    expect(cell("-1 day late")).toBe("'-1 day late");
    expect(cell("@SUM(A1)")).toBe("'@SUM(A1)");
  });
});

describe("holderExemption", () => {
  it("follows the raise when it has one exemption", () => {
    expect(holderExemption(Exemption.RegS, 0)).toBe("Reg S");
    expect(holderExemption(Exemption.RegD506c, 1_800_000_000)).toBe("506(c)");
  });

  it("uses the residence proof in a combined raise", () => {
    expect(holderExemption(Exemption.RegSAnd506c, 1_800_000_000)).toBe("Reg S");
    expect(holderExemption(Exemption.RegSAnd506c, 0)).toBe("506(c)");
  });
});

describe("capTableCsv", () => {
  const text = capTableCsv(
    raise,
    "ANDES:GISSUER",
    [
      holder({ account: A, wallet: parseUnits("10"), locked: parseUnits("0.5") }),
      holder({ account: B, wallet: parseUnits("3.25"), authorized: false, eligibleUntil: Date.parse("2027-06-01T00:00:00Z") / 1000 }),
      holder({ account: C, locked: parseUnits("10.5") }),
    ],
    NOW,
  );

  it("starts with a header naming the raise, the asset and the export time", () => {
    expect(lines(text).slice(0, 6)).toEqual([
      "raise,7",
      'company,"Andes Coffee, Ltd."',
      "asset,ANDES:GISSUER",
      "exported_at,2026-11-24T12:00:00.000Z",
      "",
      "address,balance,locked_in_vault,free,frozen,eligible_until,exemption",
    ]);
  });

  it("writes one row per holder, largest holding first, ties by address", () => {
    expect(lines(text).slice(6)).toEqual([
      `${A},10.5000000,0.5000000,10.0000000,no,,506(c)`,
      `${C},10.5000000,10.5000000,0.0000000,no,,506(c)`,
      `${B},3.2500000,0.0000000,0.0000000,yes,2027-06-01T00:00:00.000Z,Reg S`,
      "",
    ]);
  });

  it("ends every line with CRLF", () => {
    expect(text.endsWith("\r\n")).toBe(true);
    expect(text.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
  });

  it("writes only the header and column names when nobody holds the token", () => {
    expect(lines(capTableCsv(raise, "ANDES:GISSUER", [], NOW))).toHaveLength(7);
  });
});

describe("auditLogCsv", () => {
  const entries: ComplianceEntry[] = [
    { action: "clawback", holder: A, amount: parseUnits("2.5"), reason: 'Court order, "urgent"', by: B, at: "2026-11-20T10:00:00Z", hash: "abc" },
    { action: "freeze", holder: A, reason: "=cmd|' /C calc'!A0", by: B, at: "2026-11-19T10:00:00Z", hash: "def" },
    { action: "handover", holder: C, by: B, at: "2026-11-18T10:00:00Z", hash: "ghi" },
  ];

  it("writes one escaped row per action, with exact amounts", () => {
    expect(lines(auditLogCsv(raise, entries, NOW))).toEqual([
      "raise,7",
      'company,"Andes Coffee, Ltd."',
      "exported_at,2026-11-24T12:00:00.000Z",
      "",
      "action,target,amount,reason,by,tx_hash,timestamp",
      `clawback,${A},2.5000000,"Court order, ""urgent""",${B},abc,2026-11-20T10:00:00Z`,
      `freeze,${A},,'=cmd|' /C calc'!A0,${B},def,2026-11-19T10:00:00Z`,
      `handover,${C},,,${B},ghi,2026-11-18T10:00:00Z`,
      "",
    ]);
  });
});
