import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Brand from "../components/Brand.jsx";
import api from "../services/api.js";

function loadCheckout() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector('script[data-razorpay-checkout="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Razorpay Checkout.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "true";
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Could not load Razorpay Checkout. Check your internet connection and try again."));
    document.body.appendChild(script);
  });
}

const rupees = value => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);

export default function BuyVES() {
  const [packages, setPackages] = useState([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/payments/packages")
      .then(({ data }) => {
        if (!active) return;
        setPackages(data.packages || []);
        setSelected(data.packages?.[0]?.id || "");
      })
      .catch(e => { if (active) setError(e.response?.data?.message || "Could not load VES packages."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function startPayment() {
    const chosen = packages.find(item => item.id === selected);
    if (!chosen || paying) return;
    setPaying(true);
    setError("");
    setMessage("");
    try {
      const { data } = await api.post("/payments/orders", { packageId: chosen.id });
      await loadCheckout();
      const checkout = new window.Razorpay({
        key: data.keyId,
        amount: data.order.amount,
        currency: data.order.currency,
        name: "VELOop Rewards",
        description: data.order.packageLabel,
        order_id: data.order.id,
        handler: async response => {
          try {
            const verified = await api.post("/payments/verify", response);
            setMessage(verified.data.message || "Payment verified.");
            window.dispatchEvent(new Event("veloop-wallet-refresh"));
          } catch (e) {
            setError(e.response?.data?.message || "We could not verify this payment yet. Please contact support with your Razorpay payment ID; do not pay again until its status is checked.");
          } finally {
            setPaying(false);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
        prefill: {},
        theme: { color: "#183b31" }
      });
      checkout.on("payment.failed", event => {
        setError(event.error?.description || "Payment failed. No VES was added.");
        setPaying(false);
      });
      checkout.open();
    } catch (e) {
      setError(e.response?.data?.message || e.message || "Could not start payment.");
      setPaying(false);
    }
  }

  return <main className="reference-page">
    <section className="page-heading">
      <div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR REWARDS</div><h1>Buy VES securely.</h1><p className="page-lead">VES is added only after the payment is verified by the server.</p></div>
      <Link className="button button-dark heading-action" to="/wallet">← Back to wallet</Link>
    </section>
    <section className="reference-dashboard" style={{ maxWidth: 760, margin: "24px auto", padding: 28 }}>
      <Link className="reference-wallet-brand" to="/"><Brand /></Link>
      <h2 style={{ marginTop: 24 }}>Choose a VES package</h2>
      {loading && <p role="status">Loading packages…</p>}
      {!loading && packages.length === 0 && !error && <p>No purchase packages are configured yet. The project owner must set VES_PURCHASE_PACKAGES and Razorpay test keys in the Render environment.</p>}
      {error && <div className="notice notice-error" role="alert"><span>!</span><div><strong>Payment not completed</strong><p>{error}</p></div></div>}
      {message && <div className="notice" role="status"><span>✓</span><div><strong>Payment confirmed</strong><p>{message}</p><Link to="/wallet">View your wallet →</Link></div></div>}
      <div style={{ display: "grid", gap: 12, margin: "20px 0" }}>
        {packages.map(item => <label key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, border: selected === item.id ? "2px solid #183b31" : "1px solid #d9dfd8", borderRadius: 12, padding: 16, cursor: "pointer" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 12 }}><input type="radio" name="ves-package" value={item.id} checked={selected === item.id} onChange={() => setSelected(item.id)} /><span><strong>{item.label}</strong><br /><small>{Number(item.ves).toLocaleString("en-IN")} VES</small></span></span>
          <strong>{rupees(item.amountRupees)}</strong>
        </label>)}
      </div>
      <button className="button button-dark" type="button" onClick={startPayment} disabled={loading || paying || !selected || packages.length === 0} style={{ width: "100%", justifyContent: "center" }}>{paying ? "Waiting for payment…" : "Continue to secure payment →"}</button>
      <p style={{ marginTop: 16, fontSize: 13 }}>Test payments require Razorpay test keys. Never share your Razorpay secret key with anyone or put it in frontend code.</p>
    </section>
  </main>;
}
