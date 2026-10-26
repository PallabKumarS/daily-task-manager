export function RoutinesSkeleton() {
	return (
		<div className="space-y-6 animate-pulse">
			<div>
				<div className="h-8 w-64 rounded-lg bg-surface-2" />
				<div className="h-4 w-96 rounded-md bg-surface-2/60 mt-2" />
			</div>

			<div className="space-y-8">
				{[1, 2].map((slot) => (
					<div key={slot} className="space-y-3">
						<div className="flex items-center justify-between border-b border-border pb-2">
							<div className="h-5 w-36 rounded bg-surface-2" />
							<div className="h-4 w-16 rounded bg-surface-2" />
						</div>

						<div className="grid grid-cols-[repeat(auto-fill,minmax(min(175px,100%),1fr))] gap-2">
							{[1, 2, 3, 4].map((i) => (
								<div
									key={i}
									className="rounded-2xl border border-border bg-surface p-4 space-y-3 h-32 flex flex-col justify-between"
								>
									<div className="flex items-center justify-between">
										<div className="h-4 w-24 rounded bg-surface-2" />
										<div className="h-6 w-6 rounded-full bg-surface-2" />
									</div>
									<div className="h-3 w-32 rounded bg-surface-2/60" />
									<div className="flex items-center justify-between pt-2 border-t border-border/50">
										<div className="h-3 w-12 rounded bg-surface-2" />
										<div className="h-3 w-12 rounded bg-surface-2" />
									</div>
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
