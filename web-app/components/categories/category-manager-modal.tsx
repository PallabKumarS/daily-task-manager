"use client";

import * as React from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Check, X, Tag } from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/currency-symbols";

interface CustomCategoryItem {
  id: string;
  name: string;
  group: string;
  color?: string | null;
}

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultGroup?: "EXPENSE" | "INCOME" | "PAYMENT_METHOD";
  onUpdated?: () => void;
}

const PRESET_COLORS = [
  "#10b981", // emerald
  "#38bdf8", // sky
  "#818cf8", // indigo
  "#a855f7", // purple
  "#f43f5e", // rose
  "#f59e0b", // amber
  "#14b8a6", // teal
];

export function CategoryManagerModal({
  isOpen,
  onClose,
  defaultGroup = "EXPENSE",
  onUpdated,
}: CategoryManagerModalProps) {
  const [activeGroup, setActiveGroup] = React.useState<"EXPENSE" | "INCOME" | "PAYMENT_METHOD">(
    defaultGroup
  );
  const [categories, setCategories] = React.useState<CustomCategoryItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  // New category input state
  const [newCatName, setNewCatName] = React.useState("");
  const [newCatColor, setNewCatColor] = React.useState(PRESET_COLORS[0]);
  const [isAdding, setIsAdding] = React.useState(false);

  // Editing state
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editColor, setEditColor] = React.useState("");
  const [savingEdit, setSavingEdit] = React.useState(false);

  React.useEffect(() => {
    setActiveGroup(defaultGroup);
  }, [defaultGroup]);

  const fetchCategories = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<CustomCategoryItem[]>("/categories");
      if (res.success && Array.isArray(res.data)) {
        setCategories(res.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      fetchCategories();
      setIsAdding(false);
      setEditingId(null);
    }
  }, [isOpen, fetchCategories]);

  const handleAddSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;

    try {
      const res = await api.post<CustomCategoryItem>("/categories", {
        name: trimmed,
        group: activeGroup,
        color: newCatColor,
      });

      if (res.success && res.data) {
        setCategories((prev) => [...prev, res.data]);
        setNewCatName("");
        setIsAdding(false);
        toast.success(`Category "${trimmed}" created`);
        window.dispatchEvent(new CustomEvent("daypulse:categories-updated"));
        if (onUpdated) onUpdated();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create category");
    }
  };

  const handleStartEdit = (cat: CustomCategoryItem) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color || PRESET_COLORS[0]);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const handleSaveEdit = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;

    setSavingEdit(true);
    try {
      const res = await api.patch<CustomCategoryItem>(`/categories/${id}`, {
        name: trimmed,
        color: editColor,
      });

      if (res.success && res.data) {
        setCategories((prev) => prev.map((c) => (c.id === id ? res.data : c)));
        setEditingId(null);
        toast.success(`Category updated to "${trimmed}"`);
        window.dispatchEvent(new CustomEvent("daypulse:categories-updated"));
        if (onUpdated) onUpdated();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update category");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (cat: CustomCategoryItem) => {
    if (!confirm(`Delete category "${cat.name}"?`)) return;

    try {
      const res = await api.delete(`/categories/${cat.id}`);
      if (res.success) {
        setCategories((prev) => prev.filter((c) => c.id !== cat.id));
        toast.success(`Category "${cat.name}" deleted`);
        window.dispatchEvent(new CustomEvent("daypulse:categories-updated"));
        if (onUpdated) onUpdated();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete category");
    }
  };

  // Group default list
  const defaultList = React.useMemo(() => {
    if (activeGroup === "EXPENSE") return EXPENSE_CATEGORIES;
    if (activeGroup === "INCOME") return INCOME_CATEGORIES;
    return ["Cash", "Debit / Credit Card", "Bank Transfer", "Mobile Banking", "Crypto", "Other"];
  }, [activeGroup]);

  const customList = React.useMemo(() => {
    return categories.filter((c) => c.group === activeGroup);
  }, [categories, activeGroup]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Categories & Methods"
      description="Customize and edit your category library across all pages"
    >
      <div className="space-y-4">
        {/* Compact Type Selector Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setActiveGroup("EXPENSE");
              setEditingId(null);
            }}
            className={`py-1.5 rounded-lg transition cursor-pointer ${
              activeGroup === "EXPENSE"
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Expenses
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveGroup("INCOME");
              setEditingId(null);
            }}
            className={`py-1.5 rounded-lg transition cursor-pointer ${
              activeGroup === "INCOME"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Income
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveGroup("PAYMENT_METHOD");
              setEditingId(null);
            }}
            className={`py-1.5 rounded-lg transition cursor-pointer ${
              activeGroup === "PAYMENT_METHOD"
                ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Methods
          </button>
        </div>

        {/* Custom Categories List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Custom {activeGroup === "PAYMENT_METHOD" ? "Methods" : "Categories"} ({customList.length})
            </span>
            {!isAdding && (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New</span>
              </button>
            )}
          </div>

          {/* Inline Add Box */}
          {isAdding && (
            <div className="p-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/20 space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder={`New ${activeGroup.toLowerCase()} name...`}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddSubmit();
                    if (e.key === "Escape") setIsAdding(false);
                  }}
                />
              </div>

              {/* Color dots picker */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">Tag:</span>
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewCatColor(c)}
                      className={`h-4 w-4 rounded-full transition-transform cursor-pointer ${
                        newCatColor === c ? "scale-125 ring-2 ring-white/60" : "opacity-70 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <Button size="sm" variant="emerald" onClick={() => handleAddSubmit()} className="h-7 text-xs px-2.5">
                    Save
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Custom Items */}
          <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
            {customList.length === 0 && !isAdding ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-3 text-center text-xs text-slate-500">
                No custom {activeGroup.toLowerCase()} created yet. Click "+ Add New" to create one.
              </div>
            ) : (
              customList.map((cat) => {
                const isEditing = editingId === cat.id;

                if (isEditing) {
                  return (
                    <div
                      key={cat.id}
                      className="p-2 rounded-xl border border-emerald-500/50 bg-slate-900 space-y-2"
                    >
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit(cat.id);
                          if (e.key === "Escape") handleCancelEdit();
                        }}
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setEditColor(c)}
                              className={`h-3.5 w-3.5 rounded-full transition-transform cursor-pointer ${
                                editColor === c ? "scale-125 ring-2 ring-white/60" : "opacity-60"
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="p-1 text-slate-400 hover:text-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(cat.id)}
                            disabled={savingEdit || !editName.trim()}
                            className="p-1 text-emerald-400 hover:text-emerald-300"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-2 rounded-xl border border-slate-800 bg-slate-900/70 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color || "#10b981" }}
                      />
                      <span className="text-xs font-medium text-slate-200 truncate">{cat.name}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(cat)}
                        className="p-1 text-slate-400 hover:text-emerald-400 rounded-md hover:bg-slate-800 transition cursor-pointer"
                        title="Edit name and tag"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cat)}
                        className="p-1 text-slate-400 hover:text-red-400 rounded-md hover:bg-red-500/10 transition cursor-pointer"
                        title="Delete category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* System Defaults (Read-only list for convenience) */}
        <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
            Standard Default Library (Pre-installed)
          </span>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 scrollbar-thin">
            {defaultList.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-400"
              >
                <Tag className="w-2.5 h-2.5 opacity-60" />
                <span>{item}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
