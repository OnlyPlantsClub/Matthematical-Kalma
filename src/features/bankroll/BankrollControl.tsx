import { AppIcon } from '@/src/features/app-shell/AppIcon';

export function BankrollControl() {
  return (
    <div className="bank-card bank-empty">
      <div><span>Paper bankroll</span><strong>Not set</strong></div>
      <p>Create a private account and complete onboarding before any personal balance, limits or insights appear.</p>
      <button type="button" disabled>Account setup coming next <AppIcon name="arrow" size={16} /></button>
    </div>
  );
}
