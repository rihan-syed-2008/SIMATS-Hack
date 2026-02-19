import React, { useState, useEffect } from "react";
import "./Dashboard.css";

import axios from "axios";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [friends, setFriends] = useState([]);
  const [friendIdInput, setFriendIdInput] = useState("");
  const [friendError, setFriendError] = useState("");
  const [sessions, setSessions] = useState([]);
  const [showSchedule, setShowSchedule] = useState(false);
  const [title, setTitle] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [duration, setDuration] = useState(30);

  const publicId = localStorage.getItem("publicId");

  const API = `${import.meta.env.VITE_API_URL}/api/rooms`;
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("userId");
    navigate("/", { replace: true });
  };

  const handleSchedule = async () => {
    try {
      const token = localStorage.getItem("token");

      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/rooms/schedule`,
        {
          title,
          scheduledFor,
          duration,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setSessions((prev) => [...prev, res.data]);

      setShowSchedule(false);
      setTitle("");
      setScheduledFor("");
      setDuration(30);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    const loadFriends = async () => {
      const token = localStorage.getItem("token");

      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/users/friends`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setFriends(res.data);
    };

    loadFriends();
  }, []);

  /*const handleAddFriend = async () => {
    console.log("Add friend clicked");
    const token = localStorage.getItem("token");

    await axios.post(
      `${import.meta.env.VITE_API_URL}/api/users/add-friend`,
      { friendPublicId: friendIdInput },
      { headers: { Authorization: `Bearer ${token}` } },
    );

    setFriendIdInput("");
    window.location.reload(); // quick refresh for hackathon
  };*/
  const handleAddFriend = async () => {
    try {
      setFriendError("");
      const token = localStorage.getItem("token");

      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/users/add-friend`,
        { friendPublicId: friendIdInput },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setFriendIdInput("");

      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/users/friends`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setFriends(res.data);
    } catch (err) {
      setFriendError(err.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <div className="dashboard-wrapper">
      {/* Navbar */}
      <div className="navbar">
        <h1>WE Dashboard</h1>
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>

        <div className="profile-section">
          <div className="profile-icon">
            {publicId?.charAt(0).toUpperCase()}
          </div>
          <span className="profile-id">{publicId}</span>
        </div>
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
                  navigate(`/room/${res.data.code}`, { replace: true });
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

                navigate(`/room/${roomCode}`, { replace: true });
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
      <div className="friends-section">
        <h3>Friends</h3>

        <div className="add-friend">
          <input
            type="text"
            placeholder="Enter public ID"
            value={friendIdInput}
            onChange={(e) => setFriendIdInput(e.target.value)}
          />
          {friendError && (
            <p style={{ color: "red", fontSize: "14px" }}>{friendError}</p>
          )}

          <button onClick={handleAddFriend}>Add</button>
        </div>

        <ul>
          {friends.map((friend) => (
            <li key={friend._id}>
              {friend.name} ({friend.publicId})
            </li>
          ))}
        </ul>
      </div>
      <div className="upcoming-section">
        <div className="upcoming-header">
          <h3>Upcoming Sessions</h3>
          <button onClick={() => setShowSchedule(true)}>
            + Schedule Meeting
          </button>
        </div>

        <div className="sessions-grid">
          {sessions.length === 0 ? (
            <p>No upcoming sessions</p>
          ) : (
            sessions.map((session) => (
              <div key={session._id} className="session-card">
                <h4>{session.title}</h4>
                <p>
                  Starts at: {new Date(session.scheduledFor).toLocaleString()}
                </p>
                <p>Duration: {session.duration} mins</p>
              </div>
            ))
          )}
        </div>
      </div>
      {showSchedule && (
        <div className="schedule-modal">
          <div className="schedule-card">
            <h3>Schedule Meeting</h3>

            <input
              type="text"
              placeholder="Session Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
            />

            <input
              type="number"
              placeholder="Duration (minutes)"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />

            <div className="modal-actions">
              <button onClick={handleSchedule}>Schedule</button>
              <button onClick={() => setShowSchedule(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
