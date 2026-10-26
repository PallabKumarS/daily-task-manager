export function DashboardSkeleton() {
	return (
		<div className="space-y-6 animate-pulse">
			{/* Header Skeleton */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div className="space-y-2">
					<div className="h-8 w-56 rounded-lg bg-surface-2" />
					<div className="h-4 w-72 rounded-md bg-surface-2/60" />
				</div>
				<div className="flex items-center gap-2 flex-wrap">
					<div className="h-9 w-24 rounded-lg bg-surface-2" />
					<div className="h-9 w-28 rounded-lg bg-surface-2" />
					<div className="h-9 w-28 rounded-lg bg-surface-2" />
					<div className="h-9 w-32 rounded-lg bg-surface-2" />
				</div>
			</div>

			{/* Metric Cards Skeleton */}
			<div className="grid grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] gap-4">
				{[1, 2, 3, 4].map((i) => (
					<div
						key={i}
						className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-3"
					>
						<div className="flex items-center justify-between">
							<div className="h-3 w-20 rounded bg-surface-2" />
							<div className="h-8 w-8 rounded-xl bg-surface-2" />
						</div>
						<div className="h-7 w-24 rounded bg-surface-2" />
						<div className="h-2 w-full rounded-full bg-surface-2" />
					</div>
				))}
			</div>

			{/* Mode Bar & Controls Skeleton */}
			<div className="flex items-center justify-between border-b border-border pb-3">
				<div className="flex items-center gap-2">
					<div className="h-8 w-24 rounded-lg bg-surface-2" />
					<div className="h-8 w-24 rounded-lg bg-surface-2" />
				</div>
				<div className="flex items-center gap-2">
					<div className="h-8 w-20 rounded-lg bg-surface-2" />
					<div className="h-8 w-20 rounded-lg bg-surface-2" />
				</div>
			</div>

			{/* Content Cards Grid Skeleton */}
			<div className="grid grid-cols-[repeat(auto-fill,minmax(min(175px,100%),1fr))] gap-2">
				{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
					<div
						key={i}
						className="rounded-xl border border-border bg-surface p-3 space-y-2 h-28 flex flex-col justify-between"
					>
						<div className="flex items-center justify-between">
							<div className="h-4 w-16 rounded bg-surface-2" />
							<div className="h-5 w-5 rounded bg-surface-2" />
						</div>
						<div className="h-3 w-24 rounded bg-surface-2" />
						<div className="h-2 w-12 rounded bg-surface-2" />
					</div>
				))}
			</div>
		</div>
	);
}
