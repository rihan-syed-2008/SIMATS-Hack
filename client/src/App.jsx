import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Room from "./pages/Room";

import AppLayout from "./layouts/AppLayout";
import Home from "./pages/Home";
import Sessions from "./pages/Sessions";
import Friends from "./pages/Friends";
import Profile from "./pages/Profile";

import Chat from "./aiComponents/Chat";
import Quiz from "./aiComponents/Quiz";
import Flashcards from "./aiComponents/Flashcard";

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/" replace />;
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/home" element={<Home />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/profile" element={<Profile />} />

        <Route path="/ai/chat" element={<Chat />} />
        <Route path="/ai/quiz" element={<Quiz />} />
        <Route path="/ai/flashcards" element={<Flashcards />} />
      </Route>

      <Route
        path="/room/:code"
        element={
          <ProtectedRoute>
            <Room />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
