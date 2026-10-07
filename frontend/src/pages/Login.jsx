import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Brand from "../components/Brand.jsx";
import api from "../api.js";

export default function Login() {
  const [email, setEmail] = useState("demo@veloop.test");
  const [password, setPassword] = useState("Demo@12345");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("veloop_token", data.token);
      navigate("/wallet", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Check your details and try again.");
    } finally { setSubmitting(false); }
  }

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-story">
          <div className="auth-brand"><Brand /></div>
          <div className="auth-story-content">
            <span className="auth-sticker">A LITTLE MORE REWARDING <i>✳</i></span>
            <h1>Your next little win<br />starts right here.</h1>
            <p>Pick up where you left off. Your VELOop rewards and wallet activity are waiting.</p>
            <div className="auth-orbit" aria-hidden="true"><span>V</span><i>✳</i><b>loop</b></div>
          </div>
          <span className="auth-side-note">SMALL TASKS. REAL REWARDS.</span>
        </section>
        <section className="auth-form-panel">
          <form className="auth-form" onSubmit={submit}>
            <div className="auth-form-mark" aria-hidden="true">↗</div>
            <div className="eyebrow"><span className="eyebrow-dot" /> YOUR REWARDS ARE CALLING</div>
            <h2>Welcome back!</h2>
            <p className="auth-subtitle">Sign in to see what’s in your wallet.</p>
            {error && <div className="notice notice-error" role="alert"><span>!</span><div>{error}</div></div>}
            <label className="field-label" htmlFor="email">Email address
              <input id="email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required />
            </label>
            <label className="field-label" htmlFor="password">Password
              <input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
            </label>
            <button className="button button-dark submit-payout" type="submit" disabled={submitting}>{submitting ? "Signing you in…" : "Sign in to your wallet"}<span aria-hidden="true">↗</span></button>
            <div className="demo-account"><span className="demo-check">✓</span><p><strong>Assessment demo account</strong><br /><span>demo@veloop.test · Demo@12345</span></p></div>
            <p className="auth-privacy">Your wallet balances are securely loaded from the VELOop API.</p>
          </form>
        </section>
      </div>
    </main>
  );
}
