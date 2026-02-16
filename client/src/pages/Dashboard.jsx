import React, { useState } from "react";
import "./Dashboard.css";

import axios from "axios";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const API = "http://10.190.195.151:5000/api/rooms";
  const navigate = useNavigate();

  return (
    <div className="dashboard-wrapper">
      {/* Navbar */}
      <div className="navbar">
        <h1>WE Dashboard</h1>
        <button className="logout-btn">Logout</button>
      </div>

      <div className="dashboard-content">
        {/* Action Cards */}
        <div className="action-grid">
          <div className="action-card">
            <h2>Create Room</h2>
            <p>Start a new collaborative study session.</p>
            <button onClick={() => setShowCreate(true)}>Create</button>
          </div>

          <div className="action-card">
            <h2>Join Room</h2>
            <p>Enter a 6-digit code to join a session.</p>
            <button onClick={() => setShowJoin(true)}>Join</button>
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
                  console.log("Create clicked");
                  navigate(`/room/${res.data.code}`);
                } catch (err) {
                  console.error(err);
                }
              }}
            >
              Confirm
            </button>

            <button className="close-btn" onClick={() => setShowCreate(false)}>
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
            <button
              onClick={async () => {
                const token = localStorage.getItem("token");

                await axios.post(
                  API + "/join",
                  { code: roomCode },
                  {
                    headers: { Authorization: `Bearer ${token}` },
                  },
                );

                navigate(`/room/${roomCode}`);
              }}
            >
              Join
            </button>

            <button className="close-btn" onClick={() => setShowJoin(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
