import { useEffect } from "react";
import { useRoute } from "./lib/router";
import { LanguageProvider } from "./lib/i18n";
import LandingPage from "./pages/LandingPage";
import CreateRoom from "./pages/CreateRoom";
import JoinRoom from "./pages/JoinRoom";
import RoomRoute from "./pages/RoomRoute";

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
    default:
      page = <LandingPage />;
  }

  return <LanguageProvider>{page}</LanguageProvider>;
}
