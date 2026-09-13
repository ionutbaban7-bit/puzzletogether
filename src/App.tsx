import { Suspense, lazy, useEffect } from "react";
import { useRoute } from "./lib/router";
import { LanguageProvider } from "./lib/i18n";
import LandingPage from "./pages/LandingPage";

// Route-level code-split: the landing stays in the initial bundle; the
// heavy surfaces (create, room stage, emotions zone) load on demand.
const CreateRoom = lazy(() => import("./pages/CreateRoom"));
const JoinRoom = lazy(() => import("./pages/JoinRoom"));
const RoomRoute = lazy(() => import("./pages/RoomRoute"));
const EmotionsPage = lazy(() => import("./pages/EmotionsPage"));

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="flex items-center gap-2.5 text-sm font-semibold text-g-sub">
        <span className="h-2 w-2 animate-pulse rounded-full bg-gradient-to-r from-[#1a73e8] to-[#7c3aed]" aria-hidden />
        <span aria-hidden className="tracking-[0.2em]">PUZZLETOGETHER</span>
      </div>
    </div>
  );
}

export default function App() {
  const route = useRoute();

  // Warm the puzzle catalog cache while the user is on the landing page.
  useEffect(() => {
    const t = setTimeout(() => {
      fetch("/api/puzzles").catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, []);

  let page;
  switch (route.name) {
    case "create":
      page = <CreateRoom />;
      break;
    case "join":
      page = <JoinRoom />;
      break;
    case "room":
      page = <RoomRoute roomId={route.roomId} />;
      break;
    case "emotions":
      page = <EmotionsPage />;
      break;
    default:
      page = <LandingPage />;
  }

  return (
    <LanguageProvider>
      <Suspense fallback={<PageLoader />}>{page}</Suspense>
    </LanguageProvider>
  );
}
