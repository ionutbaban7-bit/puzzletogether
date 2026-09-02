import { useEffect } from "react";
import { useRoute } from "./lib/router";
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

  switch (route.name) {
    case "create":
      return <CreateRoom />;
    case "join":
      return <JoinRoom />;
    case "room":
      return <RoomRoute roomId={route.roomId} />;
    default:
      return <LandingPage />;
  }
}
