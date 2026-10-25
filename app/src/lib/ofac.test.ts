import { describe, expect, it } from "vitest";
import { parseSdn } from "./ofac";

describe("OFAC SDN parsing", () => {
  it("collects every listed digital currency address", () => {
    const csv = [
      '36090,"EXAMPLE ENTITY","-0-",...,"Digital Currency Address - XBT 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa; Digital Currency Address - ETH 0x7F367cC41522cE07553e823bf3be79A889DEbe1B;"',
      '36091,"STELLAR TEST","-0-",...,"Digital Currency Address - USDC GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW;"',
    ].join("\n");
    const set = parseSdn(csv);
    expect(set.has("1A1ZP1EP5QGEFI2DMPTFTL5SLMV7DIVFNA")).toBe(true);
    expect(set.has("0X7F367CC41522CE07553E823BF3BE79A889DEBE1B")).toBe(true);
    expect(set.has("GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW")).toBe(true);
    expect(set.size).toBe(3);
  });
});
