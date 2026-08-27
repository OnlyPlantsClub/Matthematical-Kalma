import { AppIcon } from '@/src/features/app-shell/AppIcon';

const steps = [
  { icon: 'user', title: 'Create your private account', copy: 'Personal access and isolation will be enabled by the platform integration.' },
  { icon: 'wallet', title: 'Set a paper bankroll', copy: 'Choose a practice amount and conservative limits. No real funds are connected.' },
  { icon: 'chart', title: 'Wait for qualified markets', copy: 'Opportunities appear only when sources, freshness and model confidence are verified.' },
] as const;

export function GettingStarted() {
  return (
    <section className="getting-started" id="getting-started" aria-labelledby="getting-started-title">
      <div className="section-head onboarding-head">
        <div><p className="eyebrow">Presentation preview</p><h2 id="getting-started-title">Your calm start</h2></div>
        <span className="coming-pill">Stage 3</span>
      </div>
      <div className="onboarding-grid">
        {steps.map((step, index) => (
          <article className="onboarding-step" key={step.title}>
            <span className="step-number">0{index + 1}</span>
            <span className="step-icon"><AppIcon name={step.icon} size={22} /></span>
            <h3>{step.title}</h3>
            <p>{step.copy}</p>
          </article>
        ))}
      </div>
      <div className="preview-note"><AppIcon name="check" size={17} /><p><strong>UI only.</strong> These steps do not create an account, save a bankroll or connect to live markets.</p></div>
    </section>
  );
}
