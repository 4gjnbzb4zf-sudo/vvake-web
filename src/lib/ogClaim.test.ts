import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  findOgEntry,
  isPinnedList,
  isSafeOgClaimTx,
  ogClaimCalldata,
  ogLeaf,
  ogRows,
  parseOgList,
  planOgClaim,
  verifyOgProof,
  type OgList,
} from "./ogClaim";
import { holdersDropConfig, ogClaimConfig } from "./rewards-config";

const raw = JSON.parse(readFileSync(fileURLToPath(new URL("../../public/og-drop/og-drop-claims.json", import.meta.url)), "utf8"));
const list = parseOgList(raw) as OgList;
const CONTRACT = "0x00000000000000000000000000000000000000c1";
const A = "0x71e584722Aaa4E3B7908954AC35B59877AF8c4Ec";

describe("the published OG list", () => {
  it("parses, has the pinned root, 74 wallets, Σ == 50,000,000, every proof verifies", () => {
    expect(list).not.toBeNull();
    expect(list.root).toBe(ogClaimConfig.root);
    expect(Object.keys(list.claims)).toHaveLength(74);
    expect(isPinnedList(list)).toBe(true);
  });

  it("no wallet above the 10 % cap or under 1,000, no address twice", () => {
    const rows = ogRows(list);
    expect(rows[0]!.amount).toBe(5_000_000n * 10n ** 18n);
    expect(rows.every((r) => r.amount <= 5_000_000n * 10n ** 18n && r.amount >= 1_000n * 10n ** 18n)).toBe(true);
    expect(new Set(rows.map((r) => r.address.toLowerCase())).size).toBe(rows.length);
  });

  it("refuses a list with another root or a changed amount", () => {
    expect(isPinnedList({ ...list, root: "0x" + "00".repeat(32) })).toBe(false);
    const tampered: OgList = { ...list, claims: { ...list.claims, [A]: { ...list.claims[A]!, amount: "1" } } };
    expect(isPinnedList(tampered)).toBe(false);
  });

  it("finds an address in any letter case", () => {
    expect(findOgEntry(list, A.toLowerCase())?.address).toBe(A);
    expect(findOgEntry(list, "0x000000000000000000000000000000000000dEaD")).toBeNull();
  });
});

describe("leaf, proof and calldata", () => {
  it("leaf matches the monorepo's builder", () => {
    const e = list.claims[A]!;
    expect(ogLeaf(A, BigInt(e.amount))).toBe(e.leaf);
    expect(verifyOgProof(e.proof, list.root, e.leaf)).toBe(true);
    expect(verifyOgProof(e.proof.slice(1), list.root, e.leaf)).toBe(false);
  });

  // cast calldata 'claim(address,uint256,bytes32[])' 0x71e5…c4Ec 1150578285852534733232500 '[0x11…11,0x22…22]'
  it("claim calldata matches cast", () => {
    expect(ogClaimCalldata(A, 1150578285852534733232500n, ["0x" + "11".repeat(32), "0x" + "22".repeat(32)])).toBe(
      "0x3d13f87400000000000000000000000071e584722aaa4e3b7908954ac35b59877af8c4ec00000000000000000000000000000000000000000000f3a4f94eaddba97359740000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000211111111111111111111111111111111111111111111111111111111111111112222222222222222222222222222222222222222222222222222222222222222",
    );
  });
});

describe("planOgClaim", () => {
  it("opens soon while no contract is set", () => {
    expect(planOgClaim(list, A, null)).toEqual({ ok: false, reason: "notDeployed" });
  });

  it("refuses an address not on the list", () => {
    expect(planOgClaim(list, "0x000000000000000000000000000000000000dEaD", CONTRACT)).toEqual({ ok: false, reason: "notListed" });
  });

  it("builds a claim to the pinned contract, 0 ETH, for the listed amount", () => {
    const plan = planOgClaim(list, A.toLowerCase(), CONTRACT);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.amount).toBe(BigInt(list.claims[A]!.amount));
    expect(plan.tx.to).toBe(CONTRACT);
    expect(plan.tx.value).toBe("0x0");
    expect(isSafeOgClaimTx(plan.tx, CONTRACT)).toBe(true);
  });

  it("refuses a proof that doesn't verify against the pinned root", () => {
    expect(planOgClaim(list, A, CONTRACT, "0x" + "ab".repeat(32))).toEqual({ ok: false, reason: "badList" });
  });

  it("isSafeOgClaimTx refuses another target, another selector or ETH", () => {
    const plan = planOgClaim(list, A, CONTRACT);
    if (!plan.ok) throw new Error("plan");
    expect(isSafeOgClaimTx({ ...plan.tx, to: "0x00000000000000000000000000000000000000c2" }, CONTRACT)).toBe(false);
    expect(isSafeOgClaimTx({ ...plan.tx, data: "0x095ea7b3" + plan.tx.data.slice(10) }, CONTRACT)).toBe(false);
    expect(isSafeOgClaimTx({ ...plan.tx, value: "0x1" }, CONTRACT)).toBe(false);
    expect(isSafeOgClaimTx(plan.tx, null)).toBe(false);
  });
});

describe("the published drop 2 list (free v1 holders)", () => {
  const holders = parseOgList(
    JSON.parse(readFileSync(fileURLToPath(new URL("../../public/holders-drop/holders-drop-claims.json", import.meta.url)), "utf8")),
  )!;
  it("matches the pinned root and total, every proof verifies", () => {
    expect(holders.count).toBe(holdersDropConfig.count);
    expect(isPinnedList(holders, holdersDropConfig.root, holdersDropConfig.total)).toBe(true);
  });
  it("shares no wallet with drop 1, and every drop 1 wallet has its paid transaction", () => {
    const og = new Set(Object.keys(parseOgList(raw)!.claims).map((a) => a.toLowerCase()));
    expect(Object.keys(holders.claims).some((a) => og.has(a.toLowerCase()))).toBe(false);
    const paid = JSON.parse(readFileSync(fileURLToPath(new URL("../../public/og-drop/og-drop-paid.json", import.meta.url)), "utf8"));
    expect(new Set(Object.keys(paid).map((a) => a.toLowerCase()))).toEqual(og);
  });
});
