'use client';

import { useEffect, useMemo, useRef, useState } from "react";

export type HierarchicalChildOption = {
  value: string;
  label: string;
  description?: string | null;
  badge?: string | number | null;
};

export type HierarchicalParentOption = {
  value: string;
  label: string;
  description?: string | null;
  badge?: string | number | null;
  children: HierarchicalChildOption[];
};

type HierarchicalDropdownProps = {
  id: string;
  placeholder: string;
  parents: HierarchicalParentOption[];
  selectedParents: string[];
  selectedChildren: string[];
  onToggleParent(value: string): void;
  onToggleChild(value: string): void;
  onRemoveParent(value: string): void;
  onRemoveChild(value: string): void;
  emptyMessage?: string;
  parentLabel?: string;
  childLabel?: string;
};

export default function FilterHierarchicalDropdown({
  id,
  placeholder,
  parents,
  selectedParents,
  selectedChildren,
  onToggleParent,
  onToggleChild,
  onRemoveParent,
  onRemoveChild,
  emptyMessage = "No matches",
  parentLabel = "Primary",
  childLabel = "Secondary",
}: HierarchicalDropdownProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedParents, setExpandedParents] = useState(() => {
    return new Set<string>(parents.map((parent) => parent.value));
  });

  const parentMap = useMemo(() => {
    const map = new Map<string, HierarchicalParentOption>();
    for (const parent of parents) {
      map.set(parent.value, parent);
    }
    return map;
  }, [parents]);

  const childMap = useMemo(() => {
    const map = new Map<string, HierarchicalChildOption>();
    for (const parent of parents) {
      for (const child of parent.children) {
        map.set(child.value, child);
      }
    }
    return map;
  }, [parents]);

  const normalizedSearch = search.trim().toLowerCase();

  type FilteredParent = HierarchicalParentOption & {
    filteredChildren: HierarchicalChildOption[];
    matches: boolean;
  };

  const filteredParents: FilteredParent[] = useMemo(() => {
    const results: FilteredParent[] = [];
    for (const parent of parents) {
      const parentMatches = normalizedSearch
        ? parent.label.toLowerCase().includes(normalizedSearch) ||
          (parent.description?.toLowerCase().includes(normalizedSearch) ?? false)
        : true;

      const filteredChildren = normalizedSearch
        ? parent.children.filter((child) =>
            child.label.toLowerCase().includes(normalizedSearch) ||
            (child.description?.toLowerCase().includes(normalizedSearch) ?? false)
          )
        : parent.children;

      if (parentMatches || filteredChildren.length > 0) {
        results.push({
          ...parent,
          filteredChildren,
          matches: parentMatches,
        });
      }
    }
    return results;
  }, [parents, normalizedSearch]);

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

  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  useEffect(() => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      for (const parent of parents) {
        next.add(parent.value);
      }
      return next;
    });
  }, [parents]);

  const handleToggleParent = (value: string) => {
    onToggleParent(value);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleToggleChild = (value: string) => {
    onToggleChild(value);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleRemoveParent = (value: string) => {
    onRemoveParent(value);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleRemoveChild = (value: string) => {
    onRemoveChild(value);
    if (inputRef.current) {
      inputRef.current.focus();
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

  const handleInputKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const first = filteredParents[0];
      if (first) {
        handleToggleParent(first.value);
      }
    }
    if (event.key === "Backspace" && search === "") {
      if (selectedChildren.length > 0) {
        handleRemoveChild(selectedChildren[selectedChildren.length - 1]);
        return;
      }
      if (selectedParents.length > 0) {
        handleRemoveParent(selectedParents[selectedParents.length - 1]);
      }
    }
  };

  const handleChipKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    value: string,
    remover: (value: string) => void
  ) => {
    if (event.key === "Enter" || event.key === " " || event.key === "Backspace") {
      event.preventDefault();
      remover(value);
    }
  };

  const toggleExpanded = (value: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
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
          {selectedParents.map((value) => {
            const option = parentMap.get(value);
            const label = option?.label ?? value;
            return (
              <button
                key={`parent-${value}`}
                type="button"
                className="group inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-200"
                onClick={(event) => {
                  event.stopPropagation();
                  handleRemoveParent(value);
                }}
                onKeyDown={(event) => handleChipKeyDown(event, value, handleRemoveParent)}
              >
                <span>{label}</span>
                <span aria-hidden="true" className="text-sm text-rose-400 transition group-hover:text-rose-600">
                  ×
                </span>
              </button>
            );
          })}
          {selectedChildren.map((value) => {
            const option = childMap.get(value);
            const label = option?.label ?? value;
            return (
              <button
                key={`child-${value}`}
                type="button"
                className="group inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-500 hover:bg-rose-200"
                onClick={(event) => {
                  event.stopPropagation();
                  handleRemoveChild(value);
                }}
                onKeyDown={(event) => handleChipKeyDown(event, value, handleRemoveChild)}
              >
                <span>{label}</span>
                <span aria-hidden="true" className="text-sm text-rose-300 transition group-hover:text-rose-600">
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
            onKeyDown={handleInputKeyDown}
            placeholder={selectedParents.length === 0 && selectedChildren.length === 0 ? placeholder : "Type to refine"}
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
        <div className="absolute z-20 mt-2 max-h-80 w-full min-w-full overflow-y-auto rounded-2xl border border-rose-100 bg-white shadow-lg">
          {filteredParents.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-rose-400">{emptyMessage}</div>
          ) : (
            <div className="flex flex-col divide-y divide-rose-50">
              <div className="flex items-center justify-between px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-wide text-rose-400">
                <span>{parentLabel}</span>
                <span>{childLabel}</span>
              </div>
              {filteredParents.map((parent) => {
                const isParentSelected = selectedParents.includes(parent.value);
                const isExpanded = expandedParents.has(parent.value) || normalizedSearch.length > 0;
                return (
                  <div key={parent.value} className="flex flex-col">
                    <div className="flex items-stretch justify-between gap-1 px-4 py-3">
                      <button
                        type="button"
                        className={`flex flex-1 items-center justify-between gap-3 rounded-xl px-2 py-2 text-left text-sm transition hover:bg-rose-50 ${
                          isParentSelected ? "text-rose-700" : "text-rose-600"
                        }`}
                        onClick={() => handleToggleParent(parent.value)}
                      >
                        <span className="flex flex-1 flex-col">
                          <span className="font-medium">{parent.label}</span>
                          {parent.description ? (
                            <span className="text-xs text-rose-400">{parent.description}</span>
                          ) : null}
                        </span>
                        <span className="flex items-center gap-2">
                          {renderBadge(parent.badge)}
                          {isParentSelected ? (
                            <span aria-hidden="true" className="text-base text-rose-500">
                              ✓
                            </span>
                          ) : null}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 text-xs text-rose-500 transition hover:border-rose-300 hover:text-rose-700"
                        onClick={() => toggleExpanded(parent.value)}
                        aria-label={isExpanded ? "Collapse children" : "Expand children"}
                      >
                        {isExpanded ? "−" : "+"}
                      </button>
                    </div>
                    {isExpanded && parent.filteredChildren.length > 0 ? (
                      <ul className="bg-rose-50/40 py-1">
                        {parent.filteredChildren.map((child) => {
                          const isChildSelected = selectedChildren.includes(child.value);
                          return (
                            <li key={child.value}>
                              <button
                                type="button"
                                className={`flex w-full items-center justify-between gap-3 px-6 py-2 text-left text-sm transition hover:bg-rose-50 ${
                                  isChildSelected ? "text-rose-700" : "text-rose-500"
                                }`}
                                onClick={() => handleToggleChild(child.value)}
                              >
                                <span className="flex flex-col">
                                  <span className="font-medium">{child.label}</span>
                                  {child.description ? (
                                    <span className="text-xs text-rose-400">{child.description}</span>
                                  ) : null}
                                </span>
                                <span className="flex items-center gap-2">
                                  {renderBadge(child.badge)}
                                  {isChildSelected ? (
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
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
