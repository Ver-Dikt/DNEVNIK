import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export function GlassCard({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`glass-card ${className}`} {...props} />;
}

export function GlassPanel({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`glass-panel ${className}`} {...props} />;
}

export function GlassButton({ className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`glass-button focus-ring ${className}`} {...props}>
      {children}
    </button>
  );
}

export function GlassInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`glass-input focus-ring ${className}`} {...props} />;
}

export function GlassTextarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`glass-input focus-ring ${className}`} {...props} />;
}

export function GlassBadge({ className = "", children, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`glass-badge ${className}`} {...props}>
      {children}
    </span>
  );
}

export function GlassSegmentedControl({
  options,
  value,
  onChange
}: {
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="glass-segmented">
      {options.map((option) => (
        <button className={option.value === value ? "active" : ""} key={option.value} onClick={() => onChange(option.value)} type="button">
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function GlassSheet({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass-sheet ${className}`}>{children}</div>;
}
