import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api.js";
import "./demo-checkout.css";

const format = value => Number(value || 0).toLocaleString("en-IN");
export default function DemoCheckout() {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(null);
  const lock = useRef(false);
  const request = useRef(null);

  async function reload() {
    const response = await api.get("/payments/demo");
    setData(response.data);
    setSelected(current => current || response.data.packages?.[0]?.id || "");
  }
  useEffect(() => {
    let active = true;
    api.get("/payments/demo").then(({ data }) => {
      if (active) { setData(data); setSelected(data.packages?.[0]?.id || ""); }
    }).catch(() => { if (active) setError("Could not load demo checkout. Refresh this page to try again."); });
    return () => { active = false; };
  }, []);

  async function simulate(outcome) {
    if (lock.current || !data?.enabled || !selected) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    request.current ||= { packageId: selected, outcome, key: crypto.randomUUID() };
    const current = request.current;
    setPending(current);
    try {
      const { data: result } = await api.post("/payments/demo", {
        packageId: current.packageId, outcome: current.outcome
      }, { headers: { "Idempotency-Key": current.key } });
      setData(previous => ({ ...previous, demoVes: result.receipt.balanceAfter }));
      setMessage(result.receipt.status === "SIMULATED_SUCCESS"
        ? `Demo successful! ${format(result.receipt.amount)} demo VEs credited. No real payment was made.`
        : "Demo failure simulated. No demo VEs were credited and no money was charged.");
      request.current = null;
      setPending(null);
      window.dispatchEvent(new Event("veloop-wallet-refresh"));
      try { await reload(); } catch { setError("Simulation saved. Refresh this page to reload its receipt."); }
    } catch (e) {
      const status = e.response?.status;
      setError(e.response?.data?.message || "The simulation result is uncertain. Retry the same request below; it cannot credit twice.");
      if (status && status >= 400 && status < 500 && status !== 429) { request.current = null; setPending(null); }
    } finally { lock.current = false; setBusy(false); }
  }

  return <section className="demo-checkout" aria-labelledby="demo-checkout-title">
    <div className="demo-checkout-header"><span className="demo-mode-badge">DEMO · NO REAL MONEY</span><h2 id="demo-checkout-title">Try a payment simulation.</h2>
      <p>Explore success and failure without a payment account. Demo VEs are separate and cannot be withdrawn or converted to real rewards.</p></div>
    {!data && !error && <p role="status">Loading demo wallet…</p>}
    {error && <p className="demo-alert" role="alert">{error}</p>}
    {message && <p className="demo-result" role="status">{message}</p>}
    {data && <><div className="demo-wallet-balance"><span>Demo wallet balance</span><strong>{format(data.demoVes)} <small>demo VEs</small></strong><Link to="/wallet">View wallet →</Link></div>
      {!data.enabled ? <p>Demo mode is currently disabled.</p> : <>
        <fieldset disabled={busy || Boolean(pending)}><legend>Choose a demo package</legend>
          {data.packages.map(item => <label className="demo-package" key={item.id}>
            <input type="radio" name="demo-package" checked={selected === item.id} onChange={() => setSelected(item.id)} />
            <span><b>{item.label}</b><small>{format(item.ves)} demo VEs</small></span>
            <strong>₹{format(item.amountPaise / 100)}<small>simulated price</small></strong>
          </label>)}
        </fieldset>
        <div className="demo-payment-actions">{pending ? <button type="button" className="button button-dark" disabled={busy} onClick={() => simulate(pending.outcome)}>{busy ? "Saving simulation…" : "Retry same simulation"}</button> : <>
          <button type="button" className="button button-dark" disabled={busy || !selected} onClick={() => simulate("SUCCESS")}>Simulate success ✦</button>
          <button type="button" className="button button-dark" disabled={busy || !selected} onClick={() => simulate("FAILURE")}>Simulate failure</button>
        </>}</div>
        <p className="demo-footnote">Illustrative packages only. No UPI ID, PIN, card details or bank transfer is required.</p>
      </>}
      <h3>Demo transaction history</h3>
      {!data.receipts?.length ? <p>No demo transactions yet.</p> : <ul className="demo-receipts">{data.receipts.map(item => <li key={item.receiptId}>
        <div><b>{item.status === "SIMULATED_SUCCESS" ? "Simulated success" : "Simulated failure"}</b><span>+{format(item.amount)} demo VEs</span></div>
        <p>Balance: {format(item.balanceBefore)} → {format(item.balanceAfter)} demo VEs</p>
        <small>{item.receiptId}</small>
      </li>)}</ul>}
    </>}
  </section>;
}
