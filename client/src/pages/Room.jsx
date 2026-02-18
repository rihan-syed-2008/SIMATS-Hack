import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import { useRef } from "react";
import "./Room.css";
import Whiteboard from "../components/Whiteboard";

const socket = io(import.meta.env.VITE_API_URL);

// ⚠️ Keep outside component so it doesn't reconnect every render

const Room = () => {
  const { code } = useParams();

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const username = localStorage.getItem("username");
  const [participants, setParticipants] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [hostId, setHostId] = useState(null);
  const [timeLeft, setTimeLeft] = useState(1500); // 25 mins default
  const [isRunning, setIsRunning] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(25);
  const [allowedUsers, setAllowedUsers] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [notification, setNotification] = useState(null);
  const timerRef = useRef(null);

  const navigate = useNavigate();

  // Join room when component loads
  useEffect(() => {
    const username = localStorage.getItem("username");

    socket.on("room_ended", () => {
      setNotification("Meeting ended by host");

      setTimeout(() => {
        setNotification(null);
        navigate("/dashboard");
      }, 2500); // 2.5 sec
    });

    socket.on("host_changed", ({ newHostId }) => {
      setHostId(newHostId);

      if (String(newHostId) === String(localStorage.getItem("userId"))) {
        setIsHost(true);
      } else {
        setIsHost(false);
      }
    });

    socket.on("system_message", (data) => {
      setMessages((prev) => [
        ...prev,
        { author: "System", message: data.message, system: true },
      ]);
    });

    socket.on("user_typing", (username) => {
      setTypingUser(username);
    });

    socket.on("user_stop_typing", () => {
      setTypingUser(null);
    });

    socket.on("update_permissions", (list) => {
      setAllowedUsers(list);
    });

    socket.emit("join_room", {
      roomCode: code,
      username: username,
      userId: localStorage.getItem("userId"),
    });

    socket.on("timer_update", (data) => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // If running → use endTime
      if (data.isRunning) {
        setIsRunning(true);

        timerRef.current = setInterval(() => {
          const remaining = Math.max(
            0,
            Math.floor((data.endTime - Date.now()) / 1000),
          );

          setTimeLeft(remaining);

          if (remaining <= 0) {
            clearInterval(timerRef.current);
            setIsRunning(false);
          }
        }, 1000);
      } else {
        // For paused OR reset
        setIsRunning(false);
        setTimeLeft(Math.floor(data.remainingTime / 1000));
      }
    });

    socket.on("receive_message", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    socket.on("update_participants", (users) => {
      setParticipants(users);
    });

    return () => {
      socket.off("timer_started");
      socket.off("receive_message");
      socket.off("update_participants");
      socket.off("update_permissions");
      socket.off("user_typing");
      socket.off("user_stop_typing");
      socket.off("system_message");
      socket.off("host_changed");
      socket.off("room_ended");

      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [code, navigate]);

  useEffect(() => {
    const fetchRoom = async () => {
      const token = localStorage.getItem("token");
      const userId = localStorage.getItem("userId");

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/rooms/${code}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await res.json();

      setHostId(data.host);

      if (String(data.host) === String(userId)) {
        setIsHost(true);
      }
    };

    fetchRoom();
  }, [code]);

  const handleTyping = (e) => {
    setMessage(e.target.value);

    socket.emit("typing", { roomCode: code, username });

    setTimeout(() => {
      socket.emit("stop_typing", { roomCode: code });
    }, 1500);
  };

  const sendMessage = () => {
    if (message.trim() === "") return;

    const messageData = {
      room: code,
      author: username,
      message: message,
    };

    socket.emit("send_message", messageData);
    setMessage("");
  };

  const leaveRoom = () => {
    socket.emit("leave_room", { roomCode: code });
    navigate("/dashboard", { replace: true });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // prevent new line
      sendMessage();
    }
  };

  return (
    <div className="room-wrapper">
      {/* Top Bar */}
      <div className="room-navbar">
        <h2>Room Code: {code}</h2>
        <div className="room-actions">
          {isHost && (
            <>
              <input
                type="number"
                min="1"
                placeholder="Minutes"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                style={{ width: "100px", marginRight: "10px" }}
              />

              <button
                className="start-btn"
                disabled={!customMinutes || customMinutes <= 0}
                onClick={() =>
                  socket.emit("start_timer", {
                    roomCode: code,
                    duration: customMinutes * 60 * 1000,
                  })
                }
              >
                {isRunning ? "Session Running..." : "Start Session"}
              </button>
            </>
          )}

          <button className="leave-btn" onClick={leaveRoom}>
            Leave
          </button>
          {isHost && (
            <button
              style={{ marginLeft: "10px", background: "red", color: "white" }}
              onClick={() => socket.emit("end_room", { roomCode: code })}
            >
              End Meeting
            </button>
          )}
        </div>
      </div>

      <div className="room-layout">
        {/* Chat Section */}
        <div className="chat-section">
          <h3>Chat</h3>

          <div className="chat-messages">
            {messages.map((msg, index) => (
              <p
                key={index}
                style={{
                  textAlign: msg.system ? "center" : "left",
                  color: msg.system ? "gray" : "black",
                  fontStyle: msg.system ? "italic" : "normal",
                }}
              >
                {!msg.system && <strong>{msg.author}: </strong>}
                {msg.message}
              </p>
            ))}
          </div>

          {typingUser && typingUser !== username && (
            <div
              style={{
                fontStyle: "italic",
                fontSize: "14px",
                marginTop: "5px",
              }}
            >
              {typingUser} is typing...
            </div>
          )}

          <div className="chat-input">
            <textarea
              value={message}
              onChange={handleTyping}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={2}
            />

            <button onClick={sendMessage}>Send</button>
          </div>
        </div>

        {/* Right Panel */}
        <div className="side-panel">
          <div className="participants-card">
            <h3>Participants</h3>
            <ul>
              {participants.map((user, index) => (
                <li key={index} style={{ marginBottom: "8px" }}>
                  {user.username}
                  {String(user.userId) === String(hostId) && " (Host)"}

                  {/* 🔥 Only show buttons if current user is host AND this is not host */}
                  {isHost && String(user.userId) !== String(hostId) && (
                    <button
                      style={{ marginLeft: "10px" }}
                      onClick={() => {
                        if (allowedUsers.includes(user.userId)) {
                          socket.emit("revoke_permission", {
                            roomCode: code,
                            userId: user.userId,
                          });
                        } else {
                          socket.emit("grant_permission", {
                            roomCode: code,
                            userId: user.userId,
                          });
                        }
                      }}
                    >
                      {allowedUsers.includes(user.userId) ? "Revoke" : "Allow"}
                    </button>
                  )}
                  {isHost && String(user.userId) !== String(hostId) && (
                    <button
                      style={{ marginLeft: "10px" }}
                      onClick={() =>
                        socket.emit("transfer_host", {
                          roomCode: code,
                          newHostId: user.userId,
                        })
                      }
                    >
                      Make Host
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="timer-card">
            <h3>Pomodoro</h3>

            <h1>
              {Math.floor(timeLeft / 60)
                .toString()
                .padStart(2, "0")}
              :{(timeLeft % 60).toString().padStart(2, "0")}
            </h1>

            {isHost && (
              <>
                <button
                  onClick={() => socket.emit("pause_timer", { roomCode: code })}
                >
                  Pause
                </button>

                <button
                  onClick={() =>
                    socket.emit("resume_timer", { roomCode: code })
                  }
                >
                  Resume
                </button>

                <button
                  onClick={() => socket.emit("reset_timer", { roomCode: code })}
                >
                  Reset
                </button>
              </>
            )}
          </div>
          {notification && (
            <div className="toast-notification">{notification}</div>
          )}
        </div>
      </div>
      <Whiteboard
        socket={socket}
        roomCode={code}
        isHost={isHost}
        allowedUsers={allowedUsers}
        userId={localStorage.getItem("userId")}
      />
    </div>
  );
};

export default Room;
