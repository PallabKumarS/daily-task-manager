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
			<div className="flex h-64 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40 text-xs text-slate-500">
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
		const x =
			paddingX +
			(i / Math.max(1, timeline.length - 1)) * (width - 2 * paddingX);
		const normalizedY = (point.cumulativeBalance - minVal) / range;
		const y = height - paddingY - normalizedY * (height - 2 * paddingY);
		return { x, y, point };
	});

	const pathD = points.reduce((acc, curr, index) => {
		return index === 0
			? `M ${curr.x} ${curr.y}`
			: `${acc} L ${curr.x} ${curr.y}`;
	}, "");

	const zeroNormalized = (0 - minVal) / range;
	const zeroY = height - paddingY - zeroNormalized * (height - 2 * paddingY);

	const areaD =
		points.length > 0
			? `${pathD} L ${points[points.length - 1].x} ${zeroY} L ${points[0].x} ${zeroY} Z`
			: "";

	return (
		<div className="relative w-full overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-xl">
			<div className="flex flex-wrap items-center justify-between gap-2 mb-4">
				<div>
					<h4 className="text-sm font-bold text-slate-100">
						Cumulative Wealth & Cashflow Trajectory
					</h4>
					<p className="text-xs text-slate-400">
						Progression of running net balance over time
					</p>
				</div>
				<div className="flex items-center gap-4 text-xs">
					<div className="flex items-center gap-1.5">
						<span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
						<span className="text-slate-300">Cumulative Balance</span>
					</div>
					<div className="flex items-center gap-1.5">
						<span className="h-2 w-2 rounded-full bg-emerald-500/40" />
						<span className="text-slate-400">Income</span>
					</div>
					<div className="flex items-center gap-1.5">
						<span className="h-2 w-2 rounded-full bg-red-500/40" />
						<span className="text-slate-400">Expense</span>
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
							<stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
							<stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
						</linearGradient>
					</defs>

					{/* Zero baseline */}
					<line
						x1={paddingX}
						y1={zeroY}
						x2={width - paddingX}
						y2={zeroY}
						stroke="#334155"
						strokeDasharray="4 4"
						strokeWidth="1"
					/>

					{/* Area fill */}
					{areaD && <path d={areaD} fill="url(#balanceGradient)" />}

					{/* Bar indicators for income & expense */}
					{points.map((p, idx) => {
						const barWidth = Math.max(
							3,
							(width - 2 * paddingX) / timeline.length / 3,
						);
						const maxBarVal = Math.max(
							...timeline.map((t) => Math.max(t.income, t.expense, 10)),
						);
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
										fill="#10b981"
										opacity="0.4"
										rx="1"
									/>
								)}
								{p.point.expense > 0 && (
									<rect
										x={p.x + 1}
										y={zeroY}
										width={barWidth}
										height={expenseH}
										fill="#ef4444"
										opacity="0.4"
										rx="1"
									/>
								)}
							</g>
						);
					})}

					{/* Cumulative line */}
					{pathD && (
						<path
							d={pathD}
							fill="none"
							stroke="#10b981"
							strokeWidth="2.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					)}

					{/* Data point dots and interactive hover zones */}
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
								className={
									hoveredIndex === idx
										? "fill-emerald-300 stroke-slate-900"
										: "fill-emerald-400"
								}
								strokeWidth={hoveredIndex === idx ? 2 : 1}
							/>
							<rect
								x={p.x - 12}
								y={0}
								width={24}
								height={height}
								fill="transparent"
							/>
						</g>
					))}
				</svg>

				{/* Hover Tooltip */}
				{hoveredIndex !== null && points[hoveredIndex] && (
					<div
						className="absolute pointer-events-none rounded-xl border border-slate-700 bg-slate-950/95 p-2.5 shadow-xl text-xs z-20 backdrop-blur-md"
						style={{
							left: `${(points[hoveredIndex].x / width) * 100}%`,
							top: `${Math.max(10, points[hoveredIndex].y - 80)}px`,
							transform: "translateX(-50%)",
						}}
					>
						<p className="font-bold text-slate-200">
							{points[hoveredIndex].point.label}
						</p>
						<div className="mt-1 space-y-0.5">
							<p className="text-emerald-400">
								+ Income:{" "}
								{formatCurrency(points[hoveredIndex].point.income, currency)}
							</p>
							<p className="text-red-400">
								- Expense:{" "}
								{formatCurrency(points[hoveredIndex].point.expense, currency)}
							</p>
							<p className="font-semibold text-slate-100 pt-1 border-t border-slate-800">
								Cumulative:{" "}
								{formatCurrency(
									points[hoveredIndex].point.cumulativeBalance,
									currency,
								)}
							</p>
						</div>
					</div>
				)}
			</div>

			{/* X-axis labels */}
			<div className="flex justify-between items-center text-[10px] text-slate-500 pt-2 px-2">
				{timeline.length <= 12
					? timeline.map((t, i) => <span key={i}>{t.label}</span>)
					: timeline
							.filter(
								(_, i) =>
									i % Math.ceil(timeline.length / 8) === 0 ||
									i === timeline.length - 1,
							)
							.map((t, i) => <span key={i}>{t.label}</span>)}
			</div>
		</div>
	);
}
