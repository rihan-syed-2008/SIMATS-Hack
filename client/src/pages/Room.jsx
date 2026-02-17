import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import "./Room.css";

const socket = io("http://10.190.195.151:5000");

// ⚠️ Keep outside component so it doesn't reconnect every render

const Room = () => {
  const { code } = useParams();

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const username = localStorage.getItem("username");
  const [participants, setParticipants] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [hostId, setHostId] = useState(null);
  const navigate = useNavigate();

  // Join room when component loads
  useEffect(() => {
    const username = localStorage.getItem("username");

    socket.emit("join_room", {
      roomCode: code,
      username: username,
      userId: localStorage.getItem("userId"),
    });

    socket.on("receive_message", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    socket.on("update_participants", (users) => {
      setParticipants(users);
    });

    return () => {
      socket.off("receive_message");
      socket.off("update_participants");
    };
  }, [code]);

  useEffect(() => {
    const fetchRoom = async () => {
      const token = localStorage.getItem("token");
      const userId = localStorage.getItem("userId");

      const res = await fetch(`http://10.190.195.151:5000/api/rooms/${code}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      setHostId(data.host);

      if (String(data.host) === String(userId)) {
        setIsHost(true);
      }
    };

    fetchRoom();
  }, [code]);

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
          {isHost && <button className="start-btn">Start Session</button>}
          <button className="leave-btn" onClick={leaveRoom}>
            Leave
          </button>
        </div>
      </div>

      <div className="room-layout">
        {/* Chat Section */}
        <div className="chat-section">
          <h3>Chat</h3>

          <div className="chat-messages">
            {messages.map((msg, index) => (
              <p key={index}>
                <strong>{msg.author}:</strong> {msg.message}
              </p>
            ))}
          </div>

          <div className="chat-input">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
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
                <li key={index}>
                  {user.username}
                  {String(user.userId) === String(hostId) && " (Host)"}
                </li>
              ))}
            </ul>
          </div>

          <div className="timer-card">
            <h3>Pomodoro</h3>
            <h1>25:00</h1>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Room;
