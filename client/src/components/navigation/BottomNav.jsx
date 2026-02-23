import Dock from "./Dock";
import { useNavigate, useLocation } from "react-router-dom";
import {
  VscHome,
  VscCalendar,
  VscAccount,
  VscOrganization,
} from "react-icons/vsc";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    {
      icon: <VscHome size={20} />,
      label: "Home",
      onClick: () => navigate("/home"),
      className: location.pathname === "/home" ? "active-dock" : "",
    },
    {
      icon: <VscCalendar size={20} />,
      label: "Sessions",
      onClick: () => navigate("/sessions"),
      className: location.pathname === "/sessions" ? "active-dock" : "",
    },
    {
      icon: <VscOrganization size={20} />,
      label: "Friends",
      onClick: () => navigate("/friends"),
      className: location.pathname === "/friends" ? "active-dock" : "",
    },
    {
      icon: <VscAccount size={20} />,
      label: "Profile",
      onClick: () => navigate("/profile"),
      className: location.pathname === "/profile" ? "active-dock" : "",
    },
  ];

  return (
    <Dock items={items} panelHeight={80} baseItemSize={50} magnification={70} />
  );
};

export default BottomNav;
