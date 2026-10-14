import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api.js";
import "./wallet-admin.css";

const errorMessage = error => error.response?.data?.message || "The result could not be confirmed. Refresh and check the ledger before retrying.";

export default function WalletAdmin() {
  const [access, setAccess] = useState("checking");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(null);
  const [note, setNote] = useState("");
  const [mutation, setMutation] = useState({ userId: "", currency: "VES", amount: "", description: "", operation: "credit" });
  const [confirmCredit, setConfirmCredit] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    api.get("/admin/stats").then(() => { if (active) setAccess("allowed"); })
      .catch(error => { if (active) { setAccess("denied"); setError(errorMessage(error)); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (access !== "allowed") return;
    let active = true;
    setLoading(true);
    api.get("/admin/withdrawals", { params: { status, page, limit: 10 } })
      .then(({ data }) => { if (active) { setItems(data.items || []); setPages(Math.max(1, data.pages || 1)); } })
      .catch(error => { if (active) setError(errorMessage(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [access, status, page, message]);

  async function execute(callback) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try { await callback(); }
    catch (error) { setError(errorMessage(error)); }
    finally { inFlight.current = false; setBusy(false); setConfirmCredit(false); setReview(null); }
  }

  function submitMutation(event) {
    event.preventDefault();
    if (!confirmCredit) { setConfirmCredit(true); return; }
    execute(async () => {
      const { data } = await api.post(`/admin/wallet/${mutation.operation}`, {
        userId: mutation.userId.trim(), currency: mutation.currency,
        amount: Number(mutation.amount), description: mutation.description.trim()
      });
      setMessage(`Wallet ${mutation.operation} recorded. Ledger: ${data.transaction.transactionId}. Before: ${data.transaction.balanceBefore}; after: ${data.transaction.balanceAfter} ${mutation.currency}.`);
      setMutation(current => ({ ...current, amount: "", description: "" }));
    });
  }

  function submitReview(event) {
    event.preventDefault();
    const selected = review;
    execute(async () => {
      const { data } = await api.post(`/admin/withdrawals/${selected.id}/${selected.action}`, selected.action === "reject" ? { reason: note.trim() } : { note: note.trim() });
      setMessage(`${selected.id}: ${data.withdrawal.status}. This records an internal review decision, not a bank transfer.`);
    });
  }

  if (access !== "allowed") return <main className="wallet-admin"><h1>Wallet administration</h1><p role="status">{access === "checking" ? "Checking administrator access…" : "An authorized administrator account is required."}</p>{error && <p role="alert">{error}</p>}<Link to="/login">Sign in</Link> · <Link to="/wallet">Return to wallet</Link></main>;

  return <main className="wallet-admin">
    <header><small>INTERNAL OPERATIONS</small><h1>Wallet administration</h1><p>Manage reward balances and review withdrawal requests. No payment gateway is required for this workflow.</p></header>
    <div className="wa-notice">Approval is an internal status only. This screen does not collect UPI payments or send money to a bank account.</div>
    {error && <p className="wa-error" role="alert">{error}</p>}
    {message && <p className="wa-success" role="status">{message}</p>}
    <section className="wa-card"><h2>Reward credit or debit</h2><p>Use the member’s database user ID. Every operation creates a ledger entry and an audit record. Reward credits are not cash purchases.</p>
      <form onSubmit={submitMutation}>
        <fieldset disabled={busy || confirmCredit} className="wa-fields">
          <label>Member user ID<input required pattern="[a-fA-F0-9]{24}" value={mutation.userId} onChange={e => setMutation({ ...mutation, userId: e.target.value })} /></label>
          <label>Operation<select value={mutation.operation} onChange={e => setMutation({ ...mutation, operation: e.target.value })}><option value="credit">Credit rewards</option><option value="debit">Debit rewards</option></select></label>
          <label>Currency<select value={mutation.currency} onChange={e => setMutation({ ...mutation, currency: e.target.value })}>{["VES", "SVES", "GEMS", "TOKENS", "SPINS"].map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Amount<input required type="number" min="1" max="100000000" step="1" value={mutation.amount} onChange={e => setMutation({ ...mutation, amount: e.target.value })} /></label>
          <label className="wa-wide">Reason<input required maxLength={500} value={mutation.description} onChange={e => setMutation({ ...mutation, description: e.target.value })} /></label>
        </fieldset>
        {confirmCredit && <p role="status">Confirm {mutation.operation} of {mutation.amount} {mutation.currency} for {mutation.userId}? Check the member and amount carefully.</p>}
        <div className="wa-actions"><button className="button" disabled={busy}>{busy ? "Saving…" : confirmCredit ? "Confirm wallet change" : "Review wallet change"}</button>{confirmCredit && <button className="button" type="button" disabled={busy} onClick={() => setConfirmCredit(false)}>Cancel</button>}</div>
      </form>
    </section>
    <section className="wa-card"><h2>Withdrawal review</h2>
      <label>Status<select disabled={busy} value={status} onChange={e => { setStatus(e.target.value); setPage(1); setReview(null); }}>{["PENDING", "PROCESSING", "APPROVED", "REJECTED", "CANCELLED"].map(value => <option key={value}>{value}</option>)}</select></label>
      <button className="button" type="button" disabled={busy || loading} onClick={() => { setError(""); setMessage(`Status refreshed at ${new Date().toISOString()}`); }}>Refresh requests</button>
      {loading ? <p role="status">Loading requests…</p> : items.length === 0 ? <p>No requests with this status.</p> : items.map(item => <article className="wa-request" key={item.withdrawalId}>
        <h3>{item.payoutCurrency} {item.payoutAmount} · {item.status}</h3><p>{item.withdrawalId}</p><p>Member: {item.userId} · {item.currencyAmount} {item.currency}</p>
        {item.rejectionReason && <p>Reason: {item.rejectionReason}</p>}
        {item.payoutProvider === "RAZORPAYX_TEST" ? <p>Managed by the separate provider test integration; manual changes are blocked.</p> : <div className="wa-actions">{(item.status === "PENDING" ? ["process", "reject"] : item.status === "PROCESSING" ? ["approve", "reject"] : []).map(action => <button className="button" type="button" disabled={busy || loading} key={action} onClick={() => { setReview({ id: item.withdrawalId, action }); setNote(""); }}>{action === "process" ? "Start review" : action === "approve" ? "Approve internally" : "Reject and return rewards"}</button>)}</div>}
      </article>)}
      {review && <form className="wa-review" onSubmit={submitReview}><h3>Confirm {review.action}</h3><p>{review.id}</p><p>{review.action === "reject" ? "The deducted rewards will be returned once, in the same database transaction." : "This changes the request status. It does not transfer money."}</p><label>{review.action === "reject" ? "Rejection reason" : "Review note"}<textarea required={review.action === "reject"} maxLength={review.action === "reject" ? 500 : 1000} disabled={busy} value={note} onChange={e => setNote(e.target.value)} /></label><div className="wa-actions"><button className="button" disabled={busy}>{busy ? "Saving…" : "Confirm review"}</button><button className="button" type="button" disabled={busy} onClick={() => setReview(null)}>Cancel</button></div></form>}
      <div className="wa-actions"><button className="button" type="button" disabled={page <= 1 || loading || busy} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="button" type="button" disabled={page >= pages || loading || busy} onClick={() => setPage(page + 1)}>Next</button></div>
    </section>
  </main>;
}
