import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneFrame, StatusBar } from '../../components/Frame';
import { Icon } from '../../components/Icon';
import { useStore } from '../../data/store';
import './onboarding.css';

type Step = 'profile' | 'disclosure';

const GENDERS = ['Female', 'Male', 'Other', 'Prefer not to say'];

export function Onboarding() {
  const nav = useNavigate();
  const store = useStore();

  const [step, setStep] = useState<Step>('profile');
  const [age, setAge] = useState('34');
  const [gender, setGender] = useState('Female');
  const [meds, setMeds] = useState<string[]>(['Atorvastatin', 'Metformin', 'Warfarin']);
  const [adding, setAdding] = useState(false);
  const [newMed, setNewMed] = useState('');
  const [consent, setConsent] = useState(false);

  const removeMed = (name: string) => setMeds((m) => m.filter((x) => x !== name));
  const addMed = () => {
    const v = newMed.trim();
    if (v && !meds.some((m) => m.toLowerCase() === v.toLowerCase())) {
      setMeds((m) => [...m, v]);
    }
    setNewMed('');
    setAdding(false);
  };

  const goToDisclosure = () => {
    const parsedAge = Number(age);
    store.updateProfile(parsedAge > 0 ? { age: parsedAge, gender } : { gender });
    setStep('disclosure');
  };

  const finish = () => {
    store.setOnboarded(true);
    nav('/home');
  };

  const onBack = () => {
    if (step === 'disclosure') setStep('profile');
    else nav(-1);
  };

  return (
    <PhoneFrame label="Create your profile">
      <StatusBar />

      <div className="ob-topbar">
        <button className="ob-rbtn" aria-label="Back" onClick={onBack}>
          <Icon name="back" size={22} strokeWidth={2} />
        </button>
        <span className="ob-step">{step === 'profile' ? 'Step 1 of 2' : 'Step 2 of 2'}</span>
      </div>
      <div className="ob-progress"><i style={{ width: step === 'profile' ? '50%' : '100%' }} /></div>

      {step === 'profile' ? (
        <div className="ob-screen">
          <div className="ob-head">
            <h1>Create your profile</h1>
            <p>A few details help us check your medicines are safe for you.</p>
          </div>
          <div className="ob-body">
            <div className="ob-field">
              <div className="ob-flabel">Age</div>
              <div className="ob-input">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  aria-label="Age in years"
                />
                <span className="u">years</span>
              </div>
            </div>

            <div className="ob-field">
              <div className="ob-flabel">Gender</div>
              <div className="ob-chips" role="radiogroup" aria-label="Gender">
                {GENDERS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    role="radio"
                    aria-checked={gender === g}
                    className={`ob-chip${gender === g ? ' on' : ''}`}
                    onClick={() => setGender(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="ob-field">
              <div className="ob-flabel">Your medications</div>
              <div className="ob-medchips">
                {meds.map((m) => (
                  <span key={m} className="ob-medchip">
                    {m}
                    <button className="x" aria-label={`Remove ${m}`} onClick={() => removeMed(m)}>
                      <Icon name="close" size={10} strokeWidth={3} />
                    </button>
                  </span>
                ))}
              </div>

              {adding ? (
                <div className="ob-addrow">
                  <input
                    autoFocus
                    placeholder="Medication name"
                    value={newMed}
                    onChange={(e) => setNewMed(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addMed(); }}
                    aria-label="New medication name"
                  />
                  <button className="ob-chip on" type="button" onClick={addMed}>Add</button>
                </div>
              ) : (
                <button className="ob-addmed" type="button" onClick={() => setAdding(true)}>
                  <Icon name="plus" size={17} strokeWidth={2.1} />
                  Add a medication
                </button>
              )}

              <div className="ob-hint">
                <Icon name="info" size={14} strokeWidth={2} />
                Add what you take now, or connect your NHS record. You can do this any time.
              </div>
            </div>
          </div>
          <div className="ob-footer">
            <button className="ob-cta" onClick={goToDisclosure}>
              Continue
              <Icon name="chevron" size={18} strokeWidth={2.1} />
            </button>
            <button className="ob-skiplink" onClick={goToDisclosure}>I&rsquo;ll add my medications later</button>
          </div>
        </div>
      ) : (
        <div className="ob-screen">
          <div className="ob-head">
            <h1>Where your information comes from</h1>
            <p>To keep your medicine details accurate, the app brings together information from trusted external services.</p>
          </div>
          <div className="ob-body">
            <div className="ob-srccard">
              <div className="ob-srcrow">
                <span className="si"><Icon name="shield" size={20} strokeWidth={1.8} /></span>
                <div>
                  <div className="s1">Your NHS record</div>
                  <div className="s2">Prescriptions, medicine details and interaction information, with your permission.</div>
                </div>
              </div>
            </div>

            <div className="ob-note">
              <Icon name="info" size={15} strokeWidth={2} />
              This information is shown for your reference only. It isn&rsquo;t medical advice, and the app doesn&rsquo;t diagnose or prescribe.
            </div>

            <label className="ob-consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span className="ob-box"><Icon name="check" size={15} strokeWidth={2.6} /></span>
              <span className="ob-ct">I understand my medicine information is sourced from these external services.</span>
            </label>
          </div>
          <div className="ob-footer">
            <button className="ob-cta" disabled={!consent} onClick={finish}>
              Agree &amp; continue
              <Icon name="chevron" size={18} strokeWidth={2.1} />
            </button>
          </div>
        </div>
      )}
    </PhoneFrame>
  );
}
