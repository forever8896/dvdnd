#!/usr/bin/env node
// Usage: node scripts/vk-to-soroban.mjs build/verification_key.json > build/vk_soroban.json
// Prints the VerifyingKey in the JSON shape `stellar contract deploy ... -- --vk '<json>'` accepts.
import { readFileSync } from "node:fs";
import { vkToSoroban } from "./lib.mjs";

const file = process.argv[2] ?? new URL("../build/verification_key.json", import.meta.url).pathname;
console.log(JSON.stringify(vkToSoroban(JSON.parse(readFileSync(file, "utf8"))), null, 2));
