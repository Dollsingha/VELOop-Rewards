import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api.js";
import "./demo-checkout.css";

const format = value => Number(value || 0).toLocaleString("en-IN");
export default function DemoWalletSummary() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let requestId = 0;
    async function refresh() {
      const current = ++requestId;
      try {
        const response = await api.get("/payments/demo");
        if (active && current === requestId) { setData(response.data); setError(""); }
      } catch (e) {
        if (active && current === requestId && ![401, 403].includes(e.response?.status)) setError("Demo balance could not be refreshed.");
      }
    }
    refresh();
    window.addEventListener("veloop-wallet-refresh", refresh);
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("veloop-wallet-refresh", refresh); window.removeEventListener("focus", refresh); };
  }, []);
  if (!data?.enabled && !error) return null;
  return <section className="demo-checkout demo-wallet-summary" aria-label="Separate demo wallet">
    <span className="demo-mode-badge">DEMO · NO REAL MONEY</span>
    <div className="demo-wallet-balance"><span>Demo balance</span><strong>{data ? format(data.demoVes) : "—"} <small>demo VEs</small></strong></div>
    <p>This balance comes from payment simulations. The redeemable wallet above stays separate, so demo VEs cannot be paid out through UPI.</p>
    {error && <p role="alert">{error}</p>}
    {data?.receipts?.[0] && <small>Latest demo: {data.receipts[0].status === "SIMULATED_SUCCESS" ? "success" : "failure"} · {format(data.receipts[0].balanceBefore)} → {format(data.receipts[0].balanceAfter)} demo VEs</small>}
    <Link className="button button-dark" to="/buy-ves">Open demo payment &amp; history →</Link>
  </section>;
}
