import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api.js";
import { saveSessionToken } from "../services/session.js";
import GoogleIdentityButton from "../components/GoogleIdentityButton.jsx";
import "./auth-reference.css";

export default function AuthPage({ mode = "login" }) {
  const isSignup = mode === "signup";
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(() => Boolean(localStorage.getItem("veloop_token")));

  useEffect(() => {
    const token = localStorage.getItem("veloop_token");
    if (!token) {
      setCheckingSession(false);
      return undefined;
    }

    let active = true;
    api.get("/wallet").then(() => {
      if (active) navigate("/dashboard", { replace: true });
    }).catch(requestError => {
      if (!active) return;
      if ([401, 403].includes(requestError.response?.status)) {
        localStorage.removeItem("veloop_token");
      }
      setCheckingSession(false);
    });
    return () => { active = false; };
  }, [navigate]);

  const finishLogin = useCallback(data => {
    saveSessionToken(data.token);
    navigate("/dashboard", { replace: true });
  }, [navigate]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (isSignup && password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post(isSignup ? "/auth/register" : "/auth/login", isSignup
        ? { name: name.trim(), email, password }
        : { email, password });
      finishLogin(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || `${isSignup ? "Account creation" : "Login"} failed. Please check your details and try again.`);
    } finally {
      setLoading(false);
    }
  }

  const signInWithGoogle = useCallback(async credential => {
    setError("");
    setGoogleLoading(true);
    try {
      const { data } = await api.post("/auth/google", { credential });
      finishLogin(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Google sign-in failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  }, [finishLogin]);
  const showGoogleError = useCallback(message => setError(message), []);

  if (checkingSession) return <main className="auth-screen">
    <div className="auth-frame auth-session-check" role="status" aria-live="polite">
      <span className="auth-kicker"><i aria-hidden="true" /> MEMBER ACCESS</span>
      <p>Checking your VELOop session…</p>
    </div>
  </main>;

  return <main className="auth-screen">
    <div className="auth-frame">
      <header className="auth-sitebar">
        <Link to="/" className="auth-logo" aria-label="VELOop Rewards home">
          <span className="auth-logo-mark" aria-hidden="true">V</span>
          <span className="auth-logo-type">VELOop<small>REWARDS</small></span>
        </Link>
        <span className="auth-header-label"><i aria-hidden="true" /> MEMBER PORTAL</span>
      </header>
      <div className="auth-layout">
        <section className="auth-story" aria-labelledby="auth-story-title">
          <span className="auth-story-badge"><i aria-hidden="true">✳</i> REWARDS, IN A BETTER LOOP</span>
          <h1 id="auth-story-title">A little win<br />goes a long way.</h1>
          <p>Sign in to see your VELOop wallet, follow your activity, and keep your rewards moving.</p>
          <div className="auth-visual" aria-hidden="true">
            <span className="auth-orbit auth-orbit-one" />
            <span className="auth-orbit auth-orbit-two" />
            <span className="auth-orbit auth-orbit-three" />
            <span className="auth-spark auth-spark-one">✳</span>
            <span className="auth-spark auth-spark-two">✦</span>
            <div className="auth-wallet-card">
              <div className="auth-wallet-top"><span className="auth-wallet-mark">V</span><span>VELOOP WALLET</span><span className="auth-wallet-lock">⌑</span></div>
              <span className="auth-wallet-label">YOUR REWARDS</span>
              <strong>Good to have you back.</strong>
              <span className="auth-wallet-caption">Your balance and activity, all together.</span>
              <div className="auth-wallet-chips"><i>REWARDS</i><i>ACTIVITY</i><i>PAYOUTS</i></div>
            </div>
            <span className="auth-float-note"><i aria-hidden="true">✓</i> Wallet access, made clear</span>
          </div>
          <div className="auth-story-footer"><span aria-hidden="true">✦</span> Your rewards journey starts here.</div>
        </section>
        <section className="auth-main" aria-labelledby="auth-title">
          <div className="auth-card">
            <div className="auth-card-heading">
              <span className="auth-kicker"><i aria-hidden="true" /> {isSignup ? "JOIN THE LOOP" : "MEMBER ACCESS"}</span>
              <h2 id="auth-title">{isSignup ? "Create your account" : "Welcome back"}</h2>
              <p>{isSignup ? "Create an account to keep your rewards in one place." : "Sign in to continue to your rewards wallet."}</p>
            </div>
            <div className="auth-signup-google"><GoogleIdentityButton mode={mode} theme="outline" width={340} onCredential={signInWithGoogle} onError={showGoogleError} /></div>
        <p className="auth-google-hint">Select Google to securely verify your account. Your VELOop wallet session is created only after Google verifies your account.</p>
        {googleLoading && <p className="auth-working" role="status">Verifying your Google account…</p>}
        <div className="auth-or"><span>OR</span></div>

        <form className="reference-auth-form" onSubmit={submit}>
          {isSignup && <label htmlFor="auth-name">Full name
            <input id="auth-name" type="text" autoComplete="name" placeholder="Your name" value={name} onChange={event => setName(event.target.value)} required maxLength={100} />
          </label>}
          <label htmlFor="auth-email">Email address
            <input id="auth-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} required />
          </label>
          <label htmlFor="auth-password">Password
            <span className="auth-password-field">
              <input id="auth-password" type={showPassword ? "text" : "password"} autoComplete={isSignup ? "new-password" : "current-password"} placeholder="Enter your password" value={password} onChange={event => setPassword(event.target.value)} required minLength={isSignup ? 10 : undefined} maxLength={128} />
              <button type="button" className="password-visibility" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)}>{showPassword ? "◉" : "◎"}</button>
            </span>
          </label>
          {isSignup && <label htmlFor="auth-confirm-password">Confirm password
            <span className="auth-password-field">
              <input id="auth-confirm-password" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" placeholder="Re-enter your password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required maxLength={128} />
              <button type="button" className="password-visibility" aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"} onClick={() => setShowConfirmPassword(value => !value)}>{showConfirmPassword ? "◉" : "◎"}</button>
            </span>
          </label>}

          {error && <div className="auth-error" role="alert">{error}</div>}
          <div className="auth-links">
            {isSignup ? <span>Already have an account?</span> : <span />}
            <Link to={isSignup ? "/login" : "/register"}>{isSignup ? "Login" : "Don’t have Account? Register"}</Link>
          </div>
          <button className="auth-submit" type="submit" disabled={loading || googleLoading}>
            {loading ? (isSignup ? "Registering…" : "Signing in…") : (isSignup ? "Register" : "Login")}
          </button>
        </form>
          </div>
          <div className="auth-form-foot"><span aria-hidden="true">⌑</span> Your wallet data is protected by VELOop security.</div>
          <footer className="auth-footer">© 2026 VELOop Rewards <span>·</span> Built for members</footer>
        </section>
      </div>
    </div>
  </main>;
}

