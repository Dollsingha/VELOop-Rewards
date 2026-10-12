import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api.js";
import GoogleIdentityButton from "../components/GoogleIdentityButton.jsx";
import DemoWalletSummary from "../components/DemoWalletSummary.jsx";
import WithdrawalBalanceNotice from "../components/WithdrawalBalanceNotice.jsx";
import { clearSessionToken, saveSessionToken } from "../services/session.js";

const number = value => Number(value || 0).toLocaleString("en-IN");
const formatDate = value => value ? new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
const formatPayout = option => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: option.payoutCurrency || "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(option.payoutValue);

function Notice({ error, success }) {
  if (error) return <div className="app-notice error" role="alert"><b>!</b><span>{error}</span></div>;
  if (success) return <div className="app-notice success" role="status" aria-live="polite"><b>✓</b><span>{success}</span></div>;
  return null;
}

function StakePreview() {
  return <section className="section" id="stake">
    <div className="heading"><div><small>03 / GROW YOUR REWARDS</small><h2>Stake &amp; Earn.</h2><p>A focused view of stake and reward progress.</p></div><label>ILLUSTRATIVE CONCEPT</label></div>
    <div className="stake layout">
      <div className="stake-hero"><div className="stake-top"><span className="feature-kicker">✧ &nbsp; VELOOP STAKING</span><span className="concept-chip">DESIGN PREVIEW</span></div>
        <div className="stake-intro"><div><h3>Put your VEs<br />to work.</h3><p>Keep your stake and reward progress<br />clear in one place.</p></div>
          <div className="stake-art" aria-hidden="true"><div className="stake-ring" /><div className="stake-coin coin-back">V</div><div className="stake-coin coin-front">V</div><i>✧</i></div></div>
        <div className="stake-foot">◉ &nbsp; STAKE OVERVIEW <b>Platform reward concept</b></div>
      </div>
      <div className="stake-side"><small>YOUR STAKING · PREVIEW</small><h3>Rewards at a glance</h3>
        <div className="stake-metrics"><article><span>Current stake</span><b>—</b></article><article><span>Rewards earned</span><b className="gold">—</b></article></div>
        <div className="stake-progress-label"><span>Reward progress</span><b>Not configured</b></div><div className="stake-progress"><i /></div>
        <p>Staking values and rules are not connected to this wallet.</p><div className="stake-action">Stake feature preview <b>↗</b></div>
      </div>
    </div>
  </section>;
}

function MinePreview() {
  return <section className="section" id="mine">
    <div className="heading"><div><small>04 / EARNING SESSION</small><h2>Mine &amp; Earn.</h2><p>A focused session view with clear energy and upgrade controls.</p></div><label>SIMULATED FEATURE</label></div>
    <div className="mine layout">
      <div className="mine-scene"><div className="mine-scene-top"><span className="feature-kicker">✧ &nbsp; SESSION PREVIEW</span><span>ILLUSTRATIVE</span></div><div className="mine-grid" /><div className="mine-orbit orbit-one" /><div className="mine-orbit orbit-two" /><div className="mine-beam" />
        <div className="mine-machine"><div className="machine-top">••• <span>V / 01</span></div><div className="machine-face"><i /><i /><strong>V</strong></div><div className="machine-base" /><div className="machine-glow" /></div>
        <span className="mine-chip chip-one">⌁ &nbsp; ENERGY FLOW</span><span className="mine-chip chip-two">✧ &nbsp; SESSION PREVIEW</span>
        <div className="mine-foot"><b>Earn in a session</b><span>SESSION WINDOW<strong>Preview only</strong></span></div>
      </div>
      <div className="mine-panel"><small>YOUR MINING SESSION · PREVIEW</small><h3>Keep your loop running.</h3>
        <div className="session-state"><i>⌁</i><span><b>Session concept</b><small>Illustrative activity state</small></span><strong>↗</strong></div>
        <div className="energy-title"><span>⌁ &nbsp; Session energy</span><b>Not connected</b></div><div className="energy-track"><i /></div>
        <p className="energy-note">Energy and earning speed depend on platform settings.</p>
        <div className="upgrade-title">SESSION UPGRADES <span>PREVIEW</span></div>
        <div className="upgrade-grid"><article><i>↗</i><b>Speed boost<small>Upgrade concept</small></b></article><article><i>⌁</i><b>Recharge energy<small>Upgrade concept</small></b></article></div>
        <div className="mine-disclaimer">ⓘ &nbsp; Simulated rewards feature. This does not mine real cryptocurrency.</div>
      </div>
    </div>
  </section>;
}

