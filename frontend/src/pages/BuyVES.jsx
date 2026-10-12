import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Brand from "../components/Brand.jsx";
import api from "../services/api.js";

let checkoutPromise;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (checkoutPromise) return checkoutPromise;
  checkoutPromise = new Promise((resolve, reject) => {
    document.querySelector('script[data-razorpay-checkout="true"]')?.remove();
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => finish(new Error("Payment window could not load. Check your connection and try again.")), 15000);
    function finish(error) {
      window.clearTimeout(timeout);
      script.onload = script.onerror = null;
      if (error) { script.remove(); checkoutPromise = undefined; reject(error); }
      else resolve();
    }
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "true";
    script.onload = () => finish(window.Razorpay ? undefined : new Error("Payment window is unavailable."));
    script.onerror = () => finish(new Error("Could not load the payment window."));
    document.body.appendChild(script);
  });
  return checkoutPromise;
}

const rupees = value => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);

export default function BuyVES() {
  const [packages, setPackages] = useState([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [checkoutReady, setCheckoutReady] = useState(false);
  const [orders, setOrders] = useState([]);
  const [checking, setChecking] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const paymentLock = useRef(false);
  const verifying = useRef(false);

  useEffect(() => {
    let active = true;
    api.get("/payments/packages")
      .then(({ data }) => {
        if (!active) return;
        setPackages(data.packages || []);
        setCheckoutReady(data.checkoutReady === true);
        setSelected(data.packages?.[0]?.id || "");
      })
      .catch(e => { if (active) setError(e.response?.data?.message || "Could not load VES packages."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function refreshOrders() {
    try { const { data } = await api.get("/payments/orders"); setOrders(data.orders || []); }
    catch { /* Package loading remains available; a failed receipt lookup must not imply success. */ }
  }
  useEffect(() => { refreshOrders(); }, []);

  async function checkPayment(orderId) {
    if (paymentLock.current || checking) return;
    setChecking(orderId);
    setError("");
    try {
      const { data } = await api.post(`/payments/orders/${orderId}/reconcile`, {});
      setMessage(data.message);
      setPendingVerification(false);
      window.dispatchEvent(new Event("veloop-wallet-refresh"));
      await refreshOrders();
    } catch (e) {
      setError(e.response?.data?.message || "Payment status could not be confirmed. Keep this order ID and check again before paying again.");
    } finally { setChecking(""); }
  }

  async function startPayment() {
    const chosen = packages.find(item => item.id === selected);
    if (!chosen || paymentLock.current || paying || !checkoutReady || pendingVerification || checking) return;
    paymentLock.current = true;
    setPaying(true);
    setError("");
    setMessage("");
    try {
      await loadCheckout();
      const { data } = await api.post("/payments/orders", { packageId: chosen.id });
      if (!/^rzp_test_/.test(data.keyId || "")) throw new Error("Only sandbox payments are enabled.");
      await refreshOrders();
      const checkout = new window.Razorpay({
        key: data.keyId,
        amount: data.order.amount,
        currency: data.order.currency,
        name: "VELOop Rewards",
        description: data.order.packageLabel,
        order_id: data.order.id,
        handler: async response => {
          verifying.current = true;
          setPendingVerification(true);
          try {
            const verified = await api.post("/payments/verify", response);
            setMessage(verified.data.message || "Payment verified.");
            setPendingVerification(false);
            await refreshOrders();
            window.dispatchEvent(new Event("veloop-wallet-refresh"));
          } catch (e) {
            setError(e.response?.data?.message || "We could not verify this payment yet. Please contact support with your Razorpay payment ID; do not pay again until its status is checked.");
          } finally {
            verifying.current = false;
            paymentLock.current = false;
            setPaying(false);
          }
        },
        modal: { ondismiss: () => { if (!verifying.current) { paymentLock.current = false; setPaying(false); setError("Payment window closed. If you completed payment, check its status below before paying again."); } } },
        prefill: {},
        theme: { color: "#183b31" }
      });
      checkout.on("payment.failed", event => {
        setError(event.error?.description || "Payment failed. No VES was added.");
        if (!verifying.current) { paymentLock.current = false; setPaying(false); }
      });
      checkout.open();
    } catch (e) {
      setError(e.response?.data?.message || e.message || "Could not start payment.");
      paymentLock.current = false;
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
      {!loading && packages.length > 0 && !checkoutReady && <div className="notice" role="status"><span>ⓘ</span><div><strong>Test checkout is not enabled yet</strong><p>The project owner needs to configure Razorpay Checkout test keys. Your wallet balance does not prevent buying VEs.</p></div></div>}
      {error && <div className="notice notice-error" role="alert"><span>!</span><div><strong>Payment not completed</strong><p>{error}</p></div></div>}
      {message && <div className="notice" role="status"><span>✓</span><div><strong>Payment confirmed</strong><p>{message}</p><Link to="/wallet">View your wallet →</Link></div></div>}
      <div style={{ display: "grid", gap: 12, margin: "20px 0" }}>
        {packages.map(item => <label key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, border: selected === item.id ? "2px solid #183b31" : "1px solid #d9dfd8", borderRadius: 12, padding: 16, cursor: "pointer" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 12 }}><input type="radio" name="ves-package" value={item.id} checked={selected === item.id} onChange={() => setSelected(item.id)} /><span><strong>{item.label}</strong><br /><small>{Number(item.ves).toLocaleString("en-IN")} VES</small></span></span>
          <strong>{rupees(item.amountRupees)}</strong>
        </label>)}
      </div>
      <button className="button button-dark" type="button" onClick={startPayment} disabled={loading || paying || !checkoutReady || pendingVerification || Boolean(checking) || !selected || packages.length === 0} style={{ width: "100%", justifyContent: "center" }}>{paying ? "Waiting for payment…" : pendingVerification ? "Check your payment status below" : !checkoutReady ? "Test checkout unavailable" : "Buy VEs · Test payment →"}</button>
      {orders.length > 0 && <section aria-label="Recent purchase orders" style={{ marginTop: 24 }}>
        <h3>Recent purchases</h3>
        <p>If you paid but your wallet has not updated, check the existing order instead of paying again.</p>
        {orders.map(order => <article key={order.id} style={{ borderTop: "1px solid #666", padding: "14px 0", overflowWrap: "anywhere" }}>
          <strong>{Number(order.ves).toLocaleString("en-IN")} VEs · {rupees(order.amount / 100)}</strong>
          <p>Order: {order.id}</p>
          {order.status === "PAID" ? <span>Credited to your wallet ✓</span> : <button className="button button-dark" type="button" disabled={paying || Boolean(checking)} onClick={() => checkPayment(order.id)}>{checking === order.id ? "Checking payment…" : "Check payment status"}</button>}
        </article>)}
      </section>}
      <p style={{ marginTop: 16, fontSize: 13 }}>Test payments require Razorpay test keys. Never share your Razorpay secret key with anyone or put it in frontend code.</p>
    </section>
  </main>;
}
