import type { Transition, Variants } from "framer-motion";

export const SPRING_SNAPPY: Transition = {
	type: "spring",
	stiffness: 500,
	damping: 35,
	mass: 0.8,
};

export const SPRING_GENTLE: Transition = {
	type: "spring",
	stiffness: 280,
	damping: 28,
	mass: 0.9,
};

export const EASE_STANDARD: Transition = {
	duration: 0.24,
	ease: [0.2, 0, 0, 1],
};

export const FADE_UP_VARIANTS: Variants = {
	hidden: { opacity: 0, y: 10 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.24, ease: [0.2, 0, 0, 1] },
	},
	exit: {
		opacity: 0,
		y: -6,
		transition: { duration: 0.16, ease: [0.4, 0, 1, 1] },
	},
};

export const STAGGER_CONTAINER_VARIANTS: Variants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.035,
			delayChildren: 0.02,
		},
	},
};
