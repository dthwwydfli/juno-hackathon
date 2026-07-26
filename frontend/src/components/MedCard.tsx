import { Icon, iconForRoute } from './Icon';
import type { Medication } from '../data/types';

interface MedCardProps {
  med: Medication;
  flagged?: boolean;
  onEdit?: () => void;        // pencil + whole-card tap → edit medication
  onWarning?: () => void;     // amber badge → interactions (only shown when flagged)
  onClick?: () => void;       // whole-card tap override (e.g. restore in Archive)
  trailing?: 'chevron' | 'restore' | 'none';
}

/** Uniform grey thumbnail; the glyph encodes the medication form (not a per-item colour).
 *  Right side: an edit pencil and/or a clickable amber warning when the med has an interaction. */
export function MedCard({ med, flagged, onEdit, onWarning, onClick, trailing = 'chevron' }: MedCardProps) {
  const schedule = med.scheduleLabel || med.times.join(', ');
  // Whole-card tap: an explicit onClick (e.g. Archive restore), or — only when flagged —
  // the interaction shortcut. Non-flagged cards are edited via the pencil only.
  const cardTap = onClick ?? (flagged && onWarning ? onWarning : undefined);

  return (
    <div
      className={`med${flagged ? ' flag' : ''}${cardTap ? ' tappable' : ''}`}
      role={cardTap ? 'button' : undefined}
      tabIndex={cardTap ? 0 : undefined}
      onClick={cardTap}
      onKeyDown={cardTap ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cardTap(); } } : undefined}
    >
      <span className="thumb" title={med.route}>
        <Icon name={iconForRoute(med.route)} size={25} />
      </span>
      <span className="body">
        <span className="name">{med.name}</span>
        <span className="colloq">{med.brand}</span>
        <span className="dose">{med.dose}<span className="dot" />{schedule}</span>
      </span>
      <span className="right">
        {flagged && onWarning && (
          <button
            type="button"
            className="warn-badge act-btn"
            aria-label="Possible interaction, view details"
            onClick={(e) => { e.stopPropagation(); onWarning(); }}
          >
            <Icon name="warning" size={17} strokeWidth={1.9} />
          </button>
        )}
        {onEdit && (
          <button
            type="button"
            className="edit-badge act-btn"
            aria-label={`Edit ${med.name}`}
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <Icon name="edit" size={17} />
          </button>
        )}
        {!onEdit && trailing === 'restore' && (
          <span className="restore-badge" aria-hidden><Icon name="sync" size={17} /></span>
        )}
        {!onEdit && trailing === 'chevron' && (
          <Icon name="chevron" className="chev" size={20} />
        )}
      </span>
    </div>
  );
}
