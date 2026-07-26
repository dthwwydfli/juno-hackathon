import { useNavigate } from 'react-router-dom';
import { APP_NAME } from '../../lib/brand';
import { LandingIcon } from './LandingIcon';
import { LandingLogo } from './LandingLogo';
import { LandingStory } from './LandingStory';
import './landing.css';

export function Landing() {
  const nav = useNavigate();

  const openApp = () => nav('/auth');

  const introActions = (
    <>
      <div className="landing-cta-row">
        <button type="button" className="landing-cta primary" onClick={openApp}>
          Open App
          <LandingIcon name="chevron" size={19} strokeWidth={2} />
        </button>
        <button type="button" className="landing-cta ghost" onClick={() => nav('/onboarding')}>
          Create your profile
        </button>
      </div>
      <div className="landing-trust">
        <LandingIcon name="lock" size={15} strokeWidth={1.65} />
        Free to use. Connects securely with your NHS login.
      </div>
    </>
  );

  return (
    <div className="landing">
      <header className="landing-head">
        <div className="landing-logo">
          <LandingLogo size={38} />
          {APP_NAME}
        </div>
        <nav className="landing-nav" aria-label="Marketing">
          <a href="#story">Story</a>
          <a href="#privacy">Privacy</a>
          <button type="button" className="landing-openapp" onClick={openApp}>
            Open App
            <LandingIcon name="chevron" size={16} strokeWidth={2} />
          </button>
        </nav>
      </header>

      <main className="landing-main landing-main-story">
        <LandingStory introActions={introActions} />

        <section className="landing-cta-band" aria-label="Get started">
          <h2 className="landing-cta-band-title">Ready to open your cabinet?</h2>
          <button type="button" className="landing-cta-link" onClick={openApp}>
            Open app
            <LandingIcon name="external" size={20} strokeWidth={1.65} />
          </button>
        </section>
      </main>

      <footer className="landing-foot">
        <div className="landing-foot-brand">
          <LandingLogo size={32} />
          {APP_NAME}
        </div>
        <nav className="landing-foot-nav" aria-label="Footer">
          <a href="#story">Story</a>
          <a href="#privacy">Privacy</a>
        </nav>
        <p className="landing-foot-note">Hackathon prototype. Not a licensed medical device.</p>
      </footer>
    </div>
  );
}
