import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Compass, FlaskConical, ShieldCheck, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const STORAGE_KEY = 'ghm-onboarding-complete-v1';

function wasDismissed() {
  try { return localStorage.getItem(STORAGE_KEY) === 'yes'; } catch { return false; }
}

export const GettingStarted: React.FC = () => {
  const { auth, isDemo, enterDemoWorkspace, navigateTo } = useApp();
  const [open, setOpen] = useState(() => !wasDismissed());
  const [step, setStep] = useState(0);
  const steps = [
    { icon: <Compass size={19} aria-hidden="true" />, eyebrow: 'YOUR WORKSPACE', title: 'A clearer view of your GitHub work.', text: 'Find your repositories, manage their settings, and keep everyday operations in one place.' },
    { icon: <ShieldCheck size={19} aria-hidden="true" />, eyebrow: 'CONNECT OR EXPLORE', title: 'Start on your terms.', text: 'Connect a personal access token to work with GitHub, or try the sample workspace with clearly labeled demo data. Use the minimum permissions you need.' },
    { icon: <BookOpen size={19} aria-hidden="true" />, eyebrow: 'FIND YOUR FLOW', title: 'From overview to action.', text: 'Filter the repository ledger, open a repository for detailed controls, or select several for batch operations. Destructive actions require confirmation.' },
  ];
  const current = steps[step];
  const dismiss = () => {
    setOpen(false);
    try { localStorage.setItem(STORAGE_KEY, 'yes'); } catch { /* Still dismiss for this session. */ }
  };
  const begin = () => {
    dismiss();
    if (auth?.authenticated) navigateTo('ledger');
    else void enterDemoWorkspace();
  };

  if (!open) return <div className="guide-reopen"><button className="btn btn-ghost btn-sm" type="button" onClick={() => { setStep(0); setOpen(true); }}><BookOpen size={14} aria-hidden="true" /> Getting started</button></div>;

  return <section className="onboarding" aria-label="Getting started guide">
    <div className="onboarding-top"><span className="onboarding-kicker">GETTING STARTED <span>/</span> {String(step + 1).padStart(2, '0')} — 03</span><button type="button" className="onboarding-close" aria-label="Dismiss getting started guide" onClick={dismiss}><X size={17} aria-hidden="true" /></button></div>
    <div className="onboarding-content" aria-live="polite" aria-atomic="true" key={step}>
      <div className="onboarding-icon">{current.icon}</div><div><span className="onboarding-eyebrow">{current.eyebrow}</span><h2>{current.title}</h2><p>{current.text}</p></div>
    </div>
    <div className="onboarding-bottom"><div className="onboarding-progress" aria-label={`Step ${step + 1} of 3`}>{steps.map((_, index) => <span key={index} className={index === step ? 'active' : ''} />)}</div><div className="onboarding-actions">
      {step > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(step - 1)}><ArrowLeft size={14} aria-hidden="true" /> Back</button>}
      {step < steps.length - 1 ? <button type="button" className="btn btn-primary btn-sm" onClick={() => setStep(step + 1)}>Next <ArrowRight size={14} aria-hidden="true" /></button> : <button type="button" className="btn btn-primary btn-sm" onClick={begin}>{auth?.authenticated ? 'Go to repositories' : 'Explore sample data'} {auth?.authenticated ? <ArrowRight size={14} aria-hidden="true" /> : <FlaskConical size={14} aria-hidden="true" />}</button>}
      {step === steps.length - 1 && !auth?.authenticated && !isDemo && <button type="button" className="btn btn-sm" onClick={() => { dismiss(); document.getElementById('pat-secret-input')?.focus(); }}>Connect a token</button>}
    </div></div>
  </section>;
};
