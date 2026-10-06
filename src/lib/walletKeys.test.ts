import { describe, expect, it } from "vitest";
import {
  bytesToHex,
  generatePrivateKey,
  hexToBytes,
  isValidAddress,
  personalSign,
  privateKeyToAddress,
  recoverPersonalSigner,
  signEip1559,
  toChecksumAddress,
  txHash,
  wipe,
} from "./walletKeys";
import { claimCalldata } from "./eth";

// Vectors from Foundry's cast 1.7.1 (an independent implementation), the same ones the VVake API's eth.ts tests use
// (services/api/test/rewards.test.ts), plus a claim and an ERC-20 transfer made with `cast mktx` for this page.
const KEY1 = hexToBytes("0x0000000000000000000000000000000000000000000000000000000000000001");
const ADDR1 = "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf"; // cast wallet address --private-key 0x…01
const SIG_HELLO =
  "0xdb31698236e3e67807e8d3fe44dfb7a09778c1e249c9dac84b33f4f781dc969e2e290796ea507dee95419c677ebbbac93a38ca1bce9d6cc70493f9459969bd741c"; // cast wallet sign --private-key 0x…01 "hello VVake"
const KEY2 = hexToBytes("0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318");
const ADDR2 = "0x2c7536E3605D9C16a7a3D7b1898e529396a65c23";
const SIWE_LINE = "vvake.com wants you to sign in with your Ethereum account:";
const SIG_SIWE_LINE =
  "0x4f1fa926b939dd4feda518a0e2ac4319aa3509864bb26f090b342e590cb4cbdc53fd700c300d119bf894c86c36087a285dbf2a04ce6fc02057327784122b05851b";
const H11 = "0x" + "11".repeat(32);
const H22 = "0x" + "22".repeat(32);
const REWARDS = "0x1B600A1b835E95b1c9D91B8f29aC82ac37D5718b";
const TOKEN = "0x2b85b57383bA4C7eDABf6289E6bfe3a9C4833Cde";
// cast mktx --private-key 0x…01 --chain 46630 --nonce 7 --gas-limit 120000 --gas-price 200000000 --priority-gas-price 0 0x…AA "setRoot(uint256,bytes32,uint256)" 2964 0x11…11 1e18
const MKTX_SETROOT =
  "0x02f8ce82b6260780840bebc2008301d4c09400000000000000000000000000000000000000aa80b864c6ab7b2e0000000000000000000000000000000000000000000000000000000000000b9411111111111111111111111111111111111111111111111111111111111111110000000000000000000000000000000000000000000000000de0b6b3a7640000c001a079718a19c10c629cf0921919cedb0f5df9927ff0ef637ce50c7d3d5a816b48a6a0564248934eaebe8df50de877f108163b0425de5bc98fe7e21b8ab3e4cc7b6092";
// cast mktx --private-key 0x…01 --chain 46630 --nonce 3 --gas-limit 90000 --gas-price 1000000000 --priority-gas-price 1000000 REWARDS "claim(uint256,address,uint256,bytes32[])" 5 ADDR1 1000 "[H11,H22]"
const MKTX_CLAIM =
  "0x02f9015182b62603830f4240843b9aca0083015f90941b600a1b835e95b1c9d91b8f29ac82ac37d5718b80b8e42e7ba6ef00000000000000000000000000000000000000000000000000000000000000050000000000000000000000007e5f4552091a69125d5dfcb7b8c2659029395bdf00000000000000000000000000000000000000000000000000000000000003e80000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000211111111111111111111111111111111111111111111111111111111111111112222222222222222222222222222222222222222222222222222222222222222c080a0e343e6667fe4c28e25b7fd5d59a72cf4ed4c0f6dbd2ea91f9f4a88f0c6b5584da0762225824e4c881b1d6c968bfb2fb95110b06182909db07d8eb9c4466a62a296";
// cast mktx --private-key 0x…01 --chain 46630 --nonce 4 --gas-limit 65000 --gas-price 2000000000 --priority-gas-price 1500000 TOKEN "transfer(address,uint256)" ADDR_OUT 1e18
const MKTX_TRANSFER =
  "0x02f8b082b626048316e360847735940082fde8942b85b57383ba4c7edabf6289e6bfe3a9c4833cde80b844a9059cbb0000000000000000000000008ba1f109551bd432803012645ac136ddd64dba720000000000000000000000000000000000000000000000000de0b6b3a7640000c001a00de0dc3064e06da5f3d94e7a0f1e7e95424310f87e83079c51415291dc4efa8ea0098d7426126c66e7baad18f13e55068230ba60d0caf867ab6b6e51af5f78c788";
const TRANSFER_DATA =
  "0xa9059cbb0000000000000000000000008ba1f109551bd432803012645ac136ddd64dba720000000000000000000000000000000000000000000000000de0b6b3a7640000";

