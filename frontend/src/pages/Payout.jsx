import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api.js";

function formatPayout(option) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: option.payoutCurrency || "INR", maximumFractionDigits: 0 }).format(option.payoutValue);
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
      .then(({ data }) => { if (active) setMethods(data.methods); })
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
      setOptions(data.options);
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
    if (!window.confirm(`Confirm redemption of ${formatPayout(option)} for ${option.requiredAmount.toLocaleString()} VEs?`)) return;

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
    <main className="page-wrap payout-page">
      <Link to="/wallet" className="back-link"><span aria-hidden="true">←</span> Back to wallet</Link>
      <section className="page-heading payout-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" /> REWARDS, MEET REAL LIFE</div>
          <h1>Make your rewards<br className="desktop-break" /> go a little further.</h1>
          <p className="page-lead">Choose a payout option. We’ll keep you posted at every step.</p>
        </div>
        <div className="payout-decoration" aria-hidden="true"><span>V</span><i>✳</i></div>
      </section>

      {error && <div className="notice notice-error" role="alert"><span>!</span><div><strong>Something needs your attention</strong><p>{error}</p></div></div>}
      {message && <div className="notice notice-success" role="status" aria-live="polite"><span>✓</span><div><strong>{message}</strong><p>Request <b>{withdrawalId}</b> · Current status: <b>{withdrawalStatus}</b></p><p>{withdrawalStatus === "PENDING" ? "Your request is in the review queue. Its status will update as it is processed." : `Your request is ${withdrawalStatus.toLowerCase()}. You can check its latest status from your wallet.`}</p><p className="payout-processing-note">This assessment environment records and reviews requests; no external payout provider is connected.</p><Link to="/wallet">View your wallet and request history →</Link></div></div>}

      <div className="payout-layout">
        <section className="selection-card">
          <div className="step-title"><span className="step-number">01</span><div><h2>Choose how to redeem</h2><p>Available methods for your account</p></div></div>
          {loading ? <div className="inline-loading"><span className="spinner" /> Loading available methods…</div> : methods.length === 0 ?
            <div className="inline-empty">No payout methods are currently available.</div> :
            <div className="method-list">
              {methods.map((item, index) => <button type="button" key={item.method}
                className={method?.method === item.method ? "method-option selected" : "method-option"}
                onClick={() => selectMethod(item)}>
                <span className={`method-mark method-mark-${index % 4}`} aria-hidden="true">{item.name?.slice(0, 1)?.toUpperCase() || "V"}</span>
                <span className="method-copy"><strong>{item.name}</strong><small>Secure digital redemption</small></span>
                <span className="method-check" aria-hidden="true">{method?.method === item.method ? "✓" : "→"}</span>
              </button>)}
            </div>}

          {method && <div className="option-section">
            <div className="step-title step-title-sub"><span className="step-number">02</span><div><h2>Pick an amount</h2><p>Choose the option that suits you</p></div></div>
            {loadingOptions ? <div className="inline-loading"><span className="spinner" /> Loading payout options…</div> : options.length === 0 ?
              <div className="inline-empty">No options available for this method.</div> :
              <div className="payout-options">
                {options.map(item => <button type="button" key={item.methodId}
                  className={option?.methodId === item.methodId ? "payout-option selected" : "payout-option"}
                  onClick={() => selectOption(item)}>
                  <span className="option-radio" aria-hidden="true">{option?.methodId === item.methodId && <i />}</span>
                  <span><strong>{formatPayout(item)}</strong><small>{item.requiredAmount.toLocaleString()} VEs required</small></span>
                  {option?.methodId === item.methodId && <span className="option-selected-label">SELECTED</span>}
                </button>)}
              </div>}
          </div>}
        </section>

        <aside className="payout-side">
          <form className="details-card" onSubmit={submit}>
            <div className="step-title"><span className="step-number">03</span><div><h2>Your payout details</h2><p>Just what we need to send it</p></div></div>
            {!option ? <div className="details-placeholder"><div className="placeholder-orbit">✳</div><strong>Your details go here</strong><p>Select a method and amount to continue.</p></div> : <>
              {(method.requiredDetails || []).map(field => <label className="field-label" key={field.key}>{field.label}{field.required ? <span> *</span> : null}
                <input required={field.required} type={field.inputType === "email" ? "email" : "text"}
                  autoComplete="off" value={details[field.key] || ""} placeholder={`Enter ${field.label.toLowerCase()}`}
                  onChange={event => updateDetail(field.key, event.target.value)} />
              </label>)}
              <div className="payout-receipt">
                <div><span>You’ll receive</span><strong>{formatPayout(option)}</strong></div>
                <div><span>Redeem cost</span><strong>{option.requiredAmount.toLocaleString()} VEs</strong></div>
              </div>
              <p className="review-note"><span aria-hidden="true">◷</span> Payout requests are reviewed before processing.</p>
              <button className="button button-dark submit-payout" type="submit" disabled={submitting || Boolean(message)}>
                {submitting ? "Sending request…" : "Confirm redemption"}<span aria-hidden="true">↗</span>
              </button>
            </>}
          </form>
          <div className="security-note"><span className="security-icon" aria-hidden="true">✓</span><p><strong>Your details are protected</strong><br />Payout details are encrypted and only shared with authorized reviewers.</p></div>
        </aside>
      </div>
      <footer className="page-footer"><span>Good things are on their way.</span><span>VELOop Rewards <span className="footer-star">✳</span></span></footer>
    </main>
  );
}
