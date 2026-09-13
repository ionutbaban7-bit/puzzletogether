// jsdom environment for the UI smoke test (runs in Node via Vite SSR load).
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
  url: "http://localhost:4173/",
  pretendToBeVisual: true,
});

const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
try {
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
} catch {
  /* node 21+ has a global navigator */
}
for (const key of [
  "localStorage", "sessionStorage", "HTMLElement", "SVGElement", "Element", "Node",
  "MouseEvent", "KeyboardEvent", "PointerEvent", "Event", "CustomEvent", "FocusEvent",
  "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "Image", "Blob", "URL",
]) {
  if (dom.window[key as keyof Window] !== undefined) g[key] = dom.window[key as keyof Window];
}
if (!g.ResizeObserver) {
  g.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (!dom.window.matchMedia) {
  (dom.window as unknown as Record<string, unknown>).matchMedia = () => ({
    matches: false, media: "", onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
  });
}
g.matchMedia = dom.window.matchMedia;
g.IS_REACT_ACT_ENVIRONMENT = true;

// The app uses relative fetch URLs (browser origin). Point them at the live
// dev server so CreateRoom can load the real catalog.
const realFetch = g.fetch?.bind(globalThis);
if (realFetch) {
  g.fetch = (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("/")) return realFetch(new URL(url, "http://localhost:4173"), init);
    return realFetch(input as never, init);
  };
}

export const domWindow = dom.window;
