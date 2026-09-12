import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Surface({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`surface ${className}`} {...props} />;
}

export function Button({ className = "", variant = "plain", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "plain" | "primary" | "danger" }) {
  const tone = variant === "primary" ? "button-primary" : variant === "danger" ? "button-danger" : "button-plain";
  return <button className={`button ${tone} ${className}`} {...props} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="px-1 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`input min-h-28 resize-y py-3 ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`input select-control ${className}`} {...props} />;
}

export function Segmented<T extends string>({
  className = "",
  options,
  value,
  onChange
}: {
  className?: string;
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className={`segmented ${className}`} role="group">
      {options.map((option) => (
        <button aria-pressed={option.value === value} className={option.value === value ? "active" : ""} key={option.value} onClick={() => onChange(option.value)} type="button">
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Badge({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={`badge ${className}`} {...props} />;
}
