"use client";

import * as React from "react";
import { formatCurrency } from "@/lib/currency-symbols";

interface TimelinePoint {
	label: string;
	income: number;
	expense: number;
	net: number;
	cumulativeBalance: number;
}

interface CumulativeChartProps {
	timeline: TimelinePoint[];
	currency: string;
}

export function CumulativeChart({ timeline, currency }: CumulativeChartProps) {
	const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

	if (!timeline || timeline.length === 0) {
		return (
			<div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-surface p-6 text-xs text-muted-foreground shadow-[var(--shadow-card)]">
				No transaction activity recorded for this period yet.
			</div>
		);
	}

	const height = 260;
	const width = 800;
	const paddingX = 40;
	const paddingY = 30;

	const cumulativeValues = timeline.map((p) => p.cumulativeBalance);
	const minVal = Math.min(0, ...cumulativeValues);
	const maxVal = Math.max(10, ...cumulativeValues);
	const range = maxVal - minVal || 1;

	const points = timeline.map((point, i) => {
		const x = paddingX + (i / Math.max(1, timeline.length - 1)) * (width - 2 * paddingX);
		const normalizedY = (point.cumulativeBalance - minVal) / range;
		const y = height - paddingY - normalizedY * (height - 2 * paddingY);
		return { x, y, point };
	});

	const pathD = points.reduce((acc, curr, index) => {
		return index === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
	}, "");

	const zeroNormalized = (0 - minVal) / range;
	const zeroY = height - paddingY - zeroNormalized * (height - 2 * paddingY);

	const areaD =
		points.length > 0
			? `${pathD} L ${points[points.length - 1].x} ${zeroY} L ${points[0].x} ${zeroY} Z`
			: "";

	return (
		<div className="relative w-full overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
			<div className="flex flex-wrap items-center justify-between gap-2 mb-4">
				<div>
					<h4 className="text-sm font-bold text-foreground">
						Cumulative Wealth & Cashflow Trajectory
					</h4>
					<p className="text-xs text-muted-foreground">
						Progression of running net balance over time
					</p>
				</div>
				<div className="flex items-center gap-4 text-xs">
					<div className="flex items-center gap-1.5">
						<span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
						<span className="text-foreground font-medium">Cumulative Balance</span>
					</div>
					<div className="flex items-center gap-1.5">
						<span className="h-2 w-2 rounded-full bg-emerald-500/50" />
						<span className="text-muted-foreground">Income</span>
					</div>
					<div className="flex items-center gap-1.5">
						<span className="h-2 w-2 rounded-full bg-rose-500/50" />
						<span className="text-muted-foreground">Expense</span>
					</div>
				</div>
			</div>

			<div className="relative w-full overflow-x-auto">
				<svg
					viewBox={`0 0 ${width} ${height}`}
					className="w-full h-64 overflow-visible select-none"
				>
					<defs>
						<linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor="var(--income)" stopOpacity="0.32" />
							<stop offset="100%" stopColor="var(--income)" stopOpacity="0.0" />
						</linearGradient>
					</defs>

					<line
						x1={paddingX}
						y1={zeroY}
						x2={width - paddingX}
						y2={zeroY}
						stroke="var(--border-strong)"
						strokeDasharray="4 4"
						strokeWidth="1"
					/>

					{areaD && <path d={areaD} fill="url(#balanceGradient)" />}

					{points.map((p, idx) => {
						const barWidth = Math.max(3, (width - 2 * paddingX) / timeline.length / 3);
						const maxBarVal = Math.max(...timeline.map((t) => Math.max(t.income, t.expense, 10)));
						const incomeH = (p.point.income / maxBarVal) * 40;
						const expenseH = (p.point.expense / maxBarVal) * 40;

						return (
							<g key={`bar_${idx}`}>
								{p.point.income > 0 && (
									<rect
										x={p.x - barWidth - 1}
										y={zeroY - incomeH}
										width={barWidth}
										height={incomeH}
										fill="var(--income)"
										opacity="0.45"
										rx="1"
									/>
								)}
								{p.point.expense > 0 && (
									<rect
										x={p.x + 1}
										y={zeroY}
										width={barWidth}
										height={expenseH}
										fill="var(--expense)"
										opacity="0.45"
										rx="1"
									/>
								)}
							</g>
						);
					})}

					{pathD && (
						<path
							d={pathD}
							fill="none"
							stroke="var(--income)"
							strokeWidth="2.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					)}

					{points.map((p, idx) => (
						<g
							key={`pt_${idx}`}
							onMouseEnter={() => setHoveredIndex(idx)}
							onMouseLeave={() => setHoveredIndex(null)}
							className="cursor-pointer"
						>
							<circle
								cx={p.x}
								cy={p.y}
								r={hoveredIndex === idx ? 6 : 3.5}
								fill="var(--income)"
								stroke="var(--surface)"
								strokeWidth={hoveredIndex === idx ? 2 : 1}
							/>
							<rect x={p.x - 12} y={0} width={24} height={height} fill="transparent" />
						</g>
					))}
				</svg>

				{hoveredIndex !== null && points[hoveredIndex] && (
					<div
						className="absolute pointer-events-none rounded-xl border border-border-strong bg-surface p-3 shadow-[var(--shadow-pop)] text-xs z-20"
						style={{
							left: `${(points[hoveredIndex].x / width) * 100}%`,
							top: `${Math.max(10, points[hoveredIndex].y - 80)}px`,
							transform: "translateX(-50%)",
						}}
					>
						<p className="font-bold text-foreground">{points[hoveredIndex].point.label}</p>
						<div className="mt-1 space-y-0.5 tabular-nums">
							<p className="text-income-fg font-semibold">
								+ Income: {formatCurrency(points[hoveredIndex].point.income, currency)}
							</p>
							<p className="text-expense-fg font-semibold">
								- Expense: {formatCurrency(points[hoveredIndex].point.expense, currency)}
							</p>
							<p className="font-bold text-foreground pt-1 border-t border-border">
								Cumulative: {formatCurrency(points[hoveredIndex].point.cumulativeBalance, currency)}
							</p>
						</div>
					</div>
				)}
			</div>

			<div className="flex justify-between items-center text-xs text-muted-foreground pt-2 px-2">
				{timeline.length <= 12
					? timeline.map((t, i) => <span key={i}>{t.label}</span>)
					: timeline
							.filter(
								(_, i) => i % Math.ceil(timeline.length / 8) === 0 || i === timeline.length - 1,
							)
							.map((t, i) => <span key={i}>{t.label}</span>)}
			</div>
		</div>
	);
}
