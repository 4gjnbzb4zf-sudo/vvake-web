import { describe, expect, it } from "vitest";
import { base64Bytes, dataUrlBase64, fitSize, PHOTO_MAX_EDGE } from "./image";

describe("meal photo shrink", () => {
  it("keeps the long edge at 1024 and the ratio", () => {
    expect(fitSize(4032, 3024)).toEqual({ w: 1024, h: 768 });
    expect(fitSize(3024, 4032)).toEqual({ w: 768, h: 1024 });
    expect(fitSize(2000, 2000)).toEqual({ w: PHOTO_MAX_EDGE, h: PHOTO_MAX_EDGE });
  });
  it("never upscales a small photo", () => {
    expect(fitSize(640, 480)).toEqual({ w: 640, h: 480 });
  });
  it("survives a broken size", () => {
    expect(fitSize(0, 100)).toEqual({ w: 1, h: 1 });
    expect(fitSize(Number.NaN, 100)).toEqual({ w: 1, h: 1 });
    expect(fitSize(10000, 1)).toEqual({ w: 1024, h: 1 });
  });
  it("reads a data URL's base64 and its bytes", () => {
    expect(dataUrlBase64("data:image/jpeg;base64,QUJD")).toBe("QUJD");
    expect(dataUrlBase64("data:text/plain;base64,QUJD")).toBeNull();
    expect(dataUrlBase64("data:,")).toBeNull();
    expect(base64Bytes("QUJD")).toBe(3);
    expect(base64Bytes("QUI=")).toBe(2);
    expect(base64Bytes("QQ==")).toBe(1);
  });
});
