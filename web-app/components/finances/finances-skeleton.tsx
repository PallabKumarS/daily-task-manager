export function FinancesSkeleton() {
	return (
		<div className="space-y-6 animate-pulse">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div className="space-y-2">
					<div className="h-8 w-64 rounded-lg bg-surface-2" />
					<div className="h-4 w-96 rounded-md bg-surface-2/60" />
				</div>
				<div className="flex items-center gap-2">
					<div className="h-9 w-28 rounded-lg bg-surface-2" />
					<div className="h-9 w-36 rounded-lg bg-surface-2" />
				</div>
			</div>

			<div className="flex items-center gap-2 border-b border-border pb-3">
				<div className="h-9 w-36 rounded-xl bg-surface-2" />
				<div className="h-9 w-36 rounded-xl bg-surface-2" />
			</div>

			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl border border-border bg-surface">
				<div className="flex items-center gap-2">
					<div className="h-8 w-20 rounded-lg bg-surface-2" />
					<div className="h-8 w-20 rounded-lg bg-surface-2" />
					<div className="h-8 w-20 rounded-lg bg-surface-2" />
				</div>
				<div className="flex items-center gap-2">
					<div className="h-8 w-8 rounded-lg bg-surface-2" />
					<div className="h-8 w-32 rounded-lg bg-surface-2" />
					<div className="h-8 w-8 rounded-lg bg-surface-2" />
				</div>
			</div>

			<div className="grid grid-cols-[repeat(auto-fill,minmax(min(175px,100%),1fr))] gap-2">
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="rounded-2xl border border-border bg-surface p-4 space-y-2">
						<div className="h-3 w-20 rounded bg-surface-2" />
						<div className="h-7 w-24 rounded bg-surface-2" />
					</div>
				))}
			</div>

			<div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
				<div className="flex items-center justify-between">
					<div className="h-5 w-40 rounded bg-surface-2" />
					<div className="h-5 w-24 rounded bg-surface-2" />
				</div>
				<div className="grid grid-cols-[repeat(auto-fill,minmax(min(175px,100%),1fr))] gap-2">
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<div
							key={i}
							className="rounded-xl border border-border bg-surface-2/40 p-3 space-y-2 h-24"
						>
							<div className="h-4 w-20 rounded bg-surface-2" />
							<div className="h-3 w-32 rounded bg-surface-2/60" />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
