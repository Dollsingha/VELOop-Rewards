import "./withdrawal-balance.css";

const amount = value => Number(value).toLocaleString("en-IN");

export default function WithdrawalBalanceNotice({ walletBalance, requiredAmount, balanceError }) {
  if (balanceError) {
    return <div className="withdrawal-balance-note has-shortfall" role="status"><p>Your wallet balance could not be loaded.</p><a href="#wallet">Return to your wallet and refresh →</a></div>;
  }
  if (!Number.isSafeInteger(walletBalance) || !Number.isSafeInteger(requiredAmount)) {
    return <p className="withdrawal-balance-note" role="status">Checking your available wallet balance…</p>;
  }
  const shortfall = Math.max(0, requiredAmount - walletBalance);
  return <div className={`withdrawal-balance-note${shortfall ? " has-shortfall" : ""}`} role="status">
    {walletBalance === 0 && <h4>Welcome! Build your rewards before redeeming.</h4>}
    <div><span>Available in your wallet</span><b>{amount(walletBalance)} VEs</b></div>
    <div><span>Required for this reward</span><b>{amount(requiredAmount)} VEs</b></div>
    <p>{shortfall ? `You need ${amount(shortfall)} more VEs before requesting this withdrawal.` : "Your wallet has enough VEs to request this reward."}</p>
    {shortfall > 0 && <><small>Start with daily check-in in your wallet. Rewards are granted according to the configured streak rules.</small><a href="#wallet">View wallet &amp; daily check-in →</a><a href="/buy-ves">Buy VEs · Test checkout →</a></>}
    <small>The backend validates your balance when you submit. A withdrawal request goes through review before a payout is confirmed.</small>
  </div>;
}
