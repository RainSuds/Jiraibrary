import { useEffect, useMemo, useRef, useState } from "react";

type RoseDropdownSize = "sm" | "xs";

type RoseDropdownOption = {
  value: string;
  label: string;
};

type RoseDropdownProps = {
  id: string;
  value: string;
  options: RoseDropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  size?: RoseDropdownSize;
  className?: string;
};

const sizeClasses: Record<RoseDropdownSize, string> = {
  sm: "text-sm font-medium text-rose-700",
  xs: "text-xs font-semibold uppercase tracking-wide text-rose-600",
};

const triggerBase =
  "inline-flex items-center justify-between gap-2 rounded-full border border-rose-200 bg-white px-3 py-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400";

const menuBase =
  "absolute left-0 z-30 mt-2 min-w-full rounded-2xl border border-rose-100 bg-white/95 p-2 text-sm text-rose-700 shadow-lg";

export default function RoseDropdown({
  id,
  value,
  options,
  onChange,
  disabled,
  size = "sm",
  className,
}: RoseDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedLabel = useMemo(() => {
    const found = options.find((option) => option.value === value);
    return found?.label ?? value;
  }, [options, value]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`.trim()}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${triggerBase} ${sizeClasses[size]}${disabled ? " opacity-60" : ""}`}
      >
        <span className="truncate">{selectedLabel}</span>
        <span aria-hidden="true" className="text-rose-400">
          ▾
        </span>
      </button>
      {open ? (
        <div role="listbox" aria-labelledby={id} className={menuBase}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition hover:bg-rose-50 ${
                option.value === value ? "bg-rose-50 font-semibold text-rose-600" : "text-rose-600"
              }`}
            >
              <span className="truncate">{option.label}</span>
              {option.value === value ? <span aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
