import { Modal, GpNote } from '../../components/Frame';
import { Icon, iconForRoute } from '../../components/Icon';
import type { Interaction, Medication } from '../../data/types';
import './warning.css';

const norm = (s: string) => s.trim().toLowerCase();

/** Interaction warning shown after adding a medication that clashes with an existing one.
 *  Amber tone only, single "Potential interaction" label — no High/Moderate grading (legal). */
export function Warning({
  newMed,
  existing,
  interaction,
  extraCount = 0,
  onAddAndReview,
  onAddAnyway,
  onClose,
}: {
  newMed: Medication;
  existing?: Medication;
  interaction: Interaction;
  /** Additional interactions beyond the one shown (same new med). */
  extraCount?: number;
  onAddAndReview: () => void;
  onAddAnyway: () => void;
  onClose?: () => void;
}) {
  // Fall back to the interaction rule if the existing med isn't passed in.
  const newIsA = norm(interaction.a) === norm(newMed.name);
  const exName = existing?.name ?? (newIsA ? interaction.b : interaction.a);
  const exCategory = existing?.category ?? (newIsA ? interaction.bCategory : interaction.aCategory);
  const exRoute = existing?.route;

  return (
    <Modal onClose={onClose}>
      <div className="warn-modal">
        <div className="warn-halo">
          <Icon name="warning" size={44} strokeWidth={1.8} />
        </div>
        <h2 className="warn-title">Potential interaction</h2>
        <p className="warn-sub">
          The medication you just added may interact with one already on your list.
          {extraCount > 0 && (
            <> {extraCount} other potential interaction{extraCount === 1 ? '' : 's'} also involve this medicine.</>
          )}
        </p>

        <div className="warn-pair">
          <div className="warn-pill">
            <span className="warn-newtag">New</span>
            <span className="warn-ic"><Icon name={iconForRoute(newMed.route)} size={18} /></span>
            <span className="warn-ptext">
              <span className="warn-pn">{newMed.name}</span>
              <span className="warn-pt">{newMed.category}</span>
            </span>
          </div>
          <span className="warn-swap" aria-hidden>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 8h11M7 8l3-3M7 8l3 3" /><path d="M17 16H6M17 16l-3-3M17 16l-3 3" />
            </svg>
          </span>
          <div className="warn-pill">
            <span className="warn-ic"><Icon name={iconForRoute(exRoute)} size={18} /></span>
            <span className="warn-ptext">
              <span className="warn-pn">{exName}</span>
              <span className="warn-pt">{exCategory}</span>
            </span>
          </div>
        </div>

        <div className="warn-reason">
          <Icon name="warning" size={17} strokeWidth={2} />
          <span>{interaction.reason}</span>
        </div>

        <div className="warn-gpline" aria-hidden>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3v6a6 6 0 0 0 12 0V3" /><path d="M4 3h4M16 3h4" />
            <path d="M18 15a3 3 0 0 1 3 3v1a3 3 0 0 1-6 0" />
          </svg>
          Please discuss with your GP
        </div>

        <div className="warn-actions">
          <button className="btn primary" onClick={onAddAndReview}>
            Review interaction
            <Icon name="chevron" size={18} strokeWidth={2} />
          </button>
          <button className="btn warn-ghost" onClick={onAddAnyway}>Add to my list anyway</button>
        </div>

        <GpNote>Information only. Not medical advice · {interaction.source}</GpNote>
      </div>
    </Modal>
  );
}
