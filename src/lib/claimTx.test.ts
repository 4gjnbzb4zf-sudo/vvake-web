import { describe, expect, it } from "vitest";
import { planClaims, type ClaimProofInput } from "./claimTx";
import { claimCalldata, claimManyCalldata, SELECTOR } from "./eth";
import { rewardsConfig } from "./rewards-config";

const PINNED = rewardsConfig.rewardsContract;
const TOKEN = rewardsConfig.token;
const ATTACKER = "0x000000000000000000000000000000000000dEaD";
const ME = "0x1111111111111111111111111111111111111111";
const APPROVE = "0x095ea7b3"; // approve(address,uint256)
const approveAll = APPROVE + ATTACKER.slice(2).toLowerCase().padStart(64, "0") + "f".repeat(64);
const PROOF = ["0x" + "ab".repeat(32), "0x" + "cd".repeat(32)];

const proof = (over: Partial<ClaimProofInput> = {}): ClaimProofInput => ({
  epoch: 2909,
  chainId: rewardsConfig.chain.id,
  contract: PINNED,
  account: ME,
  amountBase: "1000000000000000000",
  proof: PROOF,
  calldata: claimCalldata(2909, ME, 10n ** 18n, PROOF),
  ...over,
});

/** Whatever planClaims decides, it never yields the attacker's transaction. */
function neverMalicious(plan: ReturnType<typeof planClaims>) {
  if (!plan.ok) return;
  for (const tx of plan.txs) {
    expect(tx.to.toLowerCase()).toBe(PINNED.toLowerCase());
    expect(tx.data.startsWith(APPROVE)).toBe(false);
    expect([SELECTOR.claim, SELECTOR.claimMany]).toContain(tx.data.slice(0, 10));
    expect(tx.value).toBe("0x0");
  }
}

describe("VV-06 claim transaction is built from the pinned contract, never from the API", () => {
  it("VV-06 a compromised API (contract = token, calldata = approve(attacker, max)) is refused", () => {
    const plan = planClaims([proof({ contract: TOKEN, calldata: approveAll })], PINNED);
    neverMalicious(plan);
    expect(plan).toEqual({ ok: false, reason: "contractMismatch" });
  });

  it("VV-06 malicious calldata with the right contract: calldata is rebuilt locally, API calldata ignored", () => {
    const plan = planClaims([proof({ calldata: approveAll })], PINNED);
    neverMalicious(plan);
    expect(plan).toEqual({
      ok: true,
      txs: [{ to: PINNED, data: claimCalldata(2909, ME, 10n ** 18n, PROOF), value: "0x0", epochs: [2909] }],
    });
  });

  it("VV-06 no contract in the proof: still the pinned contract, never a fallback from the API", () => {
    const plan = planClaims([proof({ contract: null, calldata: approveAll })], PINNED);
    neverMalicious(plan);
    expect(plan.ok && plan.txs[0]!.to).toBe(PINNED);
  });

  it("VV-06 several weeks: one claimMany to the pinned contract", () => {
    const plan = planClaims([proof({ calldata: approveAll }), proof({ epoch: 2910, calldata: approveAll })], PINNED);
    neverMalicious(plan);
    expect(plan.ok && plan.txs).toEqual([
      {
        to: PINNED,
        data: claimManyCalldata(ME, [
          { epoch: 2909, amount: 10n ** 18n, proof: PROOF },
          { epoch: 2910, amount: 10n ** 18n, proof: PROOF },
        ]),
        value: "0x0",
        epochs: [2909, 2910],
      },
    ]);
  });

  it("VV-06 wrong chain, malformed account, amount or proof: refused", () => {
    expect(planClaims([proof({ chainId: 1 })], PINNED)).toEqual({ ok: false, reason: "chainMismatch" });
    expect(planClaims([proof({ account: "0xnope" })], PINNED)).toEqual({ ok: false, reason: "badProof" });
    expect(planClaims([proof({ amountBase: "-1" })], PINNED)).toEqual({ ok: false, reason: "badProof" });
    expect(planClaims([proof({ proof: ["0x1234"] })], PINNED)).toEqual({ ok: false, reason: "badProof" });
  });

  it("VV-06 no pinned contract on this build: refused, the API's address is never used instead", () => {
    expect(planClaims([proof()], "")).toEqual({ ok: false, reason: "noContract" });
  });
});
