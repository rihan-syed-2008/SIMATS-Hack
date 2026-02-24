import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "./Friends.css";

const Friends = () => {
  const [friends, setFriends] = useState([]);
  const [friendIdInput, setFriendIdInput] = useState("");
  const [friendError, setFriendError] = useState("");
  const [loading, setLoading] = useState(false);

  const API = `${import.meta.env.VITE_API_URL}/api/users`;

  const fetchFriends = useCallback(async () => {
    const token = localStorage.getItem("token");

    const res = await axios.get(`${API}/friends`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    setFriends(res.data);
  }, [API]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const handleAddFriend = async () => {
    if (!friendIdInput.trim()) return;

    try {
      setLoading(true);
      setFriendError("");

      const token = localStorage.getItem("token");

      await axios.post(
        `${API}/add-friend`,
        { friendPublicId: friendIdInput },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setFriendIdInput("");
      fetchFriends();
    } catch (err) {
      setFriendError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="friends-wrapper">
      <div className="friends-header">
        <h1 className="friends-title">Friends</h1>
        <p className="friends-subtitle">Manage your study connections</p>
        <div className="friends-divider"></div>
      </div>

      <div className="add-friend-card">
        <input
          type="text"
          placeholder="Enter Public ID"
          value={friendIdInput}
          onChange={(e) => setFriendIdInput(e.target.value)}
        />

        <button
          onClick={handleAddFriend}
          disabled={loading || !friendIdInput.trim()}
        >
          {loading ? "Adding..." : "Add"}
        </button>
      </div>

      {friendError && <p className="error-text">{friendError}</p>}

      {friends.length === 0 ? (
        <div className="empty-state">
          <h4>No Friends Yet</h4>
          <p>Add friends to collaborate in study sessions.</p>
        </div>
      ) : (
        <div className="friends-list">
          {friends.map((friend) => (
            <div key={friend._id} className="friend-item">
              <div className="avatar">
                {friend.name?.charAt(0).toUpperCase()}
              </div>

              <div className="friend-details">
                <span className="friend-name">{friend.name}</span>
                <span className="friend-id">{friend.publicId}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Friends;
