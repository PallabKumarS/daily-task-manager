export function TrackersSkeleton() {
	return (
		<div className="space-y-6 animate-pulse">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div className="space-y-2">
					<div className="h-8 w-64 rounded-lg bg-surface-2" />
					<div className="h-4 w-96 rounded-md bg-surface-2/60" />
				</div>
				<div className="flex items-center gap-2">
					<div className="h-9 w-32 rounded-lg bg-surface-2" />
				</div>
			</div>

			<div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-3">
				<div className="flex items-center gap-2">
					<div className="h-9 w-9 rounded-xl bg-surface-2" />
					<div className="h-9 w-36 rounded-xl bg-surface-2" />
					<div className="h-9 w-9 rounded-xl bg-surface-2" />
				</div>
				<div className="h-9 w-32 rounded-xl bg-surface-2" />
			</div>

			<div className="grid grid-cols-[repeat(auto-fill,minmax(min(175px,100%),1fr))] gap-2">
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="rounded-2xl border border-border bg-surface p-4 space-y-2">
						<div className="h-3 w-20 rounded bg-surface-2" />
						<div className="h-7 w-24 rounded bg-surface-2" />
					</div>
				))}
			</div>

			<div className="grid grid-cols-[repeat(auto-fill,minmax(min(175px,100%),1fr))] gap-2">
				{[1, 2, 3, 4, 5, 6].map((i) => (
					<div
						key={i}
						className="rounded-2xl border border-border bg-surface p-4 space-y-3 h-36 flex flex-col justify-between"
					>
						<div className="flex items-center justify-between">
							<div className="h-4 w-28 rounded bg-surface-2" />
							<div className="h-6 w-6 rounded bg-surface-2" />
						</div>
						<div className="h-3 w-36 rounded bg-surface-2/60" />
						<div className="flex items-center justify-between pt-2 border-t border-border/50">
							<div className="h-4 w-12 rounded bg-surface-2" />
							<div className="h-4 w-16 rounded bg-surface-2" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
