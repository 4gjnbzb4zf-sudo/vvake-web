import { describe, expect, it } from "vitest";
import {
  claimCalldata,
  claimManyCalldata,
  decodePoolLog,
  formatUnits,
  isClaimedCalldata,
  readBool,
  readWord,
  TOPIC,
  utf8ToHex,
  word,
} from "./eth";
import { epochOf, epochStart, pickAddress, rewardsRedirect, shortHex } from "./rewards-config";

const A = "0x1111111111111111111111111111111111111111";
const P2 = "0x" + "22".repeat(32);
const P3 = "0x" + "33".repeat(32);

// Expected values: `cast calldata "<sig>" <args>` (Foundry), so the hand-written encoder matches the real ABI.
describe("ABI encoding", () => {
  it("isClaimed(uint256,address)", () => {
    expect(isClaimedCalldata(2900, "0x00000000000000000000000000000000000000aB")).toBe(
      "0xd2ef07950000000000000000000000000000000000000000000000000000000000000b5400000000000000000000000000000000000000000000000000000000000000ab",
    );
  });

  it("claim(uint256,address,uint256,bytes32[])", () => {
    expect(claimCalldata(7, A, 10n ** 18n, [P2, P3])).toBe(
      "0x2e7ba6ef" +
        "0000000000000000000000000000000000000000000000000000000000000007" +
        "0000000000000000000000001111111111111111111111111111111111111111" +
        "0000000000000000000000000000000000000000000000000de0b6b3a7640000" +
        "0000000000000000000000000000000000000000000000000000000000000080" +
        "0000000000000000000000000000000000000000000000000000000000000002" +
        "22".repeat(32) +
        "33".repeat(32),
    );
  });

  it("claimMany(uint256[],address,uint256[],bytes32[][]) with an empty proof", () => {
    const expected =
      "0xfae68828" +
      "0000000000000000000000000000000000000000000000000000000000000080" +
      "0000000000000000000000001111111111111111111111111111111111111111" +
      "00000000000000000000000000000000000000000000000000000000000000e0" +
      "0000000000000000000000000000000000000000000000000000000000000140" +
      "0000000000000000000000000000000000000000000000000000000000000002" +
      "0000000000000000000000000000000000000000000000000000000000000007" +
      "0000000000000000000000000000000000000000000000000000000000000008" +
      "0000000000000000000000000000000000000000000000000000000000000002" +
      "0000000000000000000000000000000000000000000000000000000000000005" +
      "0000000000000000000000000000000000000000000000000000000000000006" +
      "0000000000000000000000000000000000000000000000000000000000000002" +
      "0000000000000000000000000000000000000000000000000000000000000040" +
      "0000000000000000000000000000000000000000000000000000000000000080" +
      "0000000000000000000000000000000000000000000000000000000000000001" +
      "22".repeat(32) +
      "0000000000000000000000000000000000000000000000000000000000000000";
    expect(
      claimManyCalldata(A, [
        { epoch: 7, amount: 5n, proof: [P2] },
        { epoch: 8, amount: 6n, proof: [] },
      ]),
    ).toBe(expected);
  });

  it("refuses bad input instead of encoding it", () => {
    expect(() => word(-1n)).toThrow();
    expect(() => isClaimedCalldata(1, "0x123")).toThrow();
    expect(() => claimCalldata(1, A, 1n, ["0x12"])).toThrow();
  });
});

describe("decoding", () => {
  it("reads words and bools", () => {
    const r = "0x" + word(5) + word(0) + word(1);
    expect(readWord(r, 0)).toBe(5n);
    expect(readWord(r, 2)).toBe(1n);
    expect(readWord(r, 9)).toBe(0n);
    expect(readBool("0x" + word(1))).toBe(true);
    expect(readBool("0x")).toBe(false);
  });

  it("decodes the prize pool's Funded and Bought logs", () => {
    const funded = decodePoolLog({
      topics: [TOPIC.funded, "0x" + "0".repeat(24) + "be8bc5e660c10a2c080a4580bb901774bf0c91ae", "0x" + "ab".repeat(32)],
      data: "0x" + word(3n * 10n ** 17n),
      blockNumber: "0x10",
      transactionHash: "0xfeed",
      logIndex: "0x1",
    });
    expect(funded).toEqual({
      kind: "funded",
      from: "0xbe8bc5e660c10a2c080a4580bb901774bf0c91ae",
      amount: 3n * 10n ** 17n,
      reportHash: "0x" + "ab".repeat(32),
      block: 16,
      tx: "0xfeed",
      index: 1,
    });
    const bought = decodePoolLog({
      topics: [TOPIC.bought, "0x" + "0".repeat(24) + "11".repeat(20), "0x" + word(4)],
      data: "0x" + word(10n ** 16n) + word(1_694_000n * 10n ** 18n) + word(1) + word(2) + "0".repeat(24) + "22".repeat(20),
      blockNumber: "0x20",
      transactionHash: "0xbeef",
      logIndex: "0x0",
    });
    expect(bought).toMatchObject({
      kind: "bought",
      caller: A,
      buyIndex: 4n,
      ethIn: 10n ** 16n,
      vvakeOut: 1_694_000n * 10n ** 18n,
      block: 32,
    });
    expect(decodePoolLog({ topics: ["0x00"], data: "0x", blockNumber: "0x1", transactionHash: "0x", logIndex: "0x0" })).toBeNull();
  });
});

describe("amounts and helpers", () => {
  it("formats base units, truncating", () => {
    expect(formatUnits(1_234_567_890_000_000_000_000n, 18)).toBe("1,234.5678");
    expect(formatUnits(10n ** 18n, 18)).toBe("1");
    expect(formatUnits(1n, 18)).toBe("0");
    expect(formatUnits(15n * 10n ** 17n, 18, 4, "fr")).toBe("1,5");
  });

  it("hex-encodes UTF-8 for personal_sign", () => {
    expect(utf8ToHex("VV é")).toBe("0x565620c3a9");
  });

  it("numbers weeks like the API (Monday 00:00 UTC)", () => {
    expect(epochOf(Date.UTC(1970, 0, 5))).toBe(0);
    expect(epochOf(Date.UTC(1970, 0, 11, 23, 59))).toBe(0);
    expect(epochOf(Date.UTC(1970, 0, 12))).toBe(1);
    expect(epochStart(epochOf(Date.UTC(2026, 9, 7))).toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });

  it("picks the first real address", () => {
    expect(pickAddress("", null, A)).toBe(A);
    expect(pickAddress("0xnope", undefined)).toBeNull();
    expect(shortHex(A)).toBe("0x1111…1111");
  });

  it("forwards /rewards to the localized page, nothing else", () => {
    expect(rewardsRedirect("/rewards", "fr")).toBe("/fr/rewards/");
    expect(rewardsRedirect("/rewards/", "en")).toBe("/en/rewards/");
    expect(rewardsRedirect("/rewardsx", "en")).toBeNull();
    expect(rewardsRedirect("/en/rewards/x", "en")).toBeNull();
  });
});
