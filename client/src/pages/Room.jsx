import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import { useRef } from "react";
import "./Room.css";
//import {FaUsers, FaPlay, FaPause, FaStop, FaSignOutAlt} from react-icons/fa;
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
  const [customMinutes] = useState(25);
  const [allowedUsers, setAllowedUsers] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [notification, setNotification] = useState(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const [activeQuiz, setActiveQuiz] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  const remoteAudioRef = useRef(null);

  const timerRef = useRef(null);

  const peersRef = useRef({});
  const [localStream, setLocalStream] = useState(null);
  const [isMicOn, setIsMicOn] = useState(true);

  const navigate = useNavigate();

  const cleanupWebRTC = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    Object.values(peersRef.current).forEach((peer) => {
      peer.close();
    });

    peersRef.current = {};
  }, [localStream]);
  useEffect(() => {
    return () => {
      cleanupWebRTC();
    };
  }, [cleanupWebRTC]);
  // Join room when component loads
  useEffect(() => {
    const username = localStorage.getItem("username");

    socket.on("quiz_started", setActiveQuiz);
    socket.on("leaderboard_update", setLeaderboard);

    socket.on("room_ended", () => {
      setNotification("Meeting ended by host");

      setTimeout(() => {
        setNotification(null);
        cleanupWebRTC();
        navigate("/home");
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
    const initMic = async () => {
      try {
        console.log("Mic initialized");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        setLocalStream(stream);
      } catch (err) {
        console.error("Mic permission denied", err);
      }
    };

    initMic();
  }, []);

  useEffect(() => {
    if (!localStream) return;

    const username = localStorage.getItem("username");

    socket.emit("join_room", {
      roomCode: code,
      username,
      userId: localStorage.getItem("userId"),
    });
  }, [localStream, code]);

  const createPeerConnection = async (remoteUserId, isInitiator) => {
    console.log("Creating peer for:", remoteUserId);
    if (peersRef.current[remoteUserId]) {
      return peersRef.current[remoteUserId]; // 🔥 prevent duplicate
    }

    if (!localStream) return;

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peersRef.current[remoteUserId] = peer;

    localStream.getTracks().forEach((track) => {
      peer.addTrack(track, localStream);
    });

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("webrtc_ice", {
          candidate: event.candidate,
          to: remoteUserId,
        });
      }
    };

    peer.ontrack = (event) => {
      console.log("Remote track received");

      const audio = document.createElement("audio");
      audio.srcObject = event.streams[0];
      audio.autoplay = true;
      audio.playsInline = true;
      audio.controls = true; // TEMPORARY for debugging

      document.body.appendChild(audio);
    };

    if (isInitiator) {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      console.log("Offer sent to:", remoteUserId);

      socket.emit("webrtc_offer", {
        offer,
        to: remoteUserId,
      });
    }

    return peer;
  };

  useEffect(() => {
    if (!localStream) return;

    // WebRTC socket events
    socket.on("existing_users", async (users) => {
      console.log("Existing users:", users);
      if (!localStream) return;

      users.forEach((remoteUserId) => {
        createPeerConnection(remoteUserId, true);
      });
    });

    socket.on("new_user", ({ userId }) => {
      createPeerConnection(userId, false);
    });

    socket.on("webrtc_offer", async ({ offer, from }) => {
      console.log("Offer received from:", from);
      let peer = peersRef.current[from];

      if (!peer) {
        peer = await createPeerConnection(from, false);
      }

      if (peer.signalingState !== "stable") return;
      console.log(peer.signalingState);

      await peer.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket.emit("webrtc_answer", {
        answer,
        to: from,
      });
    });

    socket.on("webrtc_answer", async ({ answer, from }) => {
      console.log("Answer received from:", from);
      const peer = peersRef.current[from];
      if (!peer) return;

      if (peer.signalingState !== "have-local-offer") return;
      console.log(peer.signalingState);

      await peer.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on("webrtc_ice", async ({ candidate, from }) => {
      console.log("ICE candidate from:", from);
      const peer = peersRef.current[from];
      if (peer) {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    return () => {
      socket.off("existing_users");
      socket.off("new_user");
      socket.off("webrtc_offer");
      socket.off("webrtc_answer");
      socket.off("webrtc_ice");
    };
  }, [localStream]);

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
    cleanupWebRTC();
    socket.emit("leave_room", { roomCode: code });
    navigate("/home", { replace: true });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // prevent new line
      sendMessage();
    }
  };

  return (
    <div className="room-wrapper">
      {/* HEADER */}

      <div className="room-header">
        <div className="room-heading">
          <h2>Welcome, {username}</h2>
          <p className="room-subtitle">Your study session</p>

          <div className="room-code">
            Room Code: <span>{code}</span>
          </div>
          <div className="room-divider" />
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="room-main">
        {/* WHITEBOARD */}
        <div className="whiteboard-container">
          {activeQuiz ? (
            <Quiz roomCode={code} socket={socket} />
          ) : (
            <Whiteboard
              socket={socket}
              roomCode={code}
              isHost={isHost}
              allowedUsers={allowedUsers}
              userId={localStorage.getItem("userId")}
            />
          )}
        </div>
        <audio ref={remoteAudioRef} autoPlay />

        {/* CHAT */}
        <div className="chat-container">
          <h3>Chat</h3>

          <div className="chat-messages">
            {messages.map((msg, index) => (
              <p key={index} className={msg.system ? "system" : ""}>
                {!msg.system && <strong>{msg.author}: </strong>}
                {msg.message}
              </p>
            ))}
          </div>

          {typingUser && typingUser !== username && (
            <div className="typing-indicator">{typingUser} is typing...</div>
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
      </div>

      {/* BOTTOM NAV */}
      <div className="bottom-nav">
        {/* Participants */}
        {isHost && (
          <button
            className="nav-btn"
            onClick={() => navigate(`/quiz-room/${code}`)}
          >
            📝 Quiz
          </button>
        )}
        <button
          className="nav-btn"
          onClick={() => {
            const track = localStream?.getAudioTracks()[0];
            if (!track) return;

            track.enabled = !track.enabled;
            setIsMicOn(track.enabled);
          }}
        >
          {isMicOn ? "Mute Mic" : "Unmute Mic"}
        </button>
        <button
          className="nav-btn"
          onClick={() => setShowParticipants((prev) => !prev)}
        >
          👥 {participants.length}
        </button>

        <button
          className="nav-btn"
          onClick={() => setShowChat((prev) => !prev)}
        >
          💬
        </button>
        {showChat && (
          <div className="mobile-chat-drawer">
            <h3>Chat</h3>

            <div className="chat-messages">
              {messages.map((msg, index) => (
                <p key={index} className={msg.system ? "system" : ""}>
                  {!msg.system && <strong>{msg.author}: </strong>}
                  {msg.message}
                </p>
              ))}
            </div>

            <div className="chat-input">
              <textarea
                value={message}
                onChange={handleTyping}
                onKeyDown={handleKeyDown}
                rows={2}
              />
              <button onClick={sendMessage}>Send</button>
            </div>
          </div>
        )}

        {/* Timer */}
        <div className="nav-timer">
          {Math.floor(timeLeft / 60)
            .toString()
            .padStart(2, "0")}
          :{(timeLeft % 60).toString().padStart(2, "0")}
        </div>

        {/* Host Controls */}
        {isHost && (
          <>
            {!isRunning ? (
              <button
                className="nav-btn"
                onClick={() =>
                  socket.emit("start_timer", {
                    roomCode: code,
                    duration: customMinutes * 60 * 1000,
                  })
                }
              >
                ▶
              </button>
            ) : (
              <button
                className="nav-btn"
                onClick={() => socket.emit("pause_timer", { roomCode: code })}
              >
                ⏸
              </button>
            )}

            <button
              className="nav-btn"
              onClick={() => socket.emit("reset_timer", { roomCode: code })}
            >
              ⏹
            </button>
          </>
        )}

        <button className="nav-btn" onClick={leaveRoom}>
          Leave
        </button>

        {isHost && (
          <button
            className="nav-btn danger"
            onClick={() => socket.emit("end_room", { roomCode: code })}
          >
            End
          </button>
        )}
      </div>

      {leaderboard.length > 0 && (
        <div className="leaderboard">
          <h3>Leaderboard</h3>
          {leaderboard.map((player, index) => (
            <div key={index}>
              {index + 1}. {player.username} - {player.score}
            </div>
          ))}
        </div>
      )}

      {/* PARTICIPANTS DRAWER */}
      {showParticipants && (
        <div className="participants-drawer">
          <h3>Participants</h3>
          <ul>
            {participants.map((user) => (
              <li key={user.userId}>
                {user.username}
                {String(user.userId) === String(hostId) && (
                  <span className="host-tag"> (Host)</span>
                )}

                {isHost && String(user.userId) !== String(hostId) && (
                  <div className="participant-actions">
                    <button
                      onClick={() =>
                        allowedUsers.includes(user.userId)
                          ? socket.emit("revoke_permission", {
                              roomCode: code,
                              userId: user.userId,
                            })
                          : socket.emit("grant_permission", {
                              roomCode: code,
                              userId: user.userId,
                            })
                      }
                    >
                      {allowedUsers.includes(user.userId) ? "Revoke" : "Allow"}
                    </button>

                    <button
                      onClick={() =>
                        socket.emit("transfer_host", {
                          roomCode: code,
                          newHostId: user.userId,
                        })
                      }
                    >
                      Make Host
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {notification && <div className="toast-notification">{notification}</div>}
    </div>
  );
};

export default Room;
