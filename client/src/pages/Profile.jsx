import React from "react";
import { useNavigate } from "react-router-dom";
import "./Profile.css";

const Profile = () => {
  const navigate = useNavigate();

  const name = localStorage.getItem("username");
  const publicId = localStorage.getItem("publicId");

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login", { replace: true });
  };

  return (
    <div className="profile-wrapper">
      <div className="profile-card">
        <h2 className="profile-title">Your Profile</h2>
        <p style={{ opacity: 0.6, textAlign: "center" }}>
          Manage your account details
        </p>
        <div className="profile-divider"></div>

        <div className="profile-info">
          <div className="profile-item">
            <span className="label">Name</span>
            <span className="value">{name}</span>
          </div>

          <div className="profile-item">
            <span className="label">Public ID</span>
            <span className="value">
              {publicId}
              <button
                onClick={() => navigator.clipboard.writeText(publicId)}
                className="copy-btn"
              >
                Copy
              </button>
            </span>
          </div>
        </div>

        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </div>
  );
};

export default Profile;
