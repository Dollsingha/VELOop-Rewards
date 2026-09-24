import React from "react";
import { Link, Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import Brand from "./components/Brand.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Login from "./pages/Login.jsx";
import Wallet from "./pages/Wallet.jsx";
import Payout from "./pages/Payout.jsx";

export default function App() {
  const navigate = useNavigate();
  const authenticated = Boolean(localStorage.getItem("veloop_token"));
  const logout = () => {
    localStorage.removeItem("veloop_token");
    navigate("/login", { replace: true });
  };

  return <>
    <header className="topbar">
      <div className="nav-shell">
        <Link to={authenticated ? "/wallet" : "/login"} aria-label="VELOop Rewards home"><Brand /></Link>
        {authenticated && <>
          <nav className="main-nav" aria-label="Main navigation">
            <NavLink to="/wallet" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>My wallet</NavLink>
            <NavLink to="/payout" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Redeem</NavLink>
          </nav>
          <button className="logout-button" onClick={logout}>Log out <span aria-hidden="true">↗</span></button>
        </>}
      </div>
    </header>
    <Routes>
      <Route path="/" element={<Navigate to={authenticated ? "/wallet" : "/login"} replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
      <Route path="/payout" element={<ProtectedRoute><Payout /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </>;
}
