import React, { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Login.css";
import googleLogo from "../assets/google.svg";
import logo from "../assets/logo.png";

const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const API = `${import.meta.env.VITE_API_URL}/api/auth`;
  const navigate = useNavigate();

  const googleLogin = useGoogleLogin({
    flow: "implicit",
    onSuccess: async (tokenResponse) => {
      try {
        const res = await axios.post(API + "/google", {
          token: tokenResponse.access_token,
        });

        localStorage.setItem("token", res.data.token);
        localStorage.setItem("username", res.data.name);
        localStorage.setItem("userId", res.data.userId);

        console.log("Login response:", res.data);
        navigate("/dashboard", { replace: true });
      } catch (err) {
        console.log(err);
        setError("Google login failed");
      }
    },
    onError: () => {
      setError("Google login failed");
    },
  });

  const handleSubmit = async () => {
    try {
      setError("");
      setLoading(true);

      const endpoint = isRegister ? "/register" : "/login";

      const payload = isRegister
        ? { name, email, password }
        : { email, password };

      const res = await axios.post(API + endpoint, payload);

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("username", res.data.name);
      localStorage.setItem("userId", res.data.userId);

      console.log("Login response:", res.data);

      navigate("/dashboard", { replace: true });
      console.log(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="left-panel">
        <center>
          <img src={logo} alt="WE Logo" className="logo" />
        </center>
        <p>Collaborate . Focus . Achieve</p>
      </div>

      <div className="right-panel">
        <div className="login-card">
          <h2>{isRegister ? "Register" : "Login"}</h2>

          {isRegister && (
            <div className="input-group">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <label>Name</label>
            </div>
          )}

          <div className="input-group">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label>Email</label>
          </div>

          <div className="input-group">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label>Password</label>
          </div>

          {!isRegister && <span className="forgot">Forgot Password?</span>}

          {error && <p style={{ color: "#000000" }}>{error}</p>}

          <button onClick={handleSubmit} disabled={loading}>
            {loading
              ? "Please wait..."
              : isRegister
                ? "Create Account"
                : "Sign In"}
          </button>

          <span
            className="register"
            onClick={() => setIsRegister(!isRegister)}
            style={{ cursor: "pointer" }}
          >
            {isRegister
              ? "Already have an account? Login"
              : "Don't have an account? Sign Up"}
          </span>

          <div className="divider">
            <span>or</span>
          </div>

          <button className="google-btn" onClick={() => googleLogin()}>
            <img src={googleLogo} alt="Google" />
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
