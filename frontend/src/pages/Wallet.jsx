import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Brand from "../components/Brand.jsx";
import api from "../services/api.js";

const balances = [
  { key: "sves", label: "SVEs", short: "SV", caption: "Special rewards" },
  { key: "gems", label: "Gems", short: "◆", caption: "Bonus points" },
  { key: "tokens", label: "Tokens", short: "◈", caption: "Earned tokens" },
  { key: "spins", label: "Spins", short: "✦", caption: "Available spins" }
];

const number = value => Number(value || 0).toLocaleString("en-IN");
const date = value => value ? new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

export default function Wallet() {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (requestedPage = 1) => {
    try {
      setLoading(true);
      const [walletResponse, transactionResponse, withdrawalResponse] = await Promise.all([
        api.get("/wallet"),
        api.get(`/wallet/transactions?page=${requestedPage}&limit=10`),
        api.get("/withdrawals?page=1&limit=10")
      ]);
      setWallet(walletResponse.data.wallet);
      setTransactions(transactionResponse.data.items || []);
      setWithdrawals(withdrawalResponse.data.items || []);
      setPage(transactionResponse.data.page);
      setPages(transactionResponse.data.pages || 1);
      setError("");
    } catch (e) {
      setError(e.response?.data?.message || "Unable to load your wallet. Please try again.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const visibleVECredits = useMemo(() => transactions
    .filter(item => item.direction === "CREDIT" && item.currency === "VES")
    .reduce((total, item) => total + Number(item.amount || 0), 0), [transactions]);

  return (
    <main className="reference-page wallet-page" id="overview">
      <section className="page-heading reference-wallet-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" /> 02 / YOUR REWARDS</div>
          <h1>Everything in one place.</h1>
          <p className="page-lead">A quick view of your balance and recent activity.</p>
        </div>
        <Link className="button button-dark heading-action" to="/payout"><span className="button-star">✳</span> Redeem rewards <span aria-hidden="true">→</span></Link>
      </section>

      {error && <div className="notice notice-error" role="alert"><span>!</span><div><strong>Wallet unavailable</strong><p>{error}</p><button className="text-button" onClick={() => load(page)}>Try again</button></div></div>}
      {loading && !wallet && <div className="loading-card" role="status"><span className="spinner" /> Loading your rewards…</div>}

      <section className="reference-wallet" aria-label="Wallet overview">
        <aside className="reference-wallet-nav">
          <Link to="/wallet" className="reference-wallet-brand"><Brand /></Link>
          <small>YOUR SPACE</small>
          <a className="reference-nav-item selected" href="#overview">▦ &nbsp; Overview</a>
          <a className="reference-nav-item" href="#activity">↻ &nbsp; Activity</a>
          <Link className="reference-nav-item" to="/payout">⇧ &nbsp; Redeem</Link>
          <div className="reference-account">◉ &nbsp; Account secured</div>
        </aside>

        <div className="reference-dashboard">
          <div className="reference-dashboard-head">
            <div><span>MEMBER REWARDS OVERVIEW</span><h2>Your wallet ✳</h2></div>
            <b className="reference-avatar" aria-label="Member account">V</b>
          </div>

          <section className="reference-balance" aria-label="VE balance">
            <small>TOTAL REWARD BALANCE</small>
            <strong>{wallet ? number(wallet.ves) : "—"} <i>VEs</i></strong>
            <span>Redeemable rewards held securely in your wallet.</span>
            <b aria-hidden="true">V</b>
          </section>

          <div className="reference-feature-row">
            <article className="reference-streak">
              <div><small>YOUR EARNING STREAK</small><b>Keep your loop going <i>✦</i></b><span>Streak progress appears when platform earning activity is configured.</span></div>
              <span className="reference-preview-badge">FEATURE PREVIEW</span>
            </article>
            <article className="reference-milestone">
              <span className="reference-milestone-mark" aria-hidden="true">✧</span>
              <div><small>YOUR NEXT MILESTONE</small><b>Milestone tracking</b><span>Reward rules will be shown here when provided by the platform.</span></div>
            </article>
          </div>

          <section className="reference-assets" aria-label="Other wallet balances">
            {balances.map(item => <article key={item.key}>
              <i aria-hidden="true">{item.short}</i><small>{item.label}</small>
              <strong>{wallet ? number(wallet[item.key]) : "—"}</strong><span>{item.caption}</span>
            </article>)}
          </section>

          <section className="reference-stats" aria-label="Loaded activity summary">
            <article><small>VE CREDITS ON THIS PAGE</small><b>{number(visibleVECredits)} <i>VEs</i></b><span>From the currently loaded ledger entries</span></article>
            <article><small>PAYOUT REQUESTS LOADED</small><b>{number(withdrawals.length)}</b><span>Latest server-reported requests</span></article>
            <article><small>LEDGER ENTRIES LOADED</small><b>{number(transactions.length)}</b><span>Page {page} of your transaction history</span></article>
          </section>

          <section className="reference-activity" id="activity">
            <div className="reference-activity-heading"><b>Recent activity</b><button type="button" onClick={() => load(page)} disabled={loading}>{loading ? "Refreshing…" : "Refresh ↻"}</button></div>
            {loading && transactions.length === 0 ? <div className="reference-empty" role="status"><span className="spinner" /> Fetching your latest activity…</div> :
              transactions.length === 0 ? <div className="reference-empty"><span className="empty-orbit">✳</span><b>Your story starts here</b><span>Complete an activity and your rewards will appear here.</span></div> :
                transactions.map(item => <article className="reference-transaction" key={item.transactionId}>
                  <i className={item.direction === "CREDIT" ? "credit" : "debit"} aria-hidden="true">{item.direction === "CREDIT" ? "↙" : "↗"}</i>
                  <span><b>{item.description || String(item.type).replaceAll("_", " ")}</b><small>{item.description ? String(item.type).replaceAll("_", " ") : item.source} · {date(item.createdAt)}</small></span>
                  <strong className={item.direction === "CREDIT" ? "credit" : "debit"}>{item.direction === "CREDIT" ? "+" : "−"}{number(item.amount)} {item.currency}</strong>
                </article>)}
            <div className="reference-pagination"><span>Page <b>{page}</b> of {pages}</span><div><button type="button" disabled={loading || page <= 1} onClick={() => load(page - 1)}>← Previous</button><button type="button" disabled={loading || page >= pages} onClick={() => load(page + 1)}>Next →</button></div></div>
          </section>

          <section className="reference-withdrawals">
            <div className="reference-activity-heading"><b>Your payout requests</b><button type="button" onClick={() => load(page)} disabled={loading}>Refresh status ↻</button></div>
            {withdrawals.length === 0 ? <div className="reference-empty"><b>No payout requests yet</b><span>Your request and its status will appear here after you redeem.</span><Link to="/payout" className="button button-lime">Explore payouts →</Link></div> :
              <div className="reference-request-list">{withdrawals.map(item => <article key={item.withdrawalId}>
                <span><b>{item.method.replaceAll("_", " ").toUpperCase()}</b><small>{item.withdrawalId} · {date(item.requestedAt || item.createdAt)}</small></span>
                <strong>{new Intl.NumberFormat("en-IN", { style: "currency", currency: item.payoutCurrency || "INR", maximumFractionDigits: 0 }).format(item.payoutAmount)}</strong>
                <span className={`withdrawal-status status-${item.status.toLowerCase()}`}>{item.status}</span>
              </article>)}</div>}
            <p className="payout-processing-note">Requests are tracked here for the assessment. An external payout provider is not connected.</p>
          </section>

          <div className="reference-callout"><b>Ready to redeem?<small>Turn your rewards into something useful.</small></b><Link className="button button-lime" to="/payout">Explore payouts <span aria-hidden="true">→</span></Link></div>
        </div>
      </section>
      <footer className="page-footer"><span>Small tasks. Real rewards.</span><span>VELOop Rewards <span className="footer-star">✳</span></span></footer>
    </main>
  );
}