export default function RewardsExperience({ dashboardOnly = false }) {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(Boolean(localStorage.getItem("veloop_token")));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [streak, setStreak] = useState(null);
  const [streakLoading, setStreakLoading] = useState(false);
  const [streakSubmitting, setStreakSubmitting] = useState(false);
  const [streakError, setStreakError] = useState("");
  const [streakMessage, setStreakMessage] = useState("");
  const [methods, setMethods] = useState([]);
  const [method, setMethod] = useState(null);
  const [options, setOptions] = useState([]);
  const [option, setOption] = useState(null);
  const [payoutDetails, setPayoutDetails] = useState({});
  const [payoutError, setPayoutError] = useState("");
  const [payoutMessage, setPayoutMessage] = useState("");
  const [withdrawalId, setWithdrawalId] = useState("");
  const [withdrawalStatus, setWithdrawalStatus] = useState("");
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const requestInFlight = useRef(false);
  const idempotencyKey = useRef(null);

  const loadWallet = useCallback(async (requestedPage = 1) => {
    setWalletLoading(true);
    try {
      const [walletResponse, transactionResponse, withdrawalResponse] = await Promise.all([
        api.get("/wallet"),
        api.get(`/wallet/transactions?page=${requestedPage}&limit=10`),
        api.get("/withdrawals?page=1&limit=10")
      ]);
      setWallet(walletResponse.data.wallet);
      setTransactions(transactionResponse.data.items || []);
      setWithdrawals(withdrawalResponse.data.items || []);
      setPage(transactionResponse.data.page || requestedPage);
      setPages(transactionResponse.data.pages || 1);
      setWalletError("");
    } catch (error) {
      setWalletError(error.response?.data?.message || "Unable to load wallet data. Please try again.");
    } finally { setWalletLoading(false); }
  }, []);

  const loadOptions = useCallback(async selectedMethod => {
    if (!selectedMethod) return;
    setOptionsLoading(true);
    setOptions([]);
    setOption(null);
    setPayoutDetails({});
    setPayoutError("");
    try {
      const { data } = await api.get(`/payout/options/${selectedMethod.method}`);
      const available = data.options || [];
      setOptions(available);
      setOption(available[0] || null);
    } catch (error) {
      setPayoutError(error.response?.data?.message || "Unable to load payout options.");
    } finally { setOptionsLoading(false); }
  }, []);

  const loadStreak = useCallback(async () => {
    setStreakLoading(true);
    try {
      const { data } = await api.get("/wallet/streak");
      setStreak(data.streak);
      setStreakError("");
    } catch (error) {
      setStreakError(error.response?.data?.message || "Unable to load your streak.");
    } finally { setStreakLoading(false); }
  }, []);

  async function checkIn() {
    if (!authenticated || streakSubmitting || !streak?.canCheckIn) return;
    setStreakSubmitting(true);
    setStreakError("");
    setStreakMessage("");
    try {
      const { data } = await api.post("/wallet/streak/check-in", {});
      setStreak(data.streak);
      setStreakMessage(data.rewardGrantedVES > 0
        ? `Check-in complete! ${number(data.rewardGrantedVES)} VEs were added to your wallet.`
        : "Check-in complete. Come back tomorrow to keep your streak going.");
      await loadWallet(page);
    } catch (error) {
      setStreakError(error.response?.data?.message || "Unable to check in. Please try again.");
      await loadStreak();
    } finally { setStreakSubmitting(false); }
  }

  useEffect(() => {
    if (!authenticated) {
      setWallet(null);
      setStreak(null);
      setStreakMessage("");
      setTransactions([]);
      setWithdrawals([]);
      setMethods([]);
      setMethod(null);
      setOptions([]);
      setOption(null);
      return;
    }
    loadWallet(page);
  }, [authenticated, loadWallet, page]);

  useEffect(() => {
    if (authenticated) loadStreak();
  }, [authenticated, loadStreak]);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    setMethodsLoading(true);
    api.get("/payout/methods")
      .then(({ data }) => {
        if (!active) return;
        const available = data.methods || [];
        setMethods(available);
        if (available[0]) {
          setMethod(available[0]);
          loadOptions(available[0]);
        }
      })
      .catch(error => { if (active) setPayoutError(error.response?.data?.message || "Unable to load payout methods."); })
      .finally(() => { if (active) setMethodsLoading(false); });
    return () => { active = false; };
  }, [authenticated, loadOptions]);

  const veCreditsOnPage = useMemo(() => transactions
    .filter(item => item.direction === "CREDIT" && item.currency === "VES")
    .reduce((total, item) => total + Number(item.amount || 0), 0), [transactions]);
  const approvedOnPage = useMemo(() => withdrawals
    .filter(item => item.status === "APPROVED")
    .reduce((total, item) => total + Number(item.payoutAmount || 0), 0), [withdrawals]);

  async function signIn(event) {
    event.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      saveSessionToken(data.token);
      setAuthenticated(true);
      setPassword("");
      navigate("/wallet#wallet");
    } catch (error) {
      setLoginError(error.response?.data?.message || "Login failed. Please check your details and try again.");
    } finally { setLoginLoading(false); }
  }

  const signInWithGoogle = useCallback(async credential => {
    setLoginError("");
    setGoogleLoading(true);
    try {
      const { data } = await api.post("/auth/google", { credential });
      saveSessionToken(data.token);
      setAuthenticated(true);
      setPassword("");
      navigate("/wallet#wallet");
    } catch (error) {
      setLoginError(error.response?.data?.message || "Google sign-in failed. Please try again.");
    } finally { setGoogleLoading(false); }
  }, [navigate]);
  const showGoogleError = useCallback(message => setLoginError(message), []);

  function signOut() {
    // Prevent Google One Tap from immediately signing the user back in after
    // an intentional VELOop sign-out.
    window.google?.accounts?.id?.disableAutoSelect?.();
    clearSessionToken();
    setAuthenticated(false);
    navigate("/login#login");
  }

  function chooseMethod(selected) {
    setMethod(selected);
    setPayoutMessage("");
    setWithdrawalId("");
    setWithdrawalStatus("");
    idempotencyKey.current = null;
    loadOptions(selected);
  }

  function chooseOption(selected) {
    setOption(selected);
    setPayoutMessage("");
    setWithdrawalId("");
    setWithdrawalStatus("");
    idempotencyKey.current = null;
  }

  async function submitWithdrawal(event) {
    event.preventDefault();
    if (!authenticated || requestInFlight.current || !method || !option) return;
    if (walletLoading || !Number.isSafeInteger(wallet?.ves)) {
      setPayoutError("Your wallet balance is unavailable. Open your wallet and refresh before redeeming.");
      return;
    }
    if (wallet.ves < option.requiredAmount) {
      setPayoutError(`You need ${number(option.requiredAmount - wallet.ves)} more VEs for this reward. Start with daily check-in in your wallet.`);
      return;
    }
    const fields = method.requiredDetails || [];
    if (fields.some(field => field.required && !payoutDetails[field.key]?.trim())) {
      setPayoutError("Valid payout details are required.");
      return;
    }
    const upiId = payoutDetails.upiId?.trim();
    if (method.method === "upi" && upiId && !/^[\w.\-]{2,}@[A-Za-z0-9.\-]{2,}$/.test(upiId)) {
      setPayoutError("Enter a valid UPI ID, such as name@bank.");
      return;
    }
    const cost = Number(option.requiredAmount).toLocaleString("en-IN");
    if (!window.confirm(`Confirm redemption of ${formatPayout(option)} for ${cost} VEs?`)) return;
    requestInFlight.current = true;
    setSubmitting(true);
    setPayoutError("");
    idempotencyKey.current ||= crypto.randomUUID();
    try {
      const { data } = await api.post("/withdrawals", {
        method: method.method,
        optionId: option.methodId,
        payoutDetails: Object.fromEntries(fields.map(field => [field.key, payoutDetails[field.key] || ""]))
      }, { headers: { "Idempotency-Key": idempotencyKey.current } });
      setWithdrawalId(data.withdrawal.withdrawalId);
      setWithdrawalStatus(data.withdrawal.status);
      setPayoutMessage("Thank you! Your redemption request has been received.");
      await loadWallet(page);
    } catch (error) {
      setPayoutError(error.response?.data?.message || "Withdrawal failed. Please try again.");
    } finally {
      requestInFlight.current = false;
      setSubmitting(false);
    }
  }

  return <>
    <main id="home" className={dashboardOnly ? "dashboard-only" : undefined}>
      {!dashboardOnly && <section className="hero">
        <div className="hero-content">
          <div className="hero-copy">
            <span className="eyebrow">REWARDS, IN A BETTER LOOP</span>
            <h1>A clearer way to keep <em>good things moving.</em></h1>
            <p>A VELOop Rewards wallet with transparent balances, a traceable activity ledger, and clear payout status.</p>
            <div className="hero-actions"><a className="hero-primary" href="#wallet">Explore your wallet <span>→</span></a>{authenticated ? <a className="hero-secondary" href="/dashboard#wallet">Open dashboard</a> : <a className="hero-secondary" href="/login">Member sign in</a>}</div>
            <div className="pill">✳ &nbsp; Backend-connected wallet &nbsp;·&nbsp; Reward rules stay server-side</div>
          </div>
          <div className="hero-showcase" aria-label="Wallet system highlights">
            <div className="showcase-top"><span className="showcase-orbit">V</span><span><b>VELOop wallet</b><small>BUILT AROUND TRUST</small></span><i>✦</i></div>
            <div className="showcase-line"><span className="showcase-icon">↗</span><span><b>Balances stay server-side</b><small>The API validates every wallet change.</small></span><strong>01</strong></div>
            <div className="showcase-line"><span className="showcase-icon violet">≋</span><span><b>Every change is recorded</b><small>Credits and debits create ledger entries.</small></span><strong>02</strong></div>
            <div className="showcase-line"><span className="showcase-icon gold">◷</span><span><b>Payouts have clear status</b><small>Requests are tracked through review.</small></span><strong>03</strong></div>
            <div className="showcase-foot"><i /> Development assessment · No live payout provider</div>
          </div>
        </div>
        <b className="orb o1" /><b className="orb o2" />
      </section>}

      {!dashboardOnly && <section className="section auth-inline-section" id="login">
        <div className="auth-inline-topbar"><a href="#home" aria-label="Back to home">‹</a><span>Login</span></div>
        <h2 className="auth-inline-title">{authenticated ? "Your account is ready" : "Login To Your Account"}</h2>
        <div className="auth-inline-card">
          {!authenticated ? <>
            <div className="auth-inline-google auth-signup-google"><GoogleIdentityButton mode="login" theme="outline" width={184} onCredential={signInWithGoogle} onError={showGoogleError} /></div>
            {googleLoading && <p className="auth-inline-working" role="status">Verifying your Google account…</p>}
            <div className="auth-inline-divider"><span>OR</span></div>
            <Notice error={loginError} />
            <form className="auth-inline-form" onSubmit={signIn}>
              <label htmlFor="member-email">Email :<input id="member-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required placeholder="Email" /></label>
              <label htmlFor="member-password">Password :<input id="member-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required placeholder="Password" /></label>
              <div className="auth-inline-links"><a href="/register">Don’t have Account? Register</a></div>
              <button type="submit" disabled={loginLoading || googleLoading}>{loginLoading ? "Signing in…" : "Login"}</button>
            </form>
          </> : <div className="auth-inline-signed-in"><div className="auth-inline-status"><b><span aria-hidden="true">✓</span>You’re signed in.</b><p>Your VELOop wallet is ready.</p></div><div className="auth-inline-actions"><a href="#wallet">View wallet <span aria-hidden="true">→</span></a><button className="logout-button" type="button" onClick={signOut}>Sign out</button></div></div>}
        </div>
      </section>}

      <section className={`section${dashboardOnly ? " dashboard-wallet" : ""}`} id="wallet"><div className="heading"><div><small>{dashboardOnly ? "01 / MEMBER DASHBOARD" : "02 / YOUR REWARDS"}</small><h2>{dashboardOnly ? "Your rewards hub." : "Everything in one place."}</h2><p>{dashboardOnly ? "Your balance, daily streak, rewards and activity—all in one place." : "A quick view of your balance and recent activity."}</p></div><label>{dashboardOnly ? "PLAYER DASHBOARD" : "WALLET SCREEN"}</label></div>
        <div className="wallet layout"><aside><div className="brand"><span className="mark">V</span> VELOop</div><small>YOUR SPACE</small><p className="selected"><a href="#wallet">▦ &nbsp; Overview</a></p><p><a href="#activity">↻ &nbsp; Activity</a></p><p><a href="#payout">⇧ &nbsp; Redeem</a></p><div className="account">◉ &nbsp; {authenticated ? "Account secured" : "Sign in to continue"}</div></aside>
          <div className="dash"><div className="dashhead"><span>MEMBER REWARDS OVERVIEW<h3>Your wallet ✳</h3></span><b className="avatar">V</b></div>
            {!authenticated ? <div className="wallet-gate"><b>Sign in to view your wallet.</b><a href="/login">Go to member sign in →</a></div> : <>
              <Notice error={walletError} />
              {walletLoading && !wallet && <div className="wallet-gate">Loading your wallet from the VELOop API…</div>}
              <div className="balance"><small>TOTAL REWARD BALANCE</small><strong>{wallet ? number(wallet.ves) : "—"} <i>VEs</i></strong><span>Balance loaded securely from your account.</span><b>V</b></div>
              <DemoWalletSummary />
              <div className="streak"><div className="streak-copy"><small>DAILY EARNING STREAK</small><b>{streakLoading && !streak ? "Loading streak…" : `${number(streak?.currentStreak)} day${streak?.currentStreak === 1 ? "" : "s"} in a row`} <i>✦</i></b><span>{streak?.checkedInToday ? "Today's check-in is complete. Keep it going tomorrow." : "Check in once each day to build your streak."}{streak ? ` Best: ${number(streak.longestStreak)} days.` : ""}</span>
                <button type="button" className="streak-checkin" disabled={!streak || !streak.canCheckIn || streakLoading || streakSubmitting} onClick={checkIn}>{streakSubmitting ? "Checking in…" : streak?.checkedInToday ? "Checked in today ✓" : "Daily check-in →"}</button>
                <Notice error={streakError} success={streakMessage} />
              </div><div className="streak-days" aria-label="Last seven days">{(streak?.week || []).map(day => <span key={day.dayKey} className={`${day.checkedIn ? "done" : ""}${day.isToday ? " today" : ""}`} aria-label={`${day.weekday}${day.checkedIn ? ", checked in" : ""}${day.isToday ? ", today" : ""}`}>{day.checkedIn ? "✓" : day.weekday.slice(0, 1)}</span>)}</div></div>
              <div className="milestone"><div className="milestone-mark" aria-hidden="true">✧</div><div className="milestone-copy"><small>YOUR NEXT MILESTONE</small><b>{streak ? `${number(streak.milestone.days)}-day streak` : "Loading milestone…"}</b><span>{streak ? `Earn ${number(streak.milestone.rewardVES)} VEs after ${number(streak.milestone.daysUntil)} more daily check-in${streak.milestone.daysUntil === 1 ? "" : "s"}.` : "Milestone configuration is loading."}</span></div><div className="milestone-progress"><div className="milestone-track"><i style={{ width: `${streak ? Math.min(100, streak.milestone.progress / streak.milestone.days * 100) : 0}%` }} /></div><span>{streak ? `${number(streak.milestone.progress)} / ${number(streak.milestone.days)} days` : "—"}</span></div></div>
              <div className="assets">{[
                { key: "sves", name: "SVEs", symbol: "V", note: "Special rewards" },
                { key: "gems", name: "Gems", symbol: "◆", note: "Bonus points" },
                { key: "tokens", name: "Tokens", symbol: "◈", note: "Earned tokens" },
                { key: "spins", name: "Spins", symbol: "✦", note: "Available spins" }
              ].map(asset => <article key={asset.key}><i>{asset.symbol}</i><small>{asset.name}</small><strong>{wallet ? number(wallet[asset.key]) : "—"}</strong><span>{asset.note}</span></article>)}</div>
              <div className="stats"><article><small>VE CREDITS ON THIS PAGE</small><b>{number(veCreditsOnPage)} <i>VEs</i></b><span>Loaded ledger entries only</span></article><article><small>APPROVED PAYOUTS LOADED</small><b>{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(approvedOnPage)}</b><span>Latest payout records</span></article><article><small>LEDGER ACTIVITY</small><b>{number(transactions.length)}</b><span>Entries on page {page} of {pages}</span></article></div>
              <div className="activity" id="activity"><b>Recent activity</b><button type="button" disabled={walletLoading} onClick={() => loadWallet(page)}>{walletLoading ? "Loading…" : "Refresh ↻"}</button></div>
              {walletLoading && transactions.length === 0 ? <div className="wallet-gate">Loading transactions…</div> : transactions.length === 0 ? <div className="wallet-gate">Your wallet activity will appear here after a balance change.</div> : transactions.map(item => <div className="row" key={item.transactionId}><i className={item.direction === "CREDIT" ? "row-credit" : "row-debit"}>{item.direction === "CREDIT" ? "↙" : "↗"}</i><span><b>{item.description || String(item.type).replaceAll("_", " ")}</b><small>{String(item.type).replaceAll("_", " ")} · {formatDate(item.createdAt)}</small></span><strong className={item.direction === "CREDIT" ? "green" : ""}>{item.direction === "CREDIT" ? "+" : "−"}{number(item.amount)} {item.currency}</strong></div>)}
              <div className="wallet-pagination"><span>Page <b>{page}</b> of {pages}</span><span><button type="button" disabled={walletLoading || page <= 1} onClick={() => setPage(value => value - 1)}>← Previous</button><button type="button" disabled={walletLoading || page >= pages} onClick={() => setPage(value => value + 1)}>Next →</button></span></div>
              <div className="wallet-requests"><div className="activity"><b>Your payout requests</b><button type="button" disabled={walletLoading} onClick={() => loadWallet(page)}>Refresh status ↻</button></div>
                {withdrawals.length === 0 ? <p className="wallet-gate">No payout requests yet. Your request status will appear here.</p> : withdrawals.map(item => <div className="row" key={item.withdrawalId}><i className="row-debit">↗</i><span><b>{item.method.toUpperCase()} · {formatDate(item.requestedAt || item.createdAt)}</b><small>{item.withdrawalId}</small></span><strong>{new Intl.NumberFormat("en-IN", { style: "currency", currency: item.payoutCurrency || "INR", maximumFractionDigits: 2 }).format(item.payoutAmount)} · {item.status}</strong></div>)}
              </div>
              <div className="callout"><b>Ready to redeem?<small>Turn your rewards into something useful.</small></b><a href={dashboardOnly ? "/payout#payout" : "#payout"} className="button lime">Explore payouts &nbsp; →</a></div>
            </>}
          </div>
        </div>
      </section>

      {!dashboardOnly && <>
      <StakePreview />
      <MinePreview />

      <section className="section" id="payout"><div className="heading"><div><small>05 / REDEEM REWARDS</small><h2>Make your rewards yours.</h2><p>A simple, reassuring payout selection flow.</p></div><label>PAYOUT SCREEN</label></div>
        <Notice error={payoutError} success={payoutMessage} />
        {payoutMessage && <div className="withdrawal-receipt" role="status"><b>Request {withdrawalId}</b><span>Current status: <strong>{withdrawalStatus}</strong> · {withdrawalStatus === "PENDING" ? "Your request is in the review queue." : "Check the wallet for its latest status."}</span><small>No external payout provider is connected to this assessment system.</small></div>}
        <form className="payout layout" onSubmit={submitWithdrawal}>
          <div className="fields"><div className="between"><a href="#wallet">← &nbsp; Wallet</a><small>STEP 1 OF 2</small></div><h3>Choose your reward.</h3><p>Pick an amount to redeem from your VE balance.</p>
            {!authenticated ? <div className="wallet-gate">Sign in to load payout methods and options. <a href="/login">Go to login →</a></div> : <>
              <div className="method-list">{methodsLoading ? <div className="wallet-gate">Loading payout methods…</div> : methods.length === 0 ? <div className="wallet-gate">No payout methods are currently available.</div> : methods.map(item => <button className={`method${method?.method === item.method ? " active-method" : ""}`} type="button" key={item.method} onClick={() => chooseMethod(item)}><i>{item.name?.slice(0, 1)?.toUpperCase() || "V"}</i><b>{item.name}<small>Sent securely to your payout details</small></b><span>{method?.method === item.method ? "✓" : ""}</span></button>)}</div>
              <label className="payout-options-label">SELECT AN AMOUNT</label>
              {optionsLoading ? <div className="wallet-gate">Loading payout options…</div> : options.length === 0 ? <div className="wallet-gate">No payout options are available for this method.</div> : <div className="amounts">{options.map(item => <button type="button" className={option?.methodId === item.methodId ? "active" : ""} key={item.methodId} onClick={() => chooseOption(item)} aria-pressed={option?.methodId === item.methodId}>{formatPayout(item)}<small>{number(item.requiredAmount)} VEs</small></button>)}</div>}
              {option && <WithdrawalBalanceNotice walletBalance={walletLoading ? undefined : wallet?.ves} requiredAmount={option.requiredAmount} balanceError={walletError} />}
              {method && (method.requiredDetails || []).map(field => <label className="payout-detail-label" key={field.key}>{field.label.toUpperCase()}{field.required ? " *" : ""}<input className="design-input payout-input" required={field.required} type={["email", "tel", "number"].includes(field.inputType) ? field.inputType : "text"} pattern={method.method === "upi" && field.key === "upiId" ? "[A-Za-z0-9_.-]{2,}@[A-Za-z0-9.-]{2,}" : undefined} title={method.method === "upi" && field.key === "upiId" ? "Enter a valid UPI ID, such as name@bank." : undefined} value={payoutDetails[field.key] || ""} autoComplete="off" placeholder={`Enter ${field.label.toLowerCase()}`} onChange={event => { setPayoutDetails(current => ({ ...current, [field.key]: event.target.value })); setPayoutError(""); idempotencyKey.current = null; }} /></label>)}
              {method && method.requiredDetails?.length > 0 && <small className="hint">Enter the payout details required for this method.</small>}
              {option && <button className="button dark wide" type="submit" disabled={submitting || walletLoading || !Number.isSafeInteger(wallet?.ves) || wallet.ves < option.requiredAmount || Boolean(payoutMessage)}>{submitting ? "Submitting request…" : walletLoading || !Number.isSafeInteger(wallet?.ves) ? "Waiting for wallet balance…" : wallet.ves < option.requiredAmount ? "Earn more VEs to redeem" : "Review redemption"}<span>→</span></button>}
              <div className="secure">♧ &nbsp; Your payout details are protected</div>
            </>}
          </div>
          <aside className="summary"><small>REDEMPTION SUMMARY</small>{option ? <><strong>{formatPayout(option)}</strong><p>{method?.name}</p><hr /><div>Rewards to redeem<b>{number(option.requiredAmount)} VEs</b></div><div>Processing fee<b>Not configured</b></div><hr /><div>You’ll receive<b>{formatPayout(option)}</b></div><blockquote>◷ &nbsp; <span><b>Pending review</b><small>Request status appears in your wallet.</small></span></blockquote></> : <div className="summary-empty"><span>✳</span><b>Select a reward</b><small>Your redemption summary appears here.</small></div>}</aside>
        </form>
      </section></>}
    </main>
    <footer><span className="brand"><span className="mark">V</span> VELOop<span>rewards</span></span><p>Backend-connected wallet · No production payout integration</p><small>VELOOP REWARDS &nbsp; 2026</small></footer>
  </>;
}

