import { Modal, GpNote } from '../../components/Frame';
import { Icon, iconForRoute } from '../../components/Icon';
import type { Medication } from '../../data/types';

/** Shown after save when interaction check found no hits involving this medicine. */
export function AddClearCheck({
  med,
  cabinetCount,
  isEdit,
  onConfirm,
  onClose,
}: {
  med: Medication;
  cabinetCount: number;
  isEdit?: boolean;
  onConfirm: () => void;
  onClose?: () => void;
}) {
  const title = isEdit ? 'No new interactions' : 'No potential interactions found';
  const sub = isEdit
    ? `We didn’t spot any interactions involving ${med.name} after your changes (checked across your ${cabinetCount} medications).`
    : `We didn’t spot any interactions between ${med.name} and your other ${cabinetCount - 1} medication${cabinetCount - 1 === 1 ? '' : 's'}.`;

  return (
    <Modal onClose={onClose}>
      <div className="add-clear-modal">
        <div className="add-clear-halo">
          <Icon name="check" size={44} strokeWidth={2} />
        </div>
        <h2 className="add-clear-title">{title}</h2>
        <p className="add-clear-sub">{sub}</p>

        <div className="add-clear-pill">
          <span className="add-clear-ic">
            <Icon name={iconForRoute(med.route)} size={18} />
          </span>
          <span className="add-clear-ptext">
            <span className="add-clear-pn">{med.name}</span>
            <span className="add-clear-pt">{med.brand ? `${med.brand} · ` : ''}{med.category}</span>
          </span>
        </div>

        <div className="add-clear-actions">
          <button type="button" className="btn primary" onClick={onConfirm}>
            {isEdit ? 'Save to my list' : 'Add to my list'}
            <Icon name="chevron" size={18} strokeWidth={2} />
          </button>
          <button type="button" className="btn add-clear-ghost" onClick={onClose}>
            Back to edit
          </button>
        </div>

        <GpNote>Information only. Not medical advice. Always discuss medicines with your GP.</GpNote>
      </div>
    </Modal>
  );
}
