import { Icon } from './Icon';
import { PillGlyph } from './PillGlyph';
import type { Medication } from '../data/types';

interface MedCardProps {
  med: Medication;
  flagged?: boolean;
  /** Row tap / pencil → edit. In `row` variant the whole row is the target. */
  onEdit?: () => void;
  /** Amber badge → interactions. Only rendered when the med is flagged. */
  onWarning?: () => void;
  /** Overrides the whole-row tap (e.g. restore in Archive). */
  onClick?: () => void;
  trailing?: 'chevron' | 'restore' | 'none';
  /** `row` sits inside a grouped inset list; `card` is the standalone card. */
  variant?: 'card' | 'row';
}

/**
 * A medication line.
 *
 * The leading visual is a PillGlyph rather than an icon tile: shape from the
 * medication's form, colour from its name. The old grey/tinted rounded square
 * was identical on every row, which is what made the list look like sample data.
 */
export function MedCard({
  med,
  flagged,
  onEdit,
  onWarning,
  onClick,
  trailing = 'chevron',
  variant = 'card',
}: MedCardProps) {
  const schedule = med.scheduleLabel || med.times.join(', ');
  const row = variant === 'row';

  // In `row` variant the whole line opens the medication, which is how a
  // grouped list is expected to behave — and lets the pencil button go away.
  // In `card` variant the old semantics are preserved for Archive.
  const cardTap = onClick ?? (row ? onEdit : flagged && onWarning ? onWarning : undefined);

  return (
    <div
      className={`${row ? 'med-row' : 'med'}${flagged ? ' flag' : ''}${cardTap ? ' tappable' : ''}`}
      role={cardTap ? 'button' : undefined}
      tabIndex={cardTap ? 0 : undefined}
      onClick={cardTap}
      onKeyDown={cardTap ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cardTap(); } } : undefined}
    >
      <span className="thumb" title={med.route}>
        <PillGlyph name={med.name} form={med.form} size={row ? 38 : 40} />
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
            aria-label={`${med.name} has a potential interaction, view details`}
            onClick={(e) => { e.stopPropagation(); onWarning(); }}
          >
            <Icon name="warning" size={17} strokeWidth={1.8} />
          </button>
        )}

        {/* The pencil only survives in `card` variant; in a grouped row the
            whole line is already the edit affordance. */}
        {!row && onEdit && (
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

        {(row || !onEdit) && trailing === 'chevron' && (
          <Icon name="chevron" className="chev" size={18} />
        )}
      </span>
    </div>
  );
}
