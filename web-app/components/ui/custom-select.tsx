"use client";

import { Check, ChevronDown, Pencil, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api-client";

export interface SelectOption {
	label: string;
	value: string;
	badge?: string;
	color?: string;
	isCustom?: boolean;
	id?: string;
}

export interface CustomSelectProps {
	label?: string;
	value: string;
	onChange: (value: string) => void;
	options: SelectOption[];
	placeholder?: string;
	group?: string;
	onCreateNew?: (name: string, color?: string) => Promise<void> | void;
	onEditOption?: (value: string, newLabel: string, newColor?: string) => Promise<void> | void;
	onDeleteOption?: (value: string) => Promise<void> | void;
	onEditClick?: () => void;
	createPlaceholder?: string;
	allowManage?: boolean;
	error?: string;
}

const PALETTE = [
	"#10b981", // Emerald
	"#0ea5e9", // Sky
	"#8b5cf6", // Purple
	"#f59e0b", // Amber
	"#f43f5e", // Rose
	"#14b8a6", // Teal
];

export function CustomSelect({
	label,
	value,
	onChange,
	options: initialOptions,
	placeholder = "Select an option...",
	group,
	onCreateNew,
	onEditOption,
	onDeleteOption,
	onEditClick,
	createPlaceholder = "Create new option...",
	allowManage = true,
	error,
}: CustomSelectProps) {
	const confirm = useConfirm();
	const [isOpen, setIsOpen] = React.useState(false);
	const [search, setSearch] = React.useState("");
	const [isCreating, setIsCreating] = React.useState(false);
	const [newOptionName, setNewOptionName] = React.useState("");
	const [newOptionColor, setNewOptionColor] = React.useState(PALETTE[0]);
	const [creatingLoading, setCreatingLoading] = React.useState(false);

	const [editingValue, setEditingValue] = React.useState<string | null>(null);
	const [editingLabel, setEditingLabel] = React.useState("");
	const [editingColor, setEditingColor] = React.useState<string | undefined>(undefined);
	const [editingLoading, setEditingLoading] = React.useState(false);

	const [activeOptions, setActiveOptions] = React.useState<SelectOption[]>(initialOptions);
	const containerRef = React.useRef<HTMLDivElement>(null);

	const storagePrefix = `daypulse_opts_${group || label || placeholder}`;

	// Synchronize options with group / backend and localStorage
	const refreshOptions = React.useCallback(async () => {
		let merged = [...initialOptions];

		// Load local modifications (deletions and edits)
		let deletedValues: string[] = [];
		let editOverrides: Record<string, { label: string; color?: string }> = {};
		let customSaved: SelectOption[] = [];

		if (typeof window !== "undefined") {
			try {
				const delRaw = localStorage.getItem(`${storagePrefix}_deleted`);
				if (delRaw) deletedValues = JSON.parse(delRaw);

				const editRaw = localStorage.getItem(`${storagePrefix}_edits`);
				if (editRaw) editOverrides = JSON.parse(editRaw);

				const customRaw = localStorage.getItem(`${storagePrefix}_custom`);
				if (customRaw) customSaved = JSON.parse(customRaw);
			} catch {
				// ignore parse error
			}
		}

		// Merge backend categories if group is supplied
		if (group) {
			try {
				const res = await api.get<Array<{ id: string; name: string; color?: string }>>(
					`/categories?group=${encodeURIComponent(group)}`,
				);
				if (res.success && Array.isArray(res.data)) {
					const backendOpts: SelectOption[] = res.data.map((cat) => ({
						id: cat.id,
						label: cat.name,
						value: cat.name,
						color: cat.color || undefined,
						isCustom: true,
					}));

					// Merge backend options, avoiding duplicates
					for (const bo of backendOpts) {
						if (!merged.some((m) => m.value.toLowerCase() === bo.value.toLowerCase())) {
							merged.push(bo);
						}
					}
				}
			} catch {
				// ignore network error
			}
		}

		// Merge custom saved options from localStorage
		for (const co of customSaved) {
			if (!merged.some((m) => m.value.toLowerCase() === co.value.toLowerCase())) {
				merged.push(co);
			}
		}

		// Apply label/color edit overrides
		merged = merged.map((opt) => {
			if (editOverrides[opt.value]) {
				return {
					...opt,
					label: editOverrides[opt.value].label,
					color: editOverrides[opt.value].color ?? opt.color,
				};
			}
			return opt;
		});

		// Filter out deleted options
		merged = merged.filter((opt) => !deletedValues.includes(opt.value));

		setActiveOptions(merged);
	}, [initialOptions, group, storagePrefix]);

	React.useEffect(() => {
		refreshOptions();
	}, [refreshOptions]);

	// Close on outside click
	React.useEffect(() => {
		const handleOutsideClick = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setIsOpen(false);
				setIsCreating(false);
				setEditingValue(null);
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

	const selectedOption = activeOptions.find((opt) => opt.value === value);

	const filteredOptions = React.useMemo(() => {
		if (!search.trim()) return activeOptions;
		const q = search.toLowerCase();
		return activeOptions.filter((opt) => opt.label.toLowerCase().includes(q));
	}, [activeOptions, search]);

	const handleSelect = (val: string) => {
		onChange(val);
		setIsOpen(false);
		setSearch("");
	};

	const handleCreateSubmit = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		const trimmed = newOptionName.trim();
		if (!trimmed) return;

		setCreatingLoading(true);
		try {
			if (onCreateNew) {
				await onCreateNew(trimmed, newOptionColor);
			} else if (group) {
				await api.post("/categories", {
					group,
					name: trimmed,
					color: newOptionColor,
				});
			}

			// Persist in localStorage
			if (typeof window !== "undefined") {
				try {
					const customRaw = localStorage.getItem(`${storagePrefix}_custom`);
					const customList: SelectOption[] = customRaw ? JSON.parse(customRaw) : [];
					if (!customList.some((c) => c.value === trimmed)) {
						customList.push({
							label: trimmed,
							value: trimmed,
							color: newOptionColor,
							isCustom: true,
						});
						localStorage.setItem(`${storagePrefix}_custom`, JSON.stringify(customList));
					}
				} catch {
					// ignore storage error
				}
			}

			await refreshOptions();
			onChange(trimmed);
			setNewOptionName("");
			setIsCreating(false);
			setIsOpen(false);
			setSearch("");
			toast.success(`Option "${trimmed}" created`);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to create option";
			toast.error(msg);
		} finally {
			setCreatingLoading(false);
		}
	};

	const handleStartEdit = (e: React.MouseEvent, opt: SelectOption) => {
		e.stopPropagation();
		setEditingValue(opt.value);
		setEditingLabel(opt.label);
		setEditingColor(opt.color || PALETTE[0]);
	};

	const handleSaveEdit = async (e: React.MouseEvent, opt: SelectOption) => {
		e.stopPropagation();
		const trimmed = editingLabel.trim();
		if (!trimmed) return;

		setEditingLoading(true);
		try {
			if (onEditOption) {
				await onEditOption(opt.value, trimmed, editingColor);
			} else if (opt.id) {
				await api.patch(`/categories/${opt.id}`, {
					name: trimmed,
					color: editingColor,
				});
			} else if (group) {
				await api.post("/categories/rename", {
					group,
					oldName: opt.value,
					newName: trimmed,
					color: editingColor,
				});
			}

			// Persist edit in localStorage
			if (typeof window !== "undefined") {
				try {
					const editRaw = localStorage.getItem(`${storagePrefix}_edits`);
					const editOverrides: Record<string, { label: string; color?: string }> = editRaw
						? JSON.parse(editRaw)
						: {};
					editOverrides[opt.value] = { label: trimmed, color: editingColor };
					localStorage.setItem(`${storagePrefix}_edits`, JSON.stringify(editOverrides));
				} catch {
					// ignore
				}
			}

			await refreshOptions();
			setEditingValue(null);
			toast.success(`Option updated to "${trimmed}"`);
			if (typeof window !== "undefined") {
				window.dispatchEvent(new CustomEvent("daypulse:categories-updated"));
				window.dispatchEvent(new CustomEvent("daypulse:refresh"));
			}
		} catch {
			toast.error("Failed to update option");
		} finally {
			setEditingLoading(false);
		}
	};

	const handleDelete = async (e: React.MouseEvent, opt: SelectOption) => {
		e.stopPropagation();
		const ok = await confirm({
			title: "Delete Option",
			description: `Are you sure you want to delete "${opt.label}"? This action cannot be undone.`,
			confirmText: "Delete",
			variant: "destructive",
		});
		if (!ok) return;

		try {
			if (onDeleteOption) {
				await onDeleteOption(opt.value);
			} else if (opt.id) {
				await api.delete(`/categories/${opt.id}`);
			}

			// Record deletion in localStorage
			if (typeof window !== "undefined") {
				try {
					const delRaw = localStorage.getItem(`${storagePrefix}_deleted`);
					const deletedValues: string[] = delRaw ? JSON.parse(delRaw) : [];
					if (!deletedValues.includes(opt.value)) {
						deletedValues.push(opt.value);
						localStorage.setItem(`${storagePrefix}_deleted`, JSON.stringify(deletedValues));
					}
				} catch {
					// ignore
				}
			}

			// If current value is deleted, select first remaining
			if (value === opt.value) {
				const remaining = activeOptions.filter((o) => o.value !== opt.value);
				if (remaining.length > 0) {
					onChange(remaining[0].value);
				} else {
					onChange("");
				}
			}

			await refreshOptions();
			toast.success(`Option "${opt.label}" removed`);
		} catch {
			toast.error("Failed to delete option");
		}
	};

	const handleResetDefaults = () => {
		if (typeof window !== "undefined") {
			localStorage.removeItem(`${storagePrefix}_deleted`);
			localStorage.removeItem(`${storagePrefix}_edits`);
		}
		refreshOptions();
		toast.success("Default options restored");
	};

	const hasModifications =
		typeof window !== "undefined" &&
		(Boolean(localStorage.getItem(`${storagePrefix}_deleted`)) ||
			Boolean(localStorage.getItem(`${storagePrefix}_edits`)));

	return (
		<div className="space-y-1.5 w-full" ref={containerRef}>
			{label && (
				<div className="flex items-center justify-between">
					<span className="text-xs font-semibold text-slate-300">{label}</span>
					{onEditClick && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onEditClick();
							}}
							className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition cursor-pointer"
							title="Manage categories"
						>
							<Pencil className="w-3 h-3" />
							<span>Manage</span>
						</button>
					)}
				</div>
			)}

			<div className="relative">
				{/* Trigger Button with inset ring to prevent boundary clipping */}
				<button
					type="button"
					onClick={() => setIsOpen((prev) => !prev)}
					className={`flex h-11 w-full items-center justify-between rounded-xl border bg-slate-900/90 px-3.5 py-2 text-sm text-slate-100 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500/40 focus:border-emerald-500 ${
						isOpen
							? "border-emerald-500 ring-2 ring-inset ring-emerald-500/30"
							: "border-slate-700/80 hover:border-slate-600"
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
					<div className="absolute left-0 top-full z-50 mt-1.5 w-full rounded-2xl border border-slate-700/90 bg-slate-900 p-1.5 shadow-2xl shadow-black/80 transition-all animate-in fade-in zoom-in-95 duration-100">
						{/* Search filter */}
						{activeOptions.length > 5 && !isCreating && !editingValue && (
							<div className="mb-1.5 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-1.5">
								<Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
								<input
									type="text"
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									placeholder="Filter options..."
									className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
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
						<div className="max-h-56 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
							{filteredOptions.length === 0 && !isCreating ? (
								<div className="px-3 py-3 text-center text-xs text-slate-400">
									No matching options found
								</div>
							) : (
								filteredOptions.map((opt) => {
									const isSelected = opt.value === value;
									const isEditingThis = editingValue === opt.value;

									if (isEditingThis) {
										return (
											<div
												key={opt.value}
												className="rounded-xl border border-emerald-500/40 bg-slate-950 p-2 space-y-2 animate-in fade-in"
											>
												<div className="flex items-center gap-1.5">
													<input
														type="text"
														value={editingLabel}
														onChange={(e) => setEditingLabel(e.target.value)}
														className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
														onKeyDown={(e) => {
															if (e.key === "Enter")
																handleSaveEdit(e as unknown as React.MouseEvent, opt);
															if (e.key === "Escape") setEditingValue(null);
														}}
													/>
													<button
														type="button"
														onClick={(e) => handleSaveEdit(e, opt)}
														disabled={editingLoading || !editingLabel.trim()}
														className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition cursor-pointer"
														title="Save"
													>
														<Check className="w-3.5 h-3.5" />
													</button>
													<button
														type="button"
														onClick={() => setEditingValue(null)}
														className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
														title="Cancel"
													>
														<X className="w-3.5 h-3.5" />
													</button>
												</div>

												{/* Color Selector */}
												<div className="flex items-center gap-1.5 pt-1">
													<span className="text-[10px] text-slate-400 mr-1">Color:</span>
													{PALETTE.map((c) => (
														<button
															key={c}
															type="button"
															onClick={() => setEditingColor(c)}
															className={`h-4 w-4 rounded-full transition-transform cursor-pointer ${
																editingColor === c
																	? "scale-125 ring-2 ring-white"
																	: "opacity-80 hover:opacity-100"
															}`}
															style={{ backgroundColor: c }}
														/>
													))}
												</div>
											</div>
										);
									}

									return (
										<div
											key={opt.value}
											className={`group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-medium transition ${
												isSelected
													? "bg-emerald-500/15 text-emerald-400 font-semibold"
													: "text-slate-300 hover:bg-slate-800/80 hover:text-white"
											}`}
										>
											<button
												type="button"
												onClick={() => handleSelect(opt.value)}
												className="flex-1 flex items-center gap-2 text-left truncate cursor-pointer py-0.5"
											>
												{opt.color ? (
													<span
														className="h-2 w-2 rounded-full shrink-0"
														style={{ backgroundColor: opt.color }}
													/>
												) : (
													<span className="h-1.5 w-1.5 rounded-full bg-slate-600 shrink-0" />
												)}
												<span className="truncate">{opt.label}</span>
												{opt.badge && (
													<span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">
														{opt.badge}
													</span>
												)}
											</button>

											<div className="flex items-center gap-1 shrink-0 ml-2">
												{isSelected && <Check className="h-3.5 w-3.5 text-emerald-400 mr-1" />}

												{allowManage && (
													<div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
														<button
															type="button"
															onClick={(e) => handleStartEdit(e, opt)}
															className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-slate-700/60 transition cursor-pointer"
															title="Edit / Rename"
														>
															<Pencil className="w-3 h-3" />
														</button>
														<button
															type="button"
															onClick={(e) => handleDelete(e, opt)}
															className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
															title="Delete"
														>
															<Trash2 className="w-3 h-3" />
														</button>
													</div>
												)}
											</div>
										</div>
									);
								})
							)}
						</div>

						{/* Custom Create Option Footer */}
						{allowManage && (
							<div className="mt-1 pt-1 border-t border-slate-800/80">
								{!isCreating ? (
									<div className="flex items-center justify-between px-1">
										<button
											type="button"
											onClick={() => {
												setIsCreating(true);
												setNewOptionName(search);
											}}
											className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 transition cursor-pointer"
										>
											<Plus className="h-3.5 w-3.5" />
											<span>{createPlaceholder}</span>
										</button>

										{hasModifications && (
											<button
												type="button"
												onClick={handleResetDefaults}
												className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition cursor-pointer px-1 py-0.5"
												title="Restore original defaults"
											>
												<RotateCcw className="w-2.5 h-2.5" />
												<span>Reset</span>
											</button>
										)}
									</div>
								) : (
									<div className="p-2 rounded-xl bg-slate-950 border border-slate-800 space-y-2 animate-in fade-in">
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
											className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
										/>

										{/* Color dot selector */}
										<div className="flex items-center gap-1.5">
											<span className="text-[10px] text-slate-400 mr-1">Color:</span>
											{PALETTE.map((c) => (
												<button
													key={c}
													type="button"
													onClick={() => setNewOptionColor(c)}
													className={`h-4 w-4 rounded-full transition-transform cursor-pointer ${
														newOptionColor === c
															? "scale-125 ring-2 ring-white"
															: "opacity-75 hover:opacity-100"
													}`}
													style={{ backgroundColor: c }}
												/>
											))}
										</div>

										<div className="flex justify-end gap-1.5 pt-1">
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
												className="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 transition cursor-pointer disabled:opacity-50"
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
