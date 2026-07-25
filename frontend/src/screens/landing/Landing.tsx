import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import './landing.css';

export function Landing() {
  const nav = useNavigate();
  return (
    <div className="landing">
      <header className="landing-head">
        <div className="landing-logo">
          <span className="landing-mark"><Icon name="capsule" size={22} strokeWidth={1.9} /></span>
          Pharmacy in Your Pocket
        </div>
        <nav className="landing-nav">
          <a href="#features">Features</a>
          <a href="#privacy">Privacy</a>
          <button className="landing-openapp" onClick={() => nav('/auth')}>
            Open App
            <Icon name="chevron" size={16} strokeWidth={2.1} />
          </button>
        </nav>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <span className="landing-eyebrow">
            <Icon name="shield" size={14} strokeWidth={2.2} />
            NHS-connected medication tracker
          </span>
          <h1>Every medication you take, in one pocket.</h1>
          <p>
            Bring your NHS, private and over-the-counter medicines together, get a
            heads-up on potential interactions, and share a clear summary with your GP.
          </p>
          <div className="landing-cta-row">
            <button className="landing-cta primary" onClick={() => nav('/auth')}>
              Open App
              <Icon name="chevron" size={19} strokeWidth={2.1} />
            </button>
            <button className="landing-cta ghost" onClick={() => nav('/onboarding')}>
              Create your profile
            </button>
          </div>
          <div className="landing-trust">
            <Icon name="lock" size={15} strokeWidth={2} />
            Free to use · Connects securely with your NHS login
          </div>
        </section>

        <section className="landing-features" id="features">
          <div className="landing-feat">
            <span className="fi"><Icon name="shield" size={22} strokeWidth={1.8} /></span>
            <h3>Connect your NHS record</h3>
            <p>Pull in prescriptions automatically, then add private and OTC medicines yourself.</p>
          </div>
          <div className="landing-feat">
            <span className="fi"><Icon name="warning" size={22} strokeWidth={1.8} /></span>
            <h3>Spot potential interactions</h3>
            <p>See when two medicines may not mix well, explained in plain English.</p>
          </div>
          <div className="landing-feat">
            <span className="fi"><Icon name="qr" size={22} strokeWidth={1.8} /></span>
            <h3>Share with your GP</h3>
            <p>Generate a QR code that opens a ready-made summary of your medicines.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