describe("SEC-W21 secp256k1 / keccak / EIP-191 / EIP-1559 against cast vectors", () => {
  it("SEC-W21 addresses (EIP-55) match cast wallet address", () => {
    expect(privateKeyToAddress(KEY1)).toBe(ADDR1);
    expect(privateKeyToAddress(KEY2)).toBe(ADDR2);
    expect(toChecksumAddress(ADDR1.toLowerCase())).toBe(ADDR1);
  });

  it("SEC-W21 checksum validation: a mixed-case address must carry a valid EIP-55 checksum", () => {
    expect(isValidAddress(ADDR1)).toBe(true);
    expect(isValidAddress(ADDR1.toLowerCase())).toBe(true);
    expect(isValidAddress(ADDR1.replace("E5F", "e5F"))).toBe(false);
    expect(isValidAddress("0x123")).toBe(false);
    expect(isValidAddress(ADDR1 + "0")).toBe(false);
  });

  it("SEC-W21 personal_sign is byte for byte cast wallet sign, and recovers the signer", () => {
    expect(personalSign("hello VVake", KEY1)).toBe(SIG_HELLO);
    expect(personalSign(SIWE_LINE, KEY2)).toBe(SIG_SIWE_LINE);
    expect(recoverPersonalSigner("hello VVake", SIG_HELLO)).toBe(ADDR1);
    expect(recoverPersonalSigner("hello VVake!", SIG_HELLO)).not.toBe(ADDR1);
    expect(recoverPersonalSigner("hello VVake", "0x1234")).toBeNull();
  });

  it("SEC-W21 EIP-1559 (type 2, chain 46630) transactions are byte for byte cast mktx", () => {
    expect(
      signEip1559(
        {
          chainId: 46630,
          nonce: 7n,
          maxPriorityFeePerGas: 0n,
          maxFeePerGas: 200_000_000n,
          gas: 120_000n,
          to: "0x" + "00".repeat(19) + "aa",
          value: 0n,
          data:
            "0xc6ab7b2e" +
            "0000000000000000000000000000000000000000000000000000000000000b94" +
            "11".repeat(32) +
            "0000000000000000000000000000000000000000000000000de0b6b3a7640000",
        },
        KEY1,
      ),
    ).toBe(MKTX_SETROOT);
    expect(
      signEip1559(
        {
          chainId: 46630,
          nonce: 3n,
          maxPriorityFeePerGas: 1_000_000n,
          maxFeePerGas: 1_000_000_000n,
          gas: 90_000n,
          to: REWARDS,
          value: 0n,
          data: claimCalldata(5, ADDR1, 1000n, [H11, H22]),
        },
        KEY1,
      ),
    ).toBe(MKTX_CLAIM);
    expect(
      signEip1559(
        {
          chainId: 46630,
          nonce: 4n,
          maxPriorityFeePerGas: 1_500_000n,
          maxFeePerGas: 2_000_000_000n,
          gas: 65_000n,
          to: TOKEN,
          value: 0n,
          data: TRANSFER_DATA,
        },
        KEY1,
      ),
    ).toBe(MKTX_TRANSFER);
  });

  it("SEC-W21 the transaction hash is keccak256 of the raw bytes", () => {
    expect(txHash(MKTX_SETROOT)).toMatch(/^0x[0-9a-f]{64}$/);
    expect(txHash(MKTX_SETROOT)).not.toBe(txHash(MKTX_CLAIM));
  });

  it("SEC-W21 a fresh key is 32 random bytes from the CSPRNG, a valid scalar, and never repeats", () => {
    const a = generatePrivateKey();
    const b = generatePrivateKey();
    expect(a).toBeInstanceOf(Uint8Array);
    expect(a.length).toBe(32);
    expect(bytesToHex(a)).not.toBe(bytesToHex(b));
    expect(privateKeyToAddress(a)).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
});

describe("SEC-W14 buffers are zeroed after use", () => {
  it("SEC-W14 wipe() zeroes Uint8Arrays and ArrayBuffers in place and ignores null", () => {
    const k = new Uint8Array([1, 2, 3, 4]);
    const buf = new Uint8Array([9, 9, 9]).buffer;
    wipe(k, buf, null, undefined);
    expect([...k]).toEqual([0, 0, 0, 0]);
    expect([...new Uint8Array(buf)]).toEqual([0, 0, 0]);
  });

  it("SEC-W14 wipe() zeroes a view's whole window only (not the bytes around it)", () => {
    const backing = new Uint8Array([7, 7, 7, 7, 7, 7]);
    wipe(backing.subarray(1, 4));
    expect([...backing]).toEqual([7, 0, 0, 0, 7, 7]);
  });
});
