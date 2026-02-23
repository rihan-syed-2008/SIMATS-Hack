import AuroraBackground from "../components/background/AuroraBackground";
import BottomNav from "../components/navigation/BottomNav";
import { Outlet } from "react-router-dom";
import { useUI } from "../context/useUI";
import { useLocation } from "react-router-dom";

const AppLayout = () => {
  const location = useLocation();
  const { isModalOpen } = useUI();

  const shouldPause =
    location.pathname === "/sessions" ||
    location.pathname === "/friends" ||
    location.pathname === "/profile" ||
    isModalOpen;
  return (
    <>
      <AuroraBackground paused={shouldPause} />

      <div className="app-container">
        <Outlet />
      </div>

      <BottomNav />
    </>
  );
};

export default AppLayout;
