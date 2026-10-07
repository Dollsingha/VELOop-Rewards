import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api.js";

function formatPayout(option) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: option.payoutCurrency || "INR",
    maximumFractionDigits: 0
  }).format(option.payoutValue);
}

export default function Payout() {
  const [methods, setMethods] = useState([]);
  const [method, setMethod] = useState(null);
  const [options, setOptions] = useState([]);
  const [option, setOption] = useState(null);
  const [details, setDetails] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [withdrawalStatus, setWithdrawalStatus] = useState("");
  const [withdrawalId, setWithdrawalId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const requestInFlight = useRef(false);
  const idempotencyKey = useRef(null);

  useEffect(() => {
    let active = true;
    api.get("/payout/methods")
      .then(({ data }) => {
        if (!active) return;
        const availableMethods = data.methods || [];
        setMethods(availableMethods);
        if (availableMethods[0]) selectMethod(availableMethods[0]);
      })
      .catch(e => { if (active) setError(e.response?.data?.message || "Unable to load payout methods."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function selectMethod(selected) {
    setMethod(selected);
    setOption(null);
    setOptions([]);
    setDetails({});
    setError("");
    setMessage("");
    setWithdrawalStatus("");
    setWithdrawalId("");
    idempotencyKey.current = null;
    setLoadingOptions(true);
    try {
      const { data } = await api.get(`/payout/options/${selected.method}`);
      setOptions(data.options || []);
    } catch (e) {
      setError(e.response?.data?.message || "Unable to load payout options.");
    } finally { setLoadingOptions(false); }
  }

  function selectOption(selected) {
    setOption(selected);
    setError("");
    setMessage("");
    setWithdrawalStatus("");
    setWithdrawalId("");
    idempotencyKey.current = null;
  }

  function updateDetail(key, value) {
    setDetails(current => ({ ...current, [key]: value }));
    idempotencyKey.current = null;
  }

  async function submit(event) {
    event.preventDefault();
    if (requestInFlight.current || !method || !option) return;
    const requiredDetails = method.requiredDetails || [];
    if (requiredDetails.some(field => field.required && !details[field.key]?.trim())) {
      setError("Complete the required payout details.");
      return;
    }
    if (!window.confirm(`Confirm redemption of ${formatPayout(option)} for ${Number(option.requiredAmount).toLocaleString("en-IN")} VEs?`)) return;

    requestInFlight.current = true;
    setSubmitting(true);
    setError("");
    setMessage("");
    idempotencyKey.current ||= crypto.randomUUID();
    try {
      const { data } = await api.post("/withdrawals", {
        method: method.method,
        optionId: option.methodId,
        payoutDetails: Object.fromEntries(requiredDetails.map(field => [field.key, details[field.key] || ""]))
      }, { headers: { "Idempotency-Key": idempotencyKey.current } });
      setWithdrawalStatus(data.withdrawal.status);
      setWithdrawalId(data.withdrawal.withdrawalId);
      setMessage("Thank you! Your redemption request has been received.");
    } catch (e) {
      setError(e.response?.data?.message || "Withdrawal failed.");
    } finally {
      requestInFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <main className="reference-page payout-page">
      <Link to="/wallet" className="back-link"><span aria-hidden="true">←</span> Wallet</Link>
      <section className="page-heading payout-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" /> 05 / REDEEM REWARDS</div>
          <h1>Make your rewards yours.</h1>
          <p className="page-lead">A simple, reassuring payout selection flow.</p>
        </div>
        <div className="payout-decoration" aria-hidden="true"><span>V</span><i>✳</i></div>
      </section>

      {error && <div className="notice notice-error" role="alert"><span>!</span><div><strong>Something needs your attention</strong><p>{error}</p></div></div>}
      {message && <div className="notice notice-success" role="status" aria-live="polite"><span>✓</span><div><strong>{message}</strong><p>Request <b>{withdrawalId}</b> · Current status: <b>{withdrawalStatus}</b></p><p>{withdrawalStatus === "PENDING" ? "Your request is in the review queue. Its status will update as it is processed." : `Your request is ${withdrawalStatus.toLowerCase()}. You can check its latest status from your wallet.`}</p><p className="payout-processing-note">This assessment environment records and reviews requests; no external payout provider is connected.</p><Link to="/wallet">View your wallet and request history →</Link></div></div>}

      <form className="reference-payout" onSubmit={submit}>
        <section className="reference-fields">
          <div className="reference-between"><span>← &nbsp; Wallet</span><small>STEP 1 OF 2</small></div>
          <h2>Choose your reward.</h2>
          <p>Pick an amount to redeem from your VE balance.</p>

          <div className="reference-methods" aria-label="Payout method">
            {loading ? <div className="inline-loading"><span className="spinner" /> Loading payout methods…</div> : methods.length === 0 ?
              <div className="inline-empty">No payout methods are currently available.</div> : methods.map((item, index) => (
                <button type="button" key={item.method} className={`reference-method${method?.method === item.method ? " selected" : ""}`} onClick={() => selectMethod(item)}>
                  <i className={`reference-method-icon method-mark-${index % 4}`} aria-hidden="true">{item.name?.slice(0, 1)?.toUpperCase() || "V"}</i>
                  <span><b>{item.name}</b><small>Sent securely using the details below</small></span>
                  <strong aria-hidden="true">{method?.method === item.method ? "✓" : ""}</strong>
                </button>
              ))}
          </div>

          <label className="reference-section-label">SELECT AN AMOUNT</label>
          {!method ? <div className="inline-empty">Choose an available payout method to continue.</div> : loadingOptions ?
            <div className="inline-loading"><span className="spinner" /> Loading payout options…</div> : options.length === 0 ?
              <div className="inline-empty">No options are currently available for this method.</div> :
              <div className="reference-amounts">
                {options.map(item => <button type="button" key={item.methodId} className={`reference-amount${option?.methodId === item.methodId ? " active" : ""}`} onClick={() => selectOption(item)} aria-pressed={option?.methodId === item.methodId}>
                  {formatPayout(item)}
                  <small>{Number(item.requiredAmount).toLocaleString("en-IN")} VEs</small>
                </button>)}
              </div>}

          <div className="reference-details">
            <label className="reference-section-label">{(method?.requiredDetails?.[0]?.label || "PAYOUT DETAILS").toUpperCase()}</label>
            {!option ? <div className="reference-detail-placeholder">Choose an amount to enter your payout details.</div> : (method.requiredDetails || []).map(field => (
              <label className="reference-input-label" key={field.key}>{field.label}{field.required ? " *" : ""}
                <input required={field.required} type={["email", "tel", "number"].includes(field.inputType) ? field.inputType : "text"}
                  autoComplete="off" value={details[field.key] || ""} placeholder={`Enter ${field.label.toLowerCase()}`}
                  onChange={event => updateDetail(field.key, event.target.value)} />
              </label>
            ))}
            {option && <>
              <small className="reference-hint">Enter the payout details required for this method.</small>
              <button className="button button-dark reference-submit" type="submit" disabled={submitting || Boolean(message) || !method}>
                {submitting ? "Sending request…" : "Review redemption"}<span aria-hidden="true">→</span>
              </button>
              <div className="reference-secure">♧ &nbsp; Your payout details are protected</div>
            </>}
          </div>
        </section>

        <aside className="reference-summary">
          <small>REDEMPTION SUMMARY</small>
          {option ? <>
            <strong>{formatPayout(option)}</strong>
            <p>{method?.name || "Payout"}</p>
            <hr />
            <div><span>Rewards to redeem</span><b>{Number(option.requiredAmount).toLocaleString("en-IN")} VEs</b></div>
            <div><span>Processing fee</span><b className="reference-free">Not configured</b></div>
            <hr />
            <div><span>You’ll receive</span><b>{formatPayout(option)}</b></div>
            <blockquote>◷ &nbsp; <span><b>Pending review</b><small>Your request status will appear in your wallet.</small></span></blockquote>
          </> : <div className="reference-summary-empty"><span className="placeholder-orbit">✳</span><b>Select a reward</b><small>Your redemption details will appear here.</small></div>}
        </aside>
      </form>

      <footer className="page-footer"><span>Good things are on their way.</span><span>VELOop Rewards <span className="footer-star">✳</span></span></footer>
    </main>
  );
}
