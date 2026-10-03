import { useEffect, useState } from "react";

export type Route =
  | { name: "landing" }
  | { name: "create" }
  | { name: "join" }
  | { name: "room"; roomId: string };

export function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function parseRoute(): Route {
  const path = window.location.pathname;
  if (path === "/create") return { name: "create" };
  if (path === "/join") return { name: "join" };
  const m = path.match(/^\/room\/([^/]+)/);
  if (m) return { name: "room", roomId: decodeURIComponent(m[1]) };
  return { name: "landing" };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseRoute);
  useEffect(() => {
    const onChange = () => setRoute(parseRoute());
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
  }, []);
  return route;
}

export function joinQueryCode(): string {
  return new URLSearchParams(window.location.search).get("c") || "";
}
