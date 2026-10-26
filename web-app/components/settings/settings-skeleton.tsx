export function SettingsSkeleton() {
	return (
		<div className="w-full max-w-7xl mx-auto space-y-4 px-1 sm:px-0 animate-pulse">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-border">
				<div className="space-y-1.5">
					<div className="h-7 w-64 rounded-lg bg-surface-2" />
					<div className="h-4 w-96 rounded-md bg-surface-2/60" />
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
				<div className="space-y-4">
					{[1, 2, 3].map((i) => (
						<div key={i} className="rounded-2xl border border-border bg-surface p-5 space-y-3">
							<div className="flex items-center gap-2.5 pb-2 border-b border-border">
								<div className="h-8 w-8 rounded-lg bg-surface-2" />
								<div className="space-y-1">
									<div className="h-4 w-32 rounded bg-surface-2" />
									<div className="h-3 w-48 rounded bg-surface-2/60" />
								</div>
							</div>
							<div className="space-y-2 pt-1">
								<div className="h-8 w-full rounded-lg bg-surface-2" />
								<div className="h-8 w-full rounded-lg bg-surface-2" />
							</div>
						</div>
					))}
				</div>

				<div className="space-y-4">
					{[1, 2, 3].map((i) => (
						<div key={i} className="rounded-2xl border border-border bg-surface p-5 space-y-3">
							<div className="flex items-center gap-2.5 pb-2 border-b border-border">
								<div className="h-8 w-8 rounded-lg bg-surface-2" />
								<div className="space-y-1">
									<div className="h-4 w-32 rounded bg-surface-2" />
									<div className="h-3 w-48 rounded bg-surface-2/60" />
								</div>
							</div>
							<div className="space-y-2 pt-1">
								<div className="h-8 w-full rounded-lg bg-surface-2" />
								<div className="h-8 w-full rounded-lg bg-surface-2" />
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
