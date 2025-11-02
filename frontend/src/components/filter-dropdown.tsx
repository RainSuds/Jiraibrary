'use client';

import { useEffect, useMemo, useRef, useState } from "react";

export type FilterDropdownOption = {
  value: string;
  label: string;
  description?: string | null;
  badge?: string | number | null;
  group?: string | null;
  swatch?: string | null;
};

type FilterDropdownProps = {
  id: string;
  placeholder: string;
  options: FilterDropdownOption[];
  selectedValues: string[];
  onToggle(value: string): void;
  onRemove(value: string): void;
  emptyMessage?: string;
};

export default function FilterDropdown({
  id,
  placeholder,
  options,
  selectedValues,
  onToggle,
  onRemove,
  emptyMessage = "No matches",
}: FilterDropdownProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Map values to option metadata for quick lookup
  const optionMap = useMemo(() => {
    const map = new Map<string, FilterDropdownOption>();
    for (const option of options) {
      map.set(option.value, option);
    }
    return map;
  }, [options]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredOptions = useMemo(() => {
    if (!normalizedSearch) {
      return options;
    }
    return options.filter((option) => {
      const label = option.label.toLowerCase();
      if (label.includes(normalizedSearch)) {
        return true;
      }
      const description = option.description?.toLowerCase();
      if (description && description.includes(normalizedSearch)) {
        return true;
      }
      const group = option.group?.toLowerCase();
      return Boolean(group && group.includes(normalizedSearch));
    });
  }, [options, normalizedSearch]);

  const groupedOptions = useMemo(() => {
    const groups = new Map<string, FilterDropdownOption[]>();
    for (const option of filteredOptions) {
      const key = option.group ?? "__ungrouped__";
      const group = groups.get(key) ?? [];
      group.push(option);
      groups.set(key, group);
    }
    return Array.from(groups.entries());
  }, [filteredOptions]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Reset search when closing
  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const handleToggle = (value: string) => {
    onToggle(value);
    setSearch("");
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleRemoveChip = (value: string) => {
    onRemove(value);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const firstOption = filteredOptions[0];
      if (firstOption) {
        handleToggle(firstOption.value);
      }
    }
    if (event.key === "Backspace" && search === "" && selectedValues.length > 0) {
      const lastValue = selectedValues[selectedValues.length - 1];
      handleRemoveChip(lastValue);
    }
  };

  const handleChipKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, value: string) => {
    if (event.key === "Enter" || event.key === " " || event.key === "Backspace") {
      event.preventDefault();
      handleRemoveChip(value);
    }
  };

  const renderBadge = (badge?: string | number | null) => {
    if (badge === undefined || badge === null || badge === "") {
      return null;
    }
    const text = typeof badge === "number" ? badge.toLocaleString() : badge;
    return (
      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-rose-500">
        {text}
      </span>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className="flex w-full min-h-[2.5rem] items-center gap-2 rounded-2xl border border-rose-200 bg-white px-3 py-2 shadow-sm focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-100"
        onClick={() => {
          setOpen(true);
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }}
      >
        <div className="flex w-full flex-1 flex-wrap items-center gap-2">
          {selectedValues.map((value) => {
            const option = optionMap.get(value);
            const label = option?.label ?? value;
            return (
              <button
                key={value}
                type="button"
                className="group inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-200"
                onClick={(event) => {
                  event.stopPropagation();
                  handleRemoveChip(value);
                }}
                onKeyDown={(event) => handleChipKeyDown(event, value)}
              >
                {option?.swatch ? (
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 rounded-full border border-white/60 shadow"
                    style={{
                      backgroundColor: option.swatch,
                    }}
                  />
                ) : null}
                <span>{label}</span>
                <span aria-hidden="true" className="text-sm text-rose-400 transition group-hover:text-rose-600">
                  ×
                </span>
              </button>
            );
          })}
          <input
            ref={inputRef}
            id={id}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={selectedValues.length === 0 ? placeholder : "Type to refine"}
            className="flex-1 border-none bg-transparent text-sm text-rose-700 placeholder:text-rose-300 focus:outline-none"
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          aria-label={open ? "Collapse options" : "Expand options"}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 text-sm text-rose-500 transition hover:border-rose-300 hover:text-rose-700"
          onClick={(event) => {
            event.stopPropagation();
            setOpen((prev) => !prev);
            if (!open && inputRef.current) {
              inputRef.current.focus();
            }
          }}
        >
          {open ? "−" : "+"}
        </button>
      </div>

      {open ? (
        <div className="absolute z-20 mt-2 max-h-72 w-full min-w-full overflow-y-auto rounded-2xl border border-rose-100 bg-white shadow-lg">
          {filteredOptions.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-rose-400">{emptyMessage}</div>
          ) : (
            groupedOptions.map(([groupName, grouped]) => (
              <div key={groupName} className="border-b border-rose-50 last:border-none">
                {groupName !== "__ungrouped__" ? (
                  <div className="px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-wide text-rose-400">
                    {groupName}
                  </div>
                ) : null}
                <ul className="py-1">
                  {grouped.map((option) => {
                    const isSelected = selectedValues.includes(option.value);
                    return (
                      <li key={option.value}>
                        <button
                          type="button"
                          onClick={() => handleToggle(option.value)}
                          className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition hover:bg-rose-50 ${
                            isSelected ? "text-rose-700" : "text-rose-600"
                          }`}
                        >
                          <span className="flex flex-col">
                            <span className="flex items-center gap-2 font-medium">
                              {option.swatch ? (
                                <span
                                  aria-hidden="true"
                                  className="inline-block h-4 w-4 rounded-full border border-rose-100 shadow-sm"
                                  style={{
                                    backgroundColor: option.swatch,
                                  }}
                                />
                              ) : null}
                              <span>{option.label}</span>
                            </span>
                            {option.description ? (
                              <span className="text-xs text-rose-400">{option.description}</span>
                            ) : null}
                          </span>
                          <span className="flex items-center gap-2">
                            {renderBadge(option.badge)}
                            {isSelected ? (
                              <span aria-hidden="true" className="text-base text-rose-500">
                                ✓
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
