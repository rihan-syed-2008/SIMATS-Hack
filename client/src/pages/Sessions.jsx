import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Sessions.css";
import tingSound from "../assets/ting.mp3";
import { useRef } from "react";

const Sessions = () => {
  const [sessions, setSessions] = useState([]);
  const [showSchedule, setShowSchedule] = useState(false);
  const [title, setTitle] = useState("");
  const [setScheduledFor] = useState("");
  const [duration, setDuration] = useState(30);
  const [invitedUsers, setInvitedUsers] = useState([]);
  const [scheduleError, setScheduleError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const audioRef = useRef(new Audio(tingSound));
  const hasPlayedRef = useRef({});

  const navigate = useNavigate();
  const userId = localStorage.getItem("userId");

  const API = `${import.meta.env.VITE_API_URL}/api/rooms`;

  const handleSchedule = async () => {
    if (!isFormValid || loading) return;
    try {
      if (!isFormValid || loading) return;
      const token = localStorage.getItem("token");

      const scheduledForISO = `${date}T${time}`;

      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/rooms/schedule`,
        {
          title,
          scheduledFor: scheduledForISO,
          duration,
          invitedUsers,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      await fetchSessions();

      resetScheduleForm();
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
    } finally {
      setLoading(false);
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

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    const token = localStorage.getItem("token");

    const res = await axios.get(
      `${import.meta.env.VITE_API_URL}/api/rooms/upcoming`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    setSessions(res.data);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchSessions();
    }, 3000); // refresh every 3 seconds

    return () => clearInterval(interval);
  }, [fetchSessions]);

  // Countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
      sessions.forEach((session) => {
        const diff = new Date(session.scheduledFor).getTime() - Date.now();

        if (diff <= 0 && !hasPlayedRef.current[session._id]) {
          audioRef.current.play().catch(() => {});
          hasPlayedRef.current[session._id] = true;
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sessions]);

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

  const getTimeLeft = (date) => {
    const diff = new Date(date).getTime() - now;

    if (diff <= 0) return { text: "Starting now", urgent: true };

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) return { text: `${days}d ${hours}h`, urgent: false };
    if (hours > 0) return { text: `${hours}h ${minutes}m`, urgent: false };
    if (minutes > 0)
      return { text: `${minutes}m ${seconds}s`, urgent: minutes < 1 };

    return { text: `${seconds}s`, urgent: true };
  };

  const hostedSessions = sessions.filter((session) => session.host === userId);

  const invitedSessions = sessions.filter((session) => session.host !== userId);

  const isFormValid = date && time && duration > 0;

  const resetScheduleForm = () => {
    setTitle("");
    setDate("");
    setTime("");
    setDuration(30);
    setInvitedUsers([]);
    setScheduleError("");
  };

  return (
    <div className="sessions-wrapper">
      <div className="sessions-header">
        <div className="sessions-title-block">
          <h1>Your Sessions</h1>
          <p>Manage and track your upcoming study sessions</p>
          <div className="sessions-divider" />
        </div>

        <button className="schedule-btn" onClick={() => setShowSchedule(true)}>
          + Schedule
        </button>
      </div>

      <div className="sessions-grid-layout">
        <section className="sessions-column">
          <h3>Hosted by You</h3>
          <div className="sessions-grid">
            {hostedSessions.length === 0 ? (
              <div className="empty-state">
                <h4>No Upcoming Sessions</h4>
                <p>Schedule a study session and start collaborating.</p>
                <button
                  className="schedule-btn"
                  onClick={() => setShowSchedule(true)}
                >
                  + Schedule Now
                </button>
              </div>
            ) : (
              hostedSessions.map((session) => {
                const canStart = new Date(session.scheduledFor) <= new Date();

                return (
                  <div key={session._id} className="session-card">
                    <div className="session-card-header">
                      <h4>{session.title}</h4>
                      {session.isActive && (
                        <span className="live-badge">LIVE</span>
                      )}
                    </div>

                    <div className="session-info">
                      <p>
                        {new Date(session.scheduledFor).toLocaleString("en-GB")}
                      </p>
                      <p>Duration: {session.duration} mins</p>
                      {(() => {
                        const time = getTimeLeft(session.scheduledFor);
                        return (
                          <p
                            className={`countdown ${time.urgent ? "urgent" : ""}`}
                          >
                            {time.text}
                          </p>
                        );
                      })()}
                    </div>
                    <div className="session-actions">
                      {!canStart ? (
                        <button className="btn-disabled" disabled>
                          Starts at scheduled time
                        </button>
                      ) : session.isActive ? (
                        <button
                          className="btn-primary"
                          onClick={() => navigate(`/room/${session.code}`)}
                        >
                          Join Live Session
                        </button>
                      ) : (
                        <button
                          className="btn-primary"
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
                        >
                          Start Meeting
                        </button>
                      )}

                      {/* Cancel Button */}
                      <button
                        className="btn-danger"
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
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="sessions-column">
          <h3>Invited to You</h3>
          <div className="sessions-grid">
            {invitedSessions.length === 0 ? (
              <div className="empty-state invited-empty">
                <h4>No Invitations Yet</h4>
                <p>
                  When someone schedules a study session and invites you, it
                  will appear here.
                </p>
              </div>
            ) : (
              invitedSessions.map((session) => {
                const isLive = session.isActive;

                return (
                  <div key={session._id} className="session-card invited-card">
                    <div className="session-header">
                      <span className="invited-tag">INVITED</span>
                      <h4>{session.title}</h4>
                      <p>
                        Starts at:{" "}
                        {new Date(session.scheduledFor).toLocaleString("en-GB")}
                      </p>
                      <p>Duration: {session.duration} mins</p>
                      {(() => {
                        const time = getTimeLeft(session.scheduledFor);
                        return (
                          <p
                            className={`countdown ${time.urgent ? "urgent" : ""}`}
                          >
                            {time.text}
                          </p>
                        );
                      })()}
                      {isLive ? (
                        <button
                          className="join-btn"
                          onClick={() => navigate(`/room/${session.code}`)}
                        >
                          Join Meeting
                        </button>
                      ) : (
                        <button className="waiting-btn" disabled>
                          Waiting for host...
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
      {showSchedule && (
        <div className="modal-overlay">
          <div className="schedule-card">
            <h3>Schedule Meeting</h3>

            <div className="form-group">
              <label>Session Title</label>
              <input
                type="text"
                placeholder="Optional title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="datetime-row">
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={date}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>

            {scheduleError && <p className="error-text">{scheduleError}</p>}

            <div className="form-group">
              <label>Duration (minutes)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div className="invite-dropdown">
              <label>Invite Friends</label>
              <div className="invite-box">
                {friends.map((friend) => (
                  <label key={friend._id} className="invite-item">
                    <input
                      type="checkbox"
                      value={friend._id}
                      onChange={handleInvite}
                    />
                    {friend.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button
                className={`schedule-btn ${loading ? "loading" : ""}`}
                onClick={handleSchedule}
                disabled={!isFormValid || loading}
              >
                {loading ? "Scheduling..." : "Schedule"}
              </button>
              <button
                className="cancel-btn"
                onClick={() => {
                  resetScheduleForm();
                  setShowSchedule(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sessions;
