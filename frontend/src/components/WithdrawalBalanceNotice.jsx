import "./withdrawal-balance.css";

const amount = value => Number(value).toLocaleString("en-IN");

export default function WithdrawalBalanceNotice({ walletBalance, requiredAmount }) {
  if (!Number.isSafeInteger(walletBalance) || !Number.isSafeInteger(requiredAmount)) {
    return <p className="withdrawal-balance-note" role="status">Checking your available wallet balance…</p>;
  }
  const shortfall = Math.max(0, requiredAmount - walletBalance);
  return <div className={`withdrawal-balance-note${shortfall ? " has-shortfall" : ""}`} role="status">
    <div><span>Available in your wallet</span><b>{amount(walletBalance)} VEs</b></div>
    <div><span>Required for this reward</span><b>{amount(requiredAmount)} VEs</b></div>
    <p>{shortfall ? `You need ${amount(shortfall)} more VEs before requesting this withdrawal.` : "Your wallet has enough VEs to request this reward."}</p>
    <small>The backend validates your balance when you submit. A withdrawal request goes through review before a payout is confirmed.</small>
  </div>;
}
