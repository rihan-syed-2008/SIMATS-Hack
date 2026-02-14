/*import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    const { clientX, clientY } = e;
    setMouse({ x: clientX, y: clientY });
  };

  const handleLogin = async () => {
    setLoading(true);

    // Simulate API delay
    setTimeout(() => {
      setLoading(false);
      alert("Login logic goes here");
    }, 1500);
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#0B1020] via-[#111827] to-[#0B1020] text-[#E6EDF3]"
      onMouseMove={handleMouseMove}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-300"
        style={{
          background: `radial-gradient(600px at ${mouse.x}px ${mouse.y}px, rgba(124,249,255,0.25), transparent 40%)`,
        }}
      />

      {/* Card */ /*}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */ /*}
        <div className="text-center mb-8 animate-fadeIn">
          <h1 className="text-5xl font-bold tracking-wide">WE</h1>
          <p className="text-sm text-gray-400 mt-2">
            Study together. Grow together.
          </p>
        </div>

        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl transition-all duration-300">
          {/* Email */ /*}
          <div className="relative mb-6">
            <input
              type="email"
              placeholder=" "
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="peer w-full bg-transparent border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-[#7CF9FF] transition-all duration-300"
            />
            <label
              className="absolute left-4 top-3 text-gray-400 text-sm transition-all duration-300 
              peer-focus:-top-2 peer-focus:text-xs peer-focus:text-[#7CF9FF]
              peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm"
            >
              Email
            </label>
          </div>

          {/* Password */ /*}
          <div className="relative mb-4">
            <input
              type={showPassword ? "text" : "password"}
              placeholder=" "
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="peer w-full bg-transparent border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-[#7CF9FF] transition-all duration-300"
            />
            <label
              className="absolute left-4 top-3 text-gray-400 text-sm transition-all duration-300 
              peer-focus:-top-2 peer-focus:text-xs peer-focus:text-[#7CF9FF]
              peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm"
            >
              Password
            </label>

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-3 text-gray-400 hover:text-[#7CF9FF] transition"
            >
              {showPassword ? "🙈" : "👁"}
            </button>
          </div>

          {/* Remember + Forgot */ /*}
          <div className="flex justify-between items-center text-sm mb-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="accent-[#7CF9FF]" />
              Remember me
            </label>
            <button className="text-[#7CF9FF] hover:underline">Forgot?</button>
          </div>

          {/* Login Button */ /*}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3 rounded-full bg-[#7CF9FF] text-black font-semibold transition-all duration-300 hover:shadow-[0_0_25px_rgba(124,249,255,0.6)] hover:-translate-y-1 disabled:opacity-60"
          >
            {loading ? "Entering..." : "Enter Study Room"}
          </button>

          {/* Divider */ /*}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10"></div>
            <span className="text-xs text-gray-400">or continue with</span>
            <div className="flex-1 h-px bg-white/10"></div>
          </div>

          {/* Social Buttons */ /*}
          <div className="flex justify-center gap-6 mb-6">
            {["G", "GH", ""].map((icon, i) => (
              <button
                key={i}
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-300 hover:-translate-y-1 flex items-center justify-center"
              >
                {icon}
              </button>
            ))}
          </div>

          {/* Signup */ /*}
          <p className="text-center text-sm text-gray-400">
            New here?{" "}
            <button className="text-[#A78BFA] hover:underline">
              Create a study group account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}*/
// login.jsx
import React, { useEffect, useRef } from "react";
import "./Login.css";

const Login = () => {
  const cardRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const { innerWidth, innerHeight } = window;
      const xAxis = (innerWidth / 2 - e.pageX) / 40;
      const yAxis = (innerHeight / 2 - e.pageY) / 40;

      cardRef.current.style.transform = `rotateY(${xAxis}deg) rotateX(${yAxis}deg)`;
    };

    const reset = () => {
      cardRef.current.style.transform = "rotateY(0deg) rotateX(0deg)";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", reset);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", reset);
    };
  }, []);

  return (
    <div className="login-wrapper">
      <div className="left-panel">
        <h1>WE</h1>
        <p>Collaborate. Focus. Achieve.</p>
      </div>

      <div className="right-panel">
        <div className="login-card" ref={cardRef}>
          <h2>Login</h2>

          <div className="input-group">
            <input type="email" required />
            <label>Email</label>
          </div>

          <div className="input-group">
            <input type="password" required />
            <label>Password</label>
          </div>

          <button>Sign In</button>

          <span className="forgot">Forgot Password?</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
