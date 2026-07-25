import { PhoneFrame, StatusBar, SubHeader } from '../../components/Frame';
import { Icon } from '../../components/Icon';
import { MedCard } from '../../components/MedCard';
import { useStore } from '../../data/store';
import './archive.css';

export function Archive() {
  const { state, restoreMedication } = useStore();
  const archived = state.medications.filter((m) => m.status === 'archived');

  return (
    <PhoneFrame label="Archive">
      <StatusBar />
      <SubHeader title="Archive" />
      <div className="screen-body">
        <div className="archive-screen">
          {archived.length === 0 ? (
            <div className="arch-empty">
              <span className="eicon"><Icon name="archive" size={28} /></span>
              <div className="etitle">Nothing archived yet</div>
              <div className="etext">
                Medicines you stop taking or finish a course of will appear here, kept for your records.
              </div>
            </div>
          ) : (
            <>
              <div className="arch-head">
                <span className="glabel">Archived medications</span>
                <span className="count">{archived.length}</span>
              </div>
              <div className="arch-note">Medicines you no longer take. Tap one to restore it to your list.</div>
              <div className="arch-list">
                {archived.map((med) => (
                  <MedCard key={med.id} med={med} onClick={() => restoreMedication(med.id)} trailing="restore" />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}
