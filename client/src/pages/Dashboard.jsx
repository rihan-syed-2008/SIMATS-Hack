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
  const [invitedUsers, setInvitedUsers] = useState([]);
  const [scheduleError, setScheduleError] = useState("");
  const [joinError, setJoinError] = useState("");
  //const upcomingSessions = sessions.filter((s) => !s.isActive);
  //const liveSessions = sessions.filter((s) => s.isActive);

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
          invitedUsers,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setSessions((prev) => [...prev, res.data]);

      setShowSchedule(false);
      setTitle("");
      setScheduledFor("");
      setDuration(30);
      setInvitedUsers([]);
    } catch (err) {
      if (err.response?.status === 400) {
        setScheduleError("Cannot schedule a meeting in the past.");
      } else {
        console.log(err);
      }
    }
  };

  const handleCancel = async (id) => {
    try {
      const token = localStorage.getItem("token");

      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/rooms/cancel/${id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setSessions((prev) => prev.filter((s) => s._id !== id));
    } catch (err) {
      console.log(err);
    }
  };

  const handleInvite = (e) => {
    const id = e.target.value;

    if (e.target.checked) {
      setInvitedUsers((prev) => [...prev, id]);
    } else {
      setInvitedUsers((prev) => prev.filter((u) => u !== id));
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
  const fetchSessions = async () => {
    const token = localStorage.getItem("token");

    const res = await axios.get(
      `${import.meta.env.VITE_API_URL}/api/rooms/upcoming`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    setSessions(res.data);
  };
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSessions();
    }, 3000); // refresh every 3 seconds

    return () => clearInterval(interval);
  }, []);

  const userId = localStorage.getItem("userId");

  const hostedSessions = sessions.filter((session) => session.host === userId);

  const invitedSessions = sessions.filter((session) => session.host !== userId);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getTimeLeft = (date) => {
    const diff = new Date(date).getTime() - now;

    if (diff <= 0) return "Starting now";

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h left`;
    if (hours > 0) return `${hours}h ${minutes % 60}m left`;
    return `${minutes}m left`;
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
            {joinError && (
              <p style={{ color: "red", fontSize: "14px" }}>{joinError}</p>
            )}

            <button
              onClick={async () => {
                try {
                  setJoinError(""); // clear old error

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

        {/* HOSTED SECTION */}
        <h4>Hosted by You</h4>
        <div className="sessions-grid">
          {hostedSessions.length === 0 ? (
            <p>No hosted sessions</p>
          ) : (
            hostedSessions.map((session) => {
              const canStart = new Date(session.scheduledFor) <= new Date();

              return (
                <div key={session._id} className="session-card">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <h4>{session.title}</h4>

                    {session.isActive && (
                      <span className="live-badge">LIVE</span>
                    )}
                  </div>

                  <p>
                    Starts at: {new Date(session.scheduledFor).toLocaleString()}
                  </p>

                  <p>Duration: {session.duration} mins</p>

                  <p className="countdown">
                    {getTimeLeft(session.scheduledFor)}
                  </p>

                  {/* Start Button */}
                  {/* Start Button */}
                  {!canStart ? (
                    <button disabled style={{ opacity: 0.5 }}>
                      Starts at scheduled time
                    </button>
                  ) : session.isActive ? (
                    <button
                      onClick={() => navigate(`/room/${session.code}`)}
                      style={{ background: "green", color: "white" }}
                    >
                      Enter Meeting
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem("token");

                          await axios.post(
                            `${import.meta.env.VITE_API_URL}/api/rooms/start/${session._id}`,
                            {},
                            {
                              headers: { Authorization: `Bearer ${token}` },
                            },
                          );

                          navigate(`/room/${session.code}`);
                        } catch (err) {
                          console.log(err);
                        }
                      }}
                      style={{ background: "green", color: "white" }}
                    >
                      Start Meeting
                    </button>
                  )}

                  {/* Cancel Button */}
                  <button
                    onClick={() => handleCancel(session._id)}
                    style={{
                      marginTop: "10px",
                      background: "red",
                      color: "white",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* INVITED SECTION */}
        <h4 style={{ marginTop: "30px" }}>Invited to You</h4>
        <div className="sessions-grid">
          {invitedSessions.length === 0 ? (
            <p>No invited sessions</p>
          ) : (
            invitedSessions.map((session) => {
              const isLive = session.isActive;

              return (
                <div key={session._id} className="session-card">
                  <h4>{session.title}</h4>

                  <p>
                    Starts at: {new Date(session.scheduledFor).toLocaleString()}
                  </p>

                  <p>Duration: {session.duration} mins</p>

                  <p className="countdown">
                    {getTimeLeft(session.scheduledFor)}
                  </p>

                  {isLive ? (
                    <button
                      onClick={() => navigate(`/room/${session.code}`)}
                      style={{ background: "#007bff", color: "white" }}
                    >
                      Join Meeting
                    </button>
                  ) : (
                    <button disabled style={{ opacity: 0.5 }}>
                      Waiting for host to start...
                    </button>
                  )}
                </div>
              );
            })
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
              min={new Date().toISOString().slice(0, 16)}
              onChange={(e) => setScheduledFor(e.target.value)}
            />

            {scheduleError && (
              <p style={{ color: "red", fontSize: "14px" }}>{scheduleError}</p>
            )}

            <input
              type="number"
              placeholder="Duration (minutes)"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            <h4>Invite Friends</h4>
            {friends.map((friend) => (
              <label key={friend._id}>
                <input
                  type="checkbox"
                  value={friend._id}
                  onChange={(e) => handleInvite(e)}
                />
                {friend.name}
              </label>
            ))}

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
