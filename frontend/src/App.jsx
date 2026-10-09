import React, { useEffect, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import RewardsExperience from "./pages/RewardsExperience.jsx";
import AuthPage from "./pages/AuthPage.jsx";

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
  const isAuthPage = pathname === "/login" || pathname === "/register";
  return <>
    {!isAuthPage && <header className="top">
      <Link className="brand" to="/#home" aria-label="VELOop Rewards home"><span className="mark">V</span> VELOop<span>rewards</span></Link>
      <nav className={menuOpen ? "is-open" : ""} id="primary-navigation" aria-label="Main navigation">
        <Link onClick={closeMenu} to="/login">Login</Link>
        <Link onClick={closeMenu} to="/dashboard#wallet">Dashboard</Link>
        <Link onClick={closeMenu} to="/wallet#stake">Stake &amp; Earn</Link>
        <Link onClick={closeMenu} to="/wallet#mine">Mine &amp; Earn</Link>
        <Link onClick={closeMenu} to="/payout#payout">Payout</Link>
      </nav>
      <b className="tag"><i /> MEMBER REWARDS</b>
      <button className="nav-toggle" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen(open => !open)}><span /><span /><span /></button>
    </header>}
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="signup" />} />
      <Route path="*" element={<ExperienceRoute />} />
    </Routes>
  </>;
}

