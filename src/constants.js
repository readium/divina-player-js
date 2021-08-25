// General
export const DEFAULT_MANIFEST_FILENAME = "manifest.json" // Title of the JSON file in a Divina folder
export const POSSIBLE_TAG_NAMES = ["language"] // List of allowed tags (note that "type" can also have variations)
export const DEFAULT_DUMMY_COLOR = "#333333" // Dark gray

// Loading message
export const LOADING_FILL_COLOR = "#FFFFFF" // White
export const LOADING_FONT_FAMILY = "Arial"
export const LOADING_FONT_SIZE = { value: 30, unit: "px" } // Do not use the "%" unit here

// Text and resources
export const MAX_FONT_SIZE = 1000 // In pixels (also, percent values cannot be larger than 100%)
export const MAX_LETTER_SPACING = 1000
export const DEFAULT_MIME_TYPE = "image/png"
// export const ACCEPTED_IMAGE_EXTENSIONS = ["png", "jpg"] // Not used (see utils.js)
export const ACCEPTED_VIDEO_EXTENSIONS = ["mp4"]

// Loading parameters
// Nb of units (pages or segments) after the current one for which resources should be stored
export const DEFAULT_MAX_NB_OF_UNITS_TO_LOAD_AFTER = 3
// Nb of units before the current one for which resources should be stored in memory,
// as a share of DEFAULT_MAX_NB_OF_PAGES_AFTER
export const MIN_SHARE_OF_UNITS_TO_LOAD_BEFORE = 1 / 3
// Timeout to cancel video load (only in non-parallel loading mode, in milliseconds)
export const DEFAULT_VIDEO_LOAD_TIMEOUT = 2000

// Loading animation
export const ROTATION_BY_TICK = 0.1
export const LINE_WIDTH = 2
export const SIZE_COEFFICIENT = 0.1

// Story
export const DEFAULT_DURATION = 250 // In milliseconds (used for transitions and snap point jumps)
export const POSSIBLE_PIXEL_ERROR = 0.5 // Margin of error for pixel computations

export const ACCEPTED_VALUES = {
	loadingMessage: {
		type: "string",
		defaultValue: "Loading",
	},
	loadingMode: {
		type: "string",
		allowed: ["page", "segment"],
		defaultValue: "page",
	},
	allowsDestroy: {
		type: "boolean",
		defaultValue: false,
	},
	allowsParallel: {
		type: "boolean",
		defaultValue: true,
	},
	allowsSwipe: {
		type: "boolean",
		defaultValue: true,
	},
	allowsWheelScroll: {
		type: "boolean",
		defaultValue: true,
	},
	allowsZoomOnDoubleTap: {
		type: "boolean",
		defaultValue: true,
	},
	allowsZoomOnCtrlOrAltScroll: {
		type: "boolean",
		defaultValue: true,
	},
	// To allow discontinuous gestures to trigger pagination jumps (when overflow === "scrolled")
	allowsPaginatedScroll: {
		type: "boolean",
		defaultValue: true,
	},
	// To make pagination sticky (only when overflow === "paginated")
	isPaginationSticky: {
		type: "boolean",
		defaultValue: true,
	},
	// To compute "fake" snap points from the page start (vs. from the current position)
	isPaginationGridBased: {
		type: "boolean",
		defaultValue: true,
	},
	direction: { // Also used for readingProgression
		type: "string",
		allowed: ["ltr", "rtl", "ttb", "btt"],
		defaultValue: "ltr",
	},
	continuous: {
		type: "boolean",
		defaultValue: true,
	},
	fit: {
		type: "string",
		allowed: ["contain", "cover", "width", "height"],
		defaultValue: "contain",
	},
	clipped: {
		type: "boolean",
		defaultValue: false,
	},
	overflow: {
		type: "string",
		allowed: ["scrolled", "paginated"],
		defaultValue: "scrolled",
	},
	hAlign: {
		type: "string",
		allowed: ["left", "center", "right"],
		defaultValue: "center",
	},
	vAlign: {
		type: "string",
		allowed: ["top", "center", "bottom"],
		defaultValue: "center",
	},
	spread: {
		type: "string",
		allowed: ["none", "both", "landscape"],
		defaultValue: "none",
	},
	constraint: {
		type: "string",
		allowed: ["exact", "min", "max"],
		defaultValue: "exact",
	},
	pageSide: {
		type: "string",
		allowed: ["left", "center", "right"],
		defaultValue: "center",
	},
	duration: {
		type: "strictlyPositiveNumber",
		defaultValue: DEFAULT_DURATION,
	},
	positive: {
		type: "positiveNumber",
		defaultValue: 0,
	},
	strictlyPositive: {
		type: "strictlyPositiveNumber",
		// No defaultValue
	},
	looping: {
		type: "boolean",
		defaultValue: false,
	},
	transitionType: {
		type: "string",
		allowed: ["cut", "dissolve", "slide-in", "slide-out", "push", "animation"],
		// defaultValue: "cut", // Actually useless (see Transition)
	},
	halfTransitionType: {
		type: "string",
		allowed: ["cut", "fade-in", "fade-out", "slide-in", "slide-out"],
		defaultValue: "cut",
	},
	transitionControlled: {
		type: "boolean",
		defaultValue: false,
	},
	viewport: {
		type: "string",
		allowed: ["start", "center", "end"],
		// defaultValue: "center", // Actually useless... for now!
	},
	animationType: {
		type: "string",
		allowed: ["time", "progress", "point"],
		defaultValue: "time",
	},
	animationVariable: {
		type: "string",
		allowed: ["alpha", "x", "y", "scale", "rotation"],
		// No default value!
	},
	backgroundColor: {
		type: "color",
		defaultValue: "#000000", // Black
	},
	fillColor: {
		type: "color",
		defaultValue: "#000000", // Black
	},
	fontFamily: {
		type: "string",
		// No allowed array means that all values are allowed!
		defaultValue: "Arial",
	},
	fontSize: {
		type: "value&Unit",
		defaultValue: { value: 20, unit: "%" },
	},
	lineHeight: {
		type: "value&Unit",
		// No default value (though should be "28px" for a "24px" Arial)
	},
	letterSpacing: {
		type: "number",
		defaultValue: 0,
	},
}

// Interactions
// Percentage of the relevant viewport dimension (width or height, depending on the story's
// reading direction) defining an "active" hit zone (to detect forward/backward clicks/taps)
export const REFERENCE_PERCENT = 0.3
export const VELOCITY_FACTOR = 10 // For a kinetic scroll
export const TIME_CONSTANT = 325 // For a kinetic scroll
export const MAX_ZOOM = 3 // Maximum zoom
export const ZOOM_SENSITIVITY = 3 // To compute zoom based on scroll
// Percentage of the relevant dimension to scroll to trigger a valid controlled transition
export const VIEWPORT_DIMENSION_PERCENT = 0.5

// Snap point speeds: speeds are computed such that the viewport will move by 1 relevant dimension
// (= the viewport's width or height in pixels) in defaultDuration milliseconds
export const SNAP_JUMP_SPEED_FACTOR = 1 / DEFAULT_DURATION
// (with the above, duration of a snap point jump = distance in px / speed,
// where speed is defaultDuration * snapJumpSpeedFactor (used in Camera))
export const STICKY_MOVE_SPEED_FACTOR = 1 / DEFAULT_DURATION
// (with the above, duration of a sticky snap point move = distance in px / speed,
// where speed is defaultDuration * stickyMoveSpeedFactor (used in Camera))