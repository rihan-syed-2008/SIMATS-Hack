import { useState } from "react";
import { UIContext } from "./UIContext";

export const UIProvider = ({ children }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <UIContext.Provider value={{ isModalOpen, setIsModalOpen }}>
      {children}
    </UIContext.Provider>
  );
};
