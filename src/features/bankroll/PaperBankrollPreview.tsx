import { AppIcon } from '@/src/features/app-shell/AppIcon';

export function PaperBankrollPreview() {
  return (
    <section className="bankroll-preview" aria-labelledby="bankroll-preview-title">
      <div className="preview-copy">
        <p className="eyebrow">Paper bankroll preview</p>
        <h2 id="bankroll-preview-title">Practise the discipline before the decision.</h2>
        <p>Future setup will make limits visible from the start, keep paper performance separate from real money, and treat passing as a valid outcome.</p>
      </div>
      <div className="limit-card" aria-label="Future paper bankroll setup preview">
        <div className="limit-card-head"><span className="step-icon"><AppIcon name="wallet" size={21} /></span><span>Setup preview</span></div>
        <div className="limit-row"><span>Starting balance</span><strong>Not set</strong></div>
        <div className="limit-row"><span>Single-position cap</span><strong>2.5% max</strong></div>
        <div className="limit-row"><span>Mode</span><strong>Paper only</strong></div>
        <button type="button" disabled>Available after account setup <AppIcon name="arrow" size={17} /></button>
      </div>
    </section>
  );
}
