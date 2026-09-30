"use client";

import { useEffect } from "react";
import { HAND_DOT, HAND_PATH, HAND_TRANSFORM, HAND_VIEWBOX } from "./handMark";

/**
 * Writes the brand with the sign everywhere: the "VV" of every "VVak…" word in the page (VVake, VVaker, VVake up…)
 * becomes the hand, like the logo. The $VVAKE ticker is uppercase and stays text, as do form fields, code and
 * anything under [data-no-sign]. Screen readers and search still read "VV" (kept as visually hidden text).
 * Runs after hydration and on content that appears later (e.g. the signup success panel).
 */
// Not in handles, links or emails (@VVakeFit, vvake.com/…): those stay as typed.
const WORD = /(?<![@\w/.])VVak/;
const SKIP = "script,style,textarea,input,select,option,code,pre,svg,[contenteditable],[data-no-sign],[data-sign]";
const SVG_NS = "http://www.w3.org/2000/svg";

function hand(): HTMLSpanElement {
  const wrap = document.createElement("span");
  wrap.dataset.sign = "";
  // Plain inline (not flex) so copy-paste reads "VVake" on one line; "VV" is zero-size text, still read aloud.
  const sr = document.createElement("span");
  sr.className = "text-[0px]";
  sr.textContent = "VV";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", HAND_VIEWBOX);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "mr-[0.02em] inline-block h-[1.02em] w-auto translate-y-[0.1em] align-baseline");
  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("transform", HAND_TRANSFORM);
  g.setAttribute("fill", "currentColor");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", HAND_PATH);
  g.appendChild(path);
  const dot = document.createElementNS(SVG_NS, "circle");
  dot.setAttribute("cx", String(HAND_DOT.cx));
  dot.setAttribute("cy", String(HAND_DOT.cy));
  dot.setAttribute("r", String(HAND_DOT.r));
  dot.setAttribute("fill", "var(--color-volt-fg)");
  svg.append(g, dot);
  wrap.append(sr, svg);
  return wrap;
}

/**
 * Splits one text node at each "VVak…": text before, then [hand] + the rest of the word. In a flex or grid parent
 * the pieces would become separate items (spread apart, breaking the line), so the sentence is first wrapped in a
 * single inline span there.
 */
function convert(node: Text) {
  const parent = node.parentElement;
  if (parent && /flex|grid/.test(getComputedStyle(parent).display)) {
    const line = document.createElement("span");
    line.dataset.signLine = "";
    parent.insertBefore(line, node);
    line.appendChild(node);
  }
  let current: Text = node;
  for (let m = WORD.exec(current.data); m; m = WORD.exec(current.data)) {
    const rest = current.splitText(m.index); // rest starts with "VVak…"
    rest.data = rest.data.slice(2); // drop "VV": the hand replaces it
    rest.parentNode!.insertBefore(hand(), rest);
    current = rest;
  }
}

function sweep(root: Node) {
  const el = root.nodeType === Node.ELEMENT_NODE ? (root as Element) : root.parentElement;
  if (!el || el.closest(SKIP)) return;
  if (root.nodeType === Node.TEXT_NODE) {
    if (WORD.test((root as Text).data)) convert(root as Text);
    return;
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      WORD.test((n as Text).data) && !n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  });
  const found: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) found.push(n as Text);
  found.forEach(convert);
}

export function SignSweep() {
  useEffect(() => {
    // Wait until React has hydrated everything, Suspense boundaries included (they hydrate after the page):
    // editing server HTML React hasn't claimed yet would make it re-render that part.
    let observer: MutationObserver | undefined;
    const start = () => {
      sweep(document.body);
      observer = new MutationObserver((records) => {
        for (const r of records) {
          if (r.type === "characterData") sweep(r.target);
          r.addedNodes.forEach((n) => sweep(n));
        }
      });
      observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    };
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
    const whenLoaded = () => idle(start, { timeout: 1500 });
    if (document.readyState === "complete") whenLoaded();
    else window.addEventListener("load", whenLoaded, { once: true });
    return () => {
      window.removeEventListener("load", whenLoaded);
      observer?.disconnect();
    };
  }, []);
  return null;
}
