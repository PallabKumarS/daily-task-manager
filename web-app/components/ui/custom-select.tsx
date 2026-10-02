"use client";

import * as React from "react";
import { ChevronDown, Check, Plus, Search, X, Pencil } from "lucide-react";

export interface SelectOption {
  label: string;
  value: string;
  badge?: string;
  color?: string;
  isCustom?: boolean;
}

interface CustomSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  onCreateNew?: (name: string) => Promise<void> | void;
  onEditClick?: () => void;
  createPlaceholder?: string;
  error?: string;
}

export function CustomSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  onCreateNew,
  createPlaceholder = "Create new option...",
  error,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);
  const [newOptionName, setNewOptionName] = React.useState("");
  const [creatingLoading, setCreatingLoading] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setSearch("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, search]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearch("");
  };

  const handleCreateSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newOptionName.trim();
    if (!trimmed || !onCreateNew) return;

    setCreatingLoading(true);
    try {
      await onCreateNew(trimmed);
      onChange(trimmed);
      setNewOptionName("");
      setIsCreating(false);
      setIsOpen(false);
      setSearch("");
    } finally {
      setCreatingLoading(false);
    }
  };

  return (
    <div className="space-y-1.5 w-full" ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-300">{label}</label>
          {onEditClick && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditClick();
              }}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition cursor-pointer"
              title="Manage and edit categories"
            >
              <Pencil className="w-3 h-3" />
              <span>Edit</span>
            </button>
          )}
        </div>
      )}

      <div className="relative">
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex h-11 w-full items-center justify-between rounded-xl border bg-slate-900/90 px-3.5 py-2 text-sm text-slate-100 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
            isOpen ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-slate-700/80 hover:border-slate-600"
          } ${error ? "border-red-500" : ""}`}
        >
          <span className="flex items-center gap-2 truncate">
            {selectedOption ? (
              <>
                {selectedOption.color && (
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: selectedOption.color }}
                  />
                )}
                <span className="font-medium text-slate-100">{selectedOption.label}</span>
                {selectedOption.badge && (
                  <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                    {selectedOption.badge}
                  </span>
                )}
              </>
            ) : (
              <span className="text-slate-500">{placeholder}</span>
            )}
          </span>

          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform duration-200 shrink-0 ${
              isOpen ? "rotate-180 text-emerald-400" : ""
            }`}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute left-0 top-full z-50 mt-1.5 w-full rounded-2xl border border-slate-700/90 bg-slate-900/98 p-1.5 shadow-2xl shadow-black/80 backdrop-blur-2xl transition-all animate-in fade-in zoom-in-95 duration-100">
            {/* Search filter for longer lists */}
            {options.length > 5 && !isCreating && (
              <div className="mb-1.5 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-1.5">
                <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter options..."
                  className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  autoFocus
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="text-slate-500 hover:text-slate-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            {/* Options List */}
            <div className="max-h-52 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
              {filteredOptions.length === 0 && !isCreating ? (
                <div className="px-3 py-3 text-center text-xs text-slate-400">
                  No matching options found
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition cursor-pointer ${
                        isSelected
                          ? "bg-emerald-500/15 text-emerald-400 font-semibold"
                          : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        {opt.color ? (
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: opt.color }}
                          />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-600 shrink-0" />
                        )}
                        <span className="truncate">{opt.label}</span>
                        {opt.isCustom && (
                          <span className="rounded bg-emerald-950/80 border border-emerald-500/30 px-1 py-0.2 text-[9px] text-emerald-400">
                            Custom
                          </span>
                        )}
                      </span>

                      {isSelected && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>

            {/* Custom Create Option Footer */}
            {onCreateNew && (
              <div className="mt-1 pt-1 border-t border-slate-800/80">
                {!isCreating ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(true);
                      setNewOptionName(search);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 transition cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create new option...</span>
                  </button>
                ) : (
                  <div className="p-1 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newOptionName}
                        onChange={(e) => setNewOptionName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleCreateSubmit();
                          } else if (e.key === "Escape") {
                            setIsCreating(false);
                          }
                        }}
                        placeholder={createPlaceholder}
                        className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                        autoFocus
                      />
                    </div>
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsCreating(false)}
                        className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCreateSubmit()}
                        disabled={creatingLoading || !newOptionName.trim()}
                        className="rounded-lg bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400 transition cursor-pointer disabled:opacity-50"
                      >
                        {creatingLoading ? "Saving..." : "Add & Select"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
