interface BankrollControlProps { bankroll: number; onChange: (bankroll: number) => void; }

export function BankrollControl({ bankroll, onChange }: BankrollControlProps) {
  return (
    <div className="bank-card">
      <div><span>Working bankroll</span><strong>${bankroll.toLocaleString()}</strong></div>
      <input aria-label="Working bankroll" type="range" min="500" max="10000" step="100" value={bankroll} onChange={(event) => onChange(Number(event.target.value))} />
      <div className="bank-meta"><span>Position cap <b>2.5%</b></span><span>Mode <b>Paper</b></span></div>
    </div>
  );
}
