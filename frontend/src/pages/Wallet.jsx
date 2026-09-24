import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api.js";

const balances = [
  { key: "sves", label: "SVEs", short: "SV", className: "mint" },
  { key: "gems", label: "Gems", short: "G", className: "pink" },
  { key: "tokens", label: "Tokens", short: "T", className: "yellow" },
  { key: "spins", label: "Spins", short: "S", className: "lavender" }
];

const number = value => Number(value || 0).toLocaleString("en-IN");

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
      setTransactions(transactionResponse.data.items);
      setWithdrawals(withdrawalResponse.data.items);
      setPage(transactionResponse.data.page);
      setPages(transactionResponse.data.pages || 1);
      setError("");
    } catch (e) {
      setError(e.response?.data?.message || "Unable to load your wallet. Please try again.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(1); }, [load]);

  return (
    <main className="page-wrap">
      <section className="page-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" /> YOUR REWARDS SPACE</div>
          <h1>All your rewards,<br className="desktop-break" /> in one happy place.</h1>
          <p className="page-lead">Your activity, your balance, all in one loop.</p>
        </div>
        <Link className="button button-dark heading-action" to="/payout"><span className="button-star">✳</span> Redeem rewards <span aria-hidden="true">↗</span></Link>
      </section>

      {error && <div className="notice notice-error" role="alert"><span>!</span><div><strong>Wallet unavailable</strong><p>{error}</p><button className="text-button" onClick={() => load(page)}>Try again</button></div></div>}
      {loading && !wallet && <div className="loading-card" role="status"><span className="spinner" /> Loading your rewards…</div>}

      <section className="balance-layout" aria-label="Wallet balances">
        <article className="featured-balance">
          <div className="featured-orbit orbit-one" /><div className="featured-orbit orbit-two" />
          <div className="featured-top"><span className="balance-kicker">YOUR REDEEMABLE BALANCE</span><span className="balance-pulse"><i /> LIVE BALANCE</span></div>
          <div className="featured-value"><strong>{wallet ? number(wallet.ves) : "—"}</strong><span>VEs</span></div>
          <p className="featured-copy">Earned by you. Tracked securely by VELOop.</p>
          <Link className="button button-lime" to="/payout">Explore payouts <span aria-hidden="true">↗</span></Link>
          <div className="featured-loop" aria-hidden="true">V</div>
        </article>
        <div className="secondary-balances">
          {balances.map(item => (
            <article className={`balance-tile ${item.className}`} key={item.key}>
              <div className="balance-tile-top"><span className="currency-glyph" aria-hidden="true">{item.short}</span><span className="tile-label">{item.label}</span><span className="tile-spark" aria-hidden="true">✳</span></div>
              <strong>{wallet ? number(wallet[item.key]) : "—"}</strong>
              <span className="tile-caption">In your rewards wallet</span>
            </article>
          ))}
        </div>
      </section>

      <section className="history-card">
        <div className="history-heading">
          <div><div className="eyebrow">YOUR ACTIVITY</div><h2>Recent transactions</h2><p>Every wallet change, clearly recorded.</p></div>
          <button className="button button-outline refresh-button" onClick={() => load(page)} disabled={loading}><span className={loading ? "refresh-icon spinning" : "refresh-icon"}>↻</span> Refresh</button>
        </div>
        {loading && transactions.length === 0 ? <div className="empty-state" role="status"><span className="spinner" /> Fetching your latest activity…</div> :
          transactions.length === 0 ? <div className="empty-state"><span className="empty-orbit">✳</span><strong>Your story starts here</strong><p>Complete an activity and your rewards will appear here.</p></div> :
          <div className="table-scroll"><table className="transactions-table"><thead><tr><th>Activity</th><th>Details</th><th>Amount</th><th>Balance after</th><th>Date</th></tr></thead>
            <tbody>{transactions.map(item => (
              <tr key={item.transactionId}>
                <td><span className={`transaction-icon ${item.direction === "CREDIT" ? "positive" : "negative"}`}>{item.direction === "CREDIT" ? "↙" : "↗"}</span><span className="transaction-type">{String(item.type).replaceAll("_", " ")}</span></td>
                <td className="transaction-description">{item.description || item.source}</td>
                <td className={item.direction === "CREDIT" ? "credit amount-cell" : "debit amount-cell"}>{item.direction === "CREDIT" ? "+" : "−"}{number(item.amount)} <small>{item.currency}</small></td>
                <td className="balance-after">{number(item.balanceAfter)} <small>{item.currency}</small></td>
                <td className="transaction-date">{new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
              </tr>
            ))}</tbody>
          </table></div>}
        <div className="pagination">
          <span>Page <strong>{page}</strong> of {pages}</span>
          <div><button className="page-button" disabled={loading || page <= 1} onClick={() => load(page - 1)}>← Previous</button><button className="page-button" disabled={loading || page >= pages} onClick={() => load(page + 1)}>Next →</button></div>
        </div>
      </section>
      <section className="history-card withdrawal-history">
        <div className="history-heading">
          <div><div className="eyebrow">PAYOUT TRACKING</div><h2>Your payout requests</h2><p>Latest review status from the server.</p></div>
          <button className="button button-outline refresh-button" onClick={() => load(page)} disabled={loading}><span className={loading ? "refresh-icon spinning" : "refresh-icon"}>↻</span> Refresh status</button>
        </div>
        {withdrawals.length === 0 ? <div className="empty-state"><span className="empty-orbit">✳</span><strong>No payout requests yet</strong><p>When you redeem rewards, the request and its status will appear here.</p><Link className="button button-dark" to="/payout">Redeem rewards <span aria-hidden="true">↗</span></Link></div> :
          <div className="table-scroll"><table className="transactions-table"><thead><tr><th>Request</th><th>Method</th><th>Reward</th><th>VEs</th><th>Status</th><th>Submitted</th></tr></thead>
            <tbody>{withdrawals.map(item => <tr key={item.withdrawalId}>
              <td className="withdrawal-reference">{item.withdrawalId}</td><td>{item.method.replaceAll("_", " ").toUpperCase()}</td>
              <td>{new Intl.NumberFormat("en-IN", { style: "currency", currency: item.payoutCurrency || "INR", maximumFractionDigits: 0 }).format(item.payoutAmount)}</td>
              <td>{number(item.currencyAmount)} VEs</td><td><span className={`withdrawal-status status-${item.status.toLowerCase()}`}>{item.status}</span></td>
              <td className="transaction-date">{new Date(item.requestedAt || item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
            </tr>)}</tbody>
          </table></div>}
        <p className="payout-processing-note">Requests are tracked here for the assessment. An external payout provider is not connected.</p>
      </section>
      <footer className="page-footer"><span>Made for your next little win.</span><span>VELOop Rewards <span className="footer-star">✳</span></span></footer>
    </main>
  );
}
