import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneFrame, StatusBar } from '../../components/Frame';
import { Icon } from '../../components/Icon';
import './auth.css';

type Step = 'signin' | 'faceid';

function Brand() {
  return (
    <div className="auth-brand">
      <span className="auth-mark"><Icon name="capsule" size={34} strokeWidth={1.9} /></span>
      <span className="auth-brandname">Pharmacy in Your Pocket</span>
    </div>
  );
}

export function Auth() {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>('signin');
  const [email, setEmail] = useState('');

  const unlock = () => nav('/home');

  return (
    <PhoneFrame label="Sign in">
      <StatusBar />

      {step === 'signin' ? (
        <div className="auth-screen">
          <Brand />
          <div className="si-body">
            <h1>Sign in to continue</h1>
            <div className="si-sub">Your medicines, interactions and GP summary, all in one place.</div>

            <div className="authbtns">
              <button className="authbtn apple" onClick={() => setStep('faceid')}>
                <Icon name="apple" size={19} />
                Continue with Apple
              </button>
              <button className="authbtn google" onClick={() => setStep('faceid')}>
                <Icon name="google" size={18} />
                Continue with Google
              </button>
            </div>

            <div className="auth-divider">or</div>

            <form
              className="emailrow"
              onSubmit={(e) => { e.preventDefault(); setStep('faceid'); }}
            >
              <label className="emailfield">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="name@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-label="Email address"
                />
              </label>
              <button type="submit" className="authbtn email">Continue with email</button>
            </form>
          </div>

          <div className="auth-terms">
            By continuing you agree to our <b>Terms</b> and <b>Privacy Policy</b>.
          </div>
        </div>
      ) : (
        <div className="auth-screen">
          <Brand />
          <div className="fid">
            <div className="greeting">Welcome back, Jordan</div>
            <button className="halo" aria-label="Unlock with Face ID" onClick={unlock}>
              <Icon name="faceid" size={74} strokeWidth={1.5} />
            </button>
            <h1>Unlock with Face ID</h1>
            <p>Look at your phone to open your medicines securely.</p>
          </div>
          <div className="fid-foot">
            <button className="passcode" onClick={unlock}>Use passcode instead</button>
          </div>
        </div>
      )}
    </PhoneFrame>
  );
}
