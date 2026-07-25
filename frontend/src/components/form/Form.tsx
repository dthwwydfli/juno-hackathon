import type { InputHTMLAttributes, ReactNode } from 'react';
import './form.css';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function TextField({ label, hint, ...rest }: { label?: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const input = <input className="text-input" {...rest} />;
  if (!label) return input;
  return <Field label={label} hint={hint}>{input}</Field>;
}

/** Single- or multi-select chip group (used for gender, category, etc.). */
export function ChipGroup<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="chip-group" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`chip${value === o.value ? ' on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Boxed select styled to match the dose/route boxes. */
export function SelectField({ label, options, value, onChange }: {
  label?: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const select = (
    <div className="select-box">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
  if (!label) return select;
  return <Field label={label}>{select}</Field>;
}
