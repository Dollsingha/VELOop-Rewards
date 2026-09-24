import React from "react";

export default function Brand({ compact = false }) {
  return (
    <span className={compact ? "brand brand-compact" : "brand"}>
      <span className="brand-symbol" aria-hidden="true"><span /></span>
      <span className="brand-word"><span>VE</span>Loop</span>
      {!compact && <span className="brand-rewards">REWARDS</span>}
    </span>
  );
}
