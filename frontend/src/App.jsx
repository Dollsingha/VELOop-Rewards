import React, { useCallback, useEffect, useState } from "react";
import { Link, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import RewardsExperience from "./pages/RewardsExperience.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import BuyVES from "./pages/BuyVES.jsx";
import api from "./services/api.js";
import { authChangeEvent, clearSessionToken } from "./services/session.js";

function ExperienceRoute() {
  const location = useLocation();

  useEffect(() => {
    const targetId = location.hash.slice(1) || ({ "/": "wallet", "/login": "login", "/wallet": "wallet", "/payout": "payout" }[location.pathname]);
    if (!targetId) {
      if (location.pathname === "/dashboard") window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" }));
  }, [location.pathname, location.hash]);

  return <RewardsExperience dashboardOnly={location.pathname === "/dashboard"} />;
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [authStatus, setAuthStatus] = useState(() => localStorage.getItem("veloop_token") ? "checking" : "guest");
  const isAuthPage = pathname === "/login" || pathname === "/register";

  const verifySession = useCallback(async () => {
    if (!localStorage.getItem("veloop_token")) {
      setAuthStatus("guest");
      return;
    }
    setAuthStatus("checking");
    try {
      await api.get("/wallet");
      setAuthStatus("signed-in");
    } catch (error) {
      if ([401, 403].includes(error.response?.status)) clearSessionToken();
      setAuthStatus(error.response ? "guest" : "unknown");
    }
  }, []);

  useEffect(() => {
    verifySession();
    window.addEventListener(authChangeEvent, verifySession);
    window.addEventListener("storage", verifySession);
    return () => {
      window.removeEventListener(authChangeEvent, verifySession);
      window.removeEventListener("storage", verifySession);
    };
  }, [verifySession]);

  function signOut() {
    window.google?.accounts?.id?.disableAutoSelect?.();
    clearSessionToken();
    navigate("/login", { replace: true });
  }

  return <>
    {!isAuthPage && <header className="top">
      <Link className="brand" to="/#home" aria-label="VELOop Rewards home"><span className="mark">V</span> VELOop<span>rewards</span></Link>
      <nav className={menuOpen ? "is-open" : ""} id="primary-navigation" aria-label="Main navigation">
        {authStatus === "signed-in" ? <button className="nav-auth-action" type="button" onClick={() => { closeMenu(); signOut(); }}>Sign out</button> : authStatus === "checking" ? <span className="nav-auth-status" role="status">Checking session…</span> : authStatus === "unknown" ? <span className="nav-auth-status" role="status">Session check unavailable</span> : <Link onClick={closeMenu} to="/login">Login</Link>}
        <Link onClick={closeMenu} to="/dashboard#wallet">Dashboard</Link>
        <Link onClick={closeMenu} to="/wallet#stake">Stake &amp; Earn</Link>
        <Link onClick={closeMenu} to="/wallet#mine">Mine &amp; Earn</Link>
        <Link onClick={closeMenu} to="/payout#payout">Payout</Link>
        {authStatus === "signed-in" && <Link onClick={closeMenu} to="/buy-ves">Buy VES</Link>}
      </nav>
      <b className="tag"><i /> MEMBER REWARDS</b>
      <button className="nav-toggle" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen(open => !open)}><span /><span /><span /></button>
    </header>}
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="signup" />} />
      <Route path="/buy-ves" element={<BuyVES />} />
      <Route path="*" element={<ExperienceRoute />} />
    </Routes>
  </>;
}
