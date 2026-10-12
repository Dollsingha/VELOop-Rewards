import React, { useEffect, useRef, useState } from "react";
import api from "../services/api.js";
import "./demo-checkout.css";
const names = { sves: "SVEs", gems: "Gems", tokens: "Tokens", spins: "Spins" };
const format = value => Number(value || 0).toLocaleString("en-IN");
export default function DemoRewards() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    async function refresh() {
      try { const { data } = await api.get("/payments/demo"); if (active) { setData(data); setError(""); } }
      catch (e) { if (active && ![401,403].includes(e.response?.status)) setError("Demo rewards could not be loaded. Try refreshing."); }
    }
    refresh(); window.addEventListener("veloop-wallet-refresh", refresh);
    return () => { active = false; window.removeEventListener("veloop-wallet-refresh", refresh); };
  }, []);
  async function claim() {
    if (lock.current || !data?.enabled) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const { data: result } = await api.post("/payments/demo/rewards", {});
      setMessage(result.alreadyClaimed ? "You already claimed this demo pack. No duplicate rewards were added." : "Demo rewards claimed successfully. No money was charged.");
      setData(previous => ({ ...previous, rewardClaim: result.claim, rewardBalances: Object.fromEntries(result.claim.entries.map(item => [item.currency.toLowerCase(), item.balanceAfter])) }));
      window.dispatchEvent(new Event("veloop-wallet-refresh"));
    } catch (e) { setError(e.response?.data?.message || "Could not confirm the claim. Retry safely; this pack can be credited only once."); }
    finally { lock.current = false; setBusy(false); }
  }
  if (!data?.enabled && !error) return null;
  return <section className="demo-rewards" aria-label="Demo reward balances">
    <h3>Demo reward balances</h3><p>Illustrative starter rewards only. Separate from real balances; no cash value or UPI payout.</p>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <div className="demo-reward-grid">{Object.entries(names).map(([key,label]) => <article key={key}><span>Demo {label}</span><strong>{format(data?.rewardBalances?.[key])}</strong></article>)}</div>
    {data?.starterRewards && <small>One-time demo pack: {Object.entries(names).map(([key,label]) => format(data.starterRewards[key])+" "+label).join(" · ")}</small>}
    <button className="button button-dark" type="button" disabled={busy || Boolean(data?.rewardClaim)} onClick={claim}>{busy ? "Claiming…" : data?.rewardClaim ? "Demo pack claimed ✓" : "Claim demo starter rewards ✦"}</button>
    {data?.rewardClaim && <details><summary>View demo reward ledger</summary>{data.rewardClaim.entries.map(item => <p key={item.currency}>{item.currency}: +{format(item.amount)} · {format(item.balanceBefore)} → {format(item.balanceAfter)}</p>)}</details>}
  </section>;
}
