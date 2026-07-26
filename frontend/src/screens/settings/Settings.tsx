import { useNavigate } from 'react-router-dom';
import { PhoneFrame, StatusBar, SubHeader } from '../../components/Frame';
import { Icon } from '../../components/Icon';
import { ChipGroup } from '../../components/form/Form';
import { useStore } from '../../data/store';
import { useTheme, type Theme } from '../../lib/theme';
import './settings.css';

const themeOptions: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export function Settings() {
  const nav = useNavigate();
  const { state } = useStore();
  const { theme, setTheme } = useTheme();
  const { profile } = state;

  const archivedMeds = state.medications.filter((m) => m.status === 'archived').length;
  const archivedInteractions = 3; // resolved past warnings (no persisted store yet)

  return (
    <PhoneFrame label="Settings">
      <StatusBar />
      <SubHeader title="Settings" onBack={() => nav('/home')} />
      <div className="screen-body">
        <div className="settings-screen stagger">

          {/* profile card */}
          <button className="profile" type="button" onClick={() => nav('/settings')}>
            <span className="pavatar"><Icon name="profile" size={30} strokeWidth={1.6} /></span>
            <div className="pinfo">
              <div className="pname">{profile.name}</div>
              <div className="pmeta">{profile.age} · {profile.gender}{profile.nhsLinked ? ' · NHS linked' : ''}</div>
            </div>
            <span className="editbtn">Edit</span>
          </button>

          {/* personal details */}
          <div className="group">
            <div className="glabel">Personal details</div>
            <div className="list">
              <button className="row" type="button" onClick={() => nav('/settings')}>
                <span className="ricon"><Icon name="calendar" size={18} /></span>
                <span className="rlabel">Age</span>
                <span className="rval">{profile.age}</span>
                <Icon name="chevron" className="chev" size={19} />
              </button>
              <button className="row" type="button" onClick={() => nav('/settings')}>
                <span className="ricon"><Icon name="profile" size={18} /></span>
                <span className="rlabel">Gender</span>
                <span className="rval">{profile.gender}</span>
                <Icon name="chevron" className="chev" size={19} />
              </button>
              <button className="row" type="button" onClick={() => nav('/settings')}>
                <span className="ricon"><Icon name="shield" size={18} /></span>
                <span className="rlabel">Allergies &amp; conditions<small>Used to check interactions</small></span>
                <span className="rval">{profile.conditions.length} added</span>
                <Icon name="chevron" className="chev" size={19} />
              </button>
            </div>
          </div>

          {/* archive */}
          <div className="group">
            <div className="glabel">Archive</div>
            <div className="list">
              <button className="row" type="button" onClick={() => nav('/archive')}>
                <span className="ricon"><Icon name="archive" size={18} /></span>
                <span className="rlabel">Archived medications<small>Medicines you no longer take</small></span>
                <span className="rcount">{archivedMeds}</span>
                <Icon name="chevron" className="chev" size={19} />
              </button>
              <button className="row" type="button" onClick={() => nav('/archive')}>
                <span className="ricon"><Icon name="warning" size={18} /></span>
                <span className="rlabel">Archived interactions<small>Past warnings you’ve resolved</small></span>
                <span className="rcount">{archivedInteractions}</span>
                <Icon name="chevron" className="chev" size={19} />
              </button>
            </div>
          </div>

          {/* data & account */}
          <div className="group">
            <div className="glabel">Data &amp; account</div>
            <div className="list">
              <button className="row" type="button" onClick={() => nav('/settings/nhs')}>
                <span className="ricon"><Icon name="link" size={18} /></span>
                <span className="rlabel">NHS connection<small>Last synced {state.lastSynced}</small></span>
                <span className="conn">Linked</span>
                <Icon name="chevron" className="chev" size={19} />
              </button>
              <div className="theme-row">
                <div className="theme-head">
                  <span className="ricon"><Icon name="settings" size={18} /></span>
                  <span className="rlabel">Theme</span>
                </div>
                <span className="theme-chips">
                  <ChipGroup options={themeOptions} value={theme} onChange={setTheme} />
                </span>
              </div>
              <button className="row" type="button" onClick={() => nav('/settings')}>
                <span className="ricon"><Icon name="bell" size={18} /></span>
                <span className="rlabel">Reminders &amp; notifications</span>
                <Icon name="chevron" className="chev" size={19} />
              </button>
            </div>
          </div>

        </div>
      </div>
    </PhoneFrame>
  );
}
