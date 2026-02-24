import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Home.css";
import { useUI } from "../context/useUI";

const Home = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [joinError, setJoinError] = useState("");

  const navigate = useNavigate();
  const API = `${import.meta.env.VITE_API_URL}/api/rooms`;
  const { setIsModalOpen } = useUI();

  return (
    <div className="home-wrapper">
      <div className="home-header">
        <h1 className="home-title">Welcome back</h1>
        <p className="home-subtitle">Start or join a focused study session</p>
        <div className="home-divider"></div>
      </div>
      {/* Action Cards */}
      <div className="action-grid">
        <div className="action-card">
          <h2>Create Room</h2>
          <p>Start a new collaborative study session.</p>
          <button
            onClick={() => {
              setShowCreate(true);
              setIsModalOpen(true);
            }}
          >
            Create
          </button>
        </div>

        <div className="action-card">
          <h2>Join Room</h2>
          <p>Enter a 6-digit code to join a session.</p>
          <button
            onClick={() => {
              setShowJoin(true);
              setIsModalOpen(true);
            }}
          >
            Join
          </button>
        </div>
      </div>

      {/* AI SECTION */}
      <div className="ai-section">
        <div className="ai-section-header">
          <h2>Your AI Study Tools</h2>
          <p>Enhance your focus with intelligent learning assistance</p>
        </div>

        <div className="ai-grid">
          <div className="ai-card" onClick={() => navigate("/ai/quiz")}>
            <h3>AI Quiz Generator</h3>
            <p>Generate instant quizzes for any topic.</p>
          </div>

          <div className="ai-card" onClick={() => navigate("/ai/flashcards")}>
            <h3>AI Flashcards</h3>
            <p>Generate smart revision flashcards instantly.</p>
          </div>

          <div className="ai-card" onClick={() => navigate("/ai/chat")}>
            <h3>AI Doubt Solver</h3>
            <p>Ask questions and get instant explanations.</p>
          </div>
        </div>
      </div>

      {/* CREATE ROOM MODAL */}
      {showCreate && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2>Create Room</h2>
            <p>Room will generate a 6-digit code.</p>

            <button
              onClick={async () => {
                try {
                  const token = localStorage.getItem("token");

                  const res = await axios.post(
                    API + "/create",
                    {},
                    {
                      headers: {
                        Authorization: `Bearer ${token}`,
                      },
                    },
                  );

                  navigate(`/room/${res.data.code}`, { replace: true });
                } catch (err) {
                  console.error(err);
                }
              }}
            >
              Confirm
            </button>

            <button
              className="close-btn"
              onClick={() => {
                setShowCreate(false);
                setIsModalOpen(false);
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* JOIN ROOM MODAL */}
      {showJoin && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2>Join Room</h2>

            <input
              type="text"
              placeholder="Enter 6-digit code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
            />

            {joinError && (
              <p style={{ color: "red", fontSize: "14px" }}>{joinError}</p>
            )}

            <button
              onClick={async () => {
                try {
                  setJoinError("");

                  const token = localStorage.getItem("token");

                  await axios.post(
                    API + "/join",
                    { code: roomCode },
                    {
                      headers: { Authorization: `Bearer ${token}` },
                    },
                  );

                  navigate(`/room/${roomCode}`, { replace: true });
                } catch (err) {
                  if (err.response?.status === 404) {
                    setJoinError("Room does not exist.");
                  } else if (err.response?.status === 400) {
                    setJoinError("Host has not started the meeting yet.");
                  } else {
                    setJoinError("Something went wrong.");
                  }
                }
              }}
            >
              Join
            </button>

            <button
              className="close-btn"
              onClick={() => {
                setShowJoin(false);
                setIsModalOpen(false);
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
