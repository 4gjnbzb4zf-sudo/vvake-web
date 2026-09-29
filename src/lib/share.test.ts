import { describe, expect, it } from "vitest";
import { shareUrl } from "./referral";

const text = "Throw the sign. Wake Lyon.";
const url = "https://vvake.com/en/?ref=abc123&city=lyon";

describe("shareUrl", () => {
  it("prefills each network with the text and the invite link", () => {
    expect(shareUrl("x", text, url)).toContain("x.com/intent/post");
    expect(decodeURIComponent(shareUrl("whatsapp", text, url))).toContain(`${text} ${url}`);
    expect(decodeURIComponent(shareUrl("telegram", text, url))).toContain(url);
    expect(decodeURIComponent(shareUrl("linkedin", text, url))).toContain(url);
    expect(decodeURIComponent(shareUrl("threads", text, url))).toContain(text);
  });
});
