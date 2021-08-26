'use strict';

var pixi_js = require('pixi.js');
var Hammer = require('hammerjs');

function _interopNamespace(e) {
	if (e && e.__esModule) return e;
	var n = Object.create(null);
	if (e) {
		Object.keys(e).forEach(function (k) {
			if (k !== 'default') {
				var d = Object.getOwnPropertyDescriptor(e, k);
				Object.defineProperty(n, k, d.get ? d : {
					enumerable: true,
					get: function () {
						return e[k];
					}
				});
			}
		});
	}
	n['default'] = e;
	return Object.freeze(n);
}

var Hammer__namespace = /*#__PURE__*/_interopNamespace(Hammer);

class Loop$1 {

	constructor(renderFunction) {
		if (!renderFunction) {
			return
		}
		this._renderFunction = renderFunction;

		this._loop = () => {
			if (this._dirty === true) {
				this._dirty = false;
				this._renderFunction();
			}
			requestAnimationFrame(this._loop);
		};

		this._loop();
	}

	setDirty(dirty) {
		this._dirty = dirty;
	}

	destroy() {
		if (!this._ticker) {
			return
		}
		this._ticker.destroy();
	}

}

class Container$1 {

	// Used in TextElement, TextureElement and LoadingAnimation
	get name() { return this._name }

	// Used in TextElement, TextureElement and LayerPile (parent is a Container, not a PixiContainer!)
	get parent() { return this._parent }

	// Used below and in LoadingAnimation
	get pixiContainer() { return this._pixiContainer }

	// Used in TextureElement
	get maskingPixiContainer() { return this._maskingPixiContainer }

	constructor(type = null, name = null, parent = null, pixiContainer = null) {
		this._type = type;
		this._pixiContainer = pixiContainer || new pixi_js.Container();
		this.setName(name);
		if (parent) {
			parent.addChild(this);
		}

		this._maskingPixiContainer = null;
		this._mask = null;

		this._position = { x: 0, y: 0 };

		this._scaleFactor = 1;
		this._scale = 1;

		this._isXPositionUpdating = false;
		this._isYPositionUpdating = false;
	}

	setName(name, suffix = null) {
		this._name = name;
		if (this._pixiContainer) {
			this._pixiContainer.name = name;
			if (suffix !== null) {
				this._pixiContainer.name += suffix;
			}
		}
		if (this._maskingPixiContainer) {
			this._setMaskingPixiContainerName();
			this._setMaskName();
		}
	}

	_setMaskingPixiContainerName() {
		this._maskingPixiContainer.name = `${this._name}MaskingContainer`;
	}

	_setMaskName() {
		this._mask.name = `${this._name}Mask`;
	}

	// Used here and in Player (on changing page navigators)
	addChild(child) {
		const { pixiContainer } = child;
		this._pixiContainer.addChild(pixiContainer);
		child.setParent(this);
	}

	// Used here, in TextureElement and LayerPile
	setParent(parent) {
		this._parent = parent;
	}

	// Mask functions are used in Renderer and TextureElement

	addMask() {
		this._maskingPixiContainer = new pixi_js.Container();
		this._setMaskingPixiContainerName();
		this._pixiContainer.addChild(this._maskingPixiContainer);
	}

	setMaskRect(x, y, w, h) {
		if (!this._maskingPixiContainer) {
			return
		}
		// The mask is recreated with each resize (it works better)

		// Remove the mask and create it again
		this._maskingPixiContainer.removeChildren();
		this._mask = new pixi_js.Graphics();
		this._setMaskName();
		this._maskingPixiContainer.addChild(this._mask);
		this._pixiContainer.mask = this._mask;

		// Redraw the mask at the right size
		this._mask.beginFill(0);
		this._mask.drawRect(x, y, w, h);
		this._mask.endFill();
	}

	removeMask() {
		this._pixiContainer.mask = null;
		if (this._mask) {
			this._maskingPixiContainer.removeChild(this._mask);
			this._mask = null;
		}
		if (this._maskingPixiContainer) {
			this._pixiContainer.removeChild(this._maskingPixiContainer);
			this._maskingPixiContainer = null;
		}
	}

	// Used in Renderer to update the content container on a resize
	setPivot(pivot) {
		this._pixiContainer.pivot = pivot;
	}

	// Used on destroying TextManager, on changing page navigators and in StateHandler
	removeFromParent() {
		if (!this._parent) {
			return
		}
		const { pixiContainer } = this._parent;
		this.setParent(null);
		if (!pixiContainer || !this._pixiContainer) {
			return
		}
		pixiContainer.removeChild(this._pixiContainer);
	}

	// Used in StateHandler and LayerPile
	addChildAtIndex(container, index) {
		// First store child PixiJS containers above index value away
		const { children } = this._pixiContainer;
		let i = children.length;
		const zIndex = Math.min(Math.max(index, 0), i);
		const tmpPixiContainer = new pixi_js.Container();
		i -= 1;
		while (i >= 0 && zIndex <= i) {
			const child = children[i];
			tmpPixiContainer.addChild(child);
			i -= 1;
		}
		// Now add the new child
		this.addChild(container);
		// Finally put child PixiJS containers back
		const childrenToPutBack = [...tmpPixiContainer.children].reverse();
		childrenToPutBack.forEach((child) => {
			this._pixiContainer.addChild(child);
		});
	}

	// Functions used in Player (for zoom)

	getPosition() {
		const { x, y } = this._pixiContainer;
		return { x, y }
	}

	// Functions used in Slice

	setAlpha(alpha) { // Also used in StateHandler (for transitions)
		this._pixiContainer.alpha = alpha;
	}

	setX(x) {
		this._position.x = x * this._scale;
		this._pixiContainer.x = x * this._scale;
	}

	setY(y) {
		this._position.y = y * this._scale;
		this._pixiContainer.y = y * this._scale;
	}

	setScaleFactor(scaleFactor) {
		if (!scaleFactor) {
			return
		}
		this._scaleFactor = scaleFactor;
		const actualScale = this._scale * this._scaleFactor;
		this._pixiContainer.scale.set(actualScale);
	}

	// Beware: rotations apply to sprites, not to their enclosing pixiContainer
	setRotation(rotation) {
		if (this._playableSprite) {
			this._playableSprite.rotation = rotation;
		} else {
			this._sprite.rotation = rotation;
		}
	}

	getAlpha() {
		return this._pixiContainer.alpha
	}

	getX() {
		return this._pixiContainer.position.x
	}

	getY() {
		return this._pixiContainer.position.y
	}

	getScaleFactor() {
		return this._scaleFactor
	}

	// Beware: rotations should apply to sprites, not to their enclosing pixiContainer
	getRotation() {
		if (this._playableSprite) {
			return this._playableSprite.rotation
		}
		return this._sprite.rotation
	}

	// Function used in OverflowHandler to layout segments

	setPosition(position) {
		if (!position) {
			return
		}
		this._position = position;
		if (this._isXPositionUpdating === false) {
			this._pixiContainer.position.x = position.x;
		}
		if (this._isYPositionUpdating === false) {
			this._pixiContainer.position.y = position.y;
		}
	}

	// Functions used in StateHandler to handle transitions

	resetPosition() {
		this.setPosition(this._position);
	}

	setIsXPositionUpdating(isXPositionUpdating) {
		this._isXPositionUpdating = isXPositionUpdating;
	}

	setIsYPositionUpdating(isYPositionUpdating) {
		this._isYPositionUpdating = isYPositionUpdating;
	}

	setXOffset(xOffset) {
		this._pixiContainer.position.x = this._position.x + xOffset;
	}

	setYOffset(yOffset) {
		this._pixiContainer.position.y = this._position.y + yOffset;
	}

	setVisibility(shouldBeVisible) {
		this._pixiContainer.visible = shouldBeVisible;
	}

	// Used in TextureElement - and in Layer to handle (a multi-layered segment's) slice layers
	setScale(scale) {
		if (!scale) {
			return
		}
		this._scale = scale;
		const actualScale = this._scale * this._scaleFactor;
		this._pixiContainer.scale.set(actualScale);
	}

	// Used in Segment
	clipToSize(size) {
		if (!this._maskingPixiContainer) {
			this.addMask();
		}
		const { width, height } = size;
		this.setMaskRect(-width / 2, -height / 2, width, height);
	}

}

// General
const DEFAULT_MANIFEST_FILENAME = "manifest.json"; // Title of the JSON file in a Divina folder
const POSSIBLE_TAG_NAMES = ["language"]; // List of allowed tags (note that "type" can also have variations)
const DEFAULT_DUMMY_COLOR = "#333333"; // Dark gray

// Loading message
const LOADING_FILL_COLOR$1 = "#FFFFFF"; // White
const LOADING_FONT_FAMILY$1 = "Arial";
const LOADING_FONT_SIZE$1 = { value: 30, unit: "px" }; // Do not use the "%" unit here

// Text and resources
const MAX_FONT_SIZE = 1000; // In pixels (also, percent values cannot be larger than 100%)
const MAX_LETTER_SPACING = 1000;
const DEFAULT_MIME_TYPE = "image/png";
// export const ACCEPTED_IMAGE_EXTENSIONS = ["png", "jpg"] // Not used (see utils.js)
const ACCEPTED_VIDEO_EXTENSIONS = ["mp4"];

// Loading parameters
// Nb of units (pages or segments) after the current one for which resources should be stored
const DEFAULT_MAX_NB_OF_UNITS_TO_LOAD_AFTER = 3;
// Nb of units before the current one for which resources should be stored in memory,
// as a share of DEFAULT_MAX_NB_OF_PAGES_AFTER
const MIN_SHARE_OF_UNITS_TO_LOAD_BEFORE = 1 / 3;
// Timeout to cancel video load (only in non-parallel loading mode, in milliseconds)
const DEFAULT_VIDEO_LOAD_TIMEOUT = 2000;

// Loading animation
const ROTATION_BY_TICK = 0.1;
const LINE_WIDTH = 2;
const SIZE_COEFFICIENT = 0.1;

// Story
const DEFAULT_DURATION = 250; // In milliseconds (used for transitions and snap point jumps)
const POSSIBLE_PIXEL_ERROR = 0.5; // Margin of error for pixel computations

const ACCEPTED_VALUES = {
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
};

// Interactions
// Percentage of the relevant viewport dimension (width or height, depending on the story's
// reading direction) defining an "active" hit zone (to detect forward/backward clicks/taps)
const REFERENCE_PERCENT = 0.3;
const VELOCITY_FACTOR = 10; // For a kinetic scroll
const TIME_CONSTANT = 325; // For a kinetic scroll
const MAX_ZOOM = 3; // Maximum zoom
const ZOOM_SENSITIVITY = 3; // To compute zoom based on scroll
// Percentage of the relevant dimension to scroll to trigger a valid controlled transition
const VIEWPORT_DIMENSION_PERCENT = 0.5;

// Snap point speeds: speeds are computed such that the viewport will move by 1 relevant dimension
// (= the viewport's width or height in pixels) in defaultDuration milliseconds
const SNAP_JUMP_SPEED_FACTOR = 1 / DEFAULT_DURATION;
// (with the above, duration of a snap point jump = distance in px / speed,
// where speed is defaultDuration * snapJumpSpeedFactor (used in Camera))
const STICKY_MOVE_SPEED_FACTOR = 1 / DEFAULT_DURATION;
// (with the above, duration of a sticky snap point move = distance in px / speed,
// where speed is defaultDuration * stickyMoveSpeedFactor (used in Camera))

var constants = /*#__PURE__*/Object.freeze({
	__proto__: null,
	DEFAULT_MANIFEST_FILENAME: DEFAULT_MANIFEST_FILENAME,
	POSSIBLE_TAG_NAMES: POSSIBLE_TAG_NAMES,
	DEFAULT_DUMMY_COLOR: DEFAULT_DUMMY_COLOR,
	LOADING_FILL_COLOR: LOADING_FILL_COLOR$1,
	LOADING_FONT_FAMILY: LOADING_FONT_FAMILY$1,
	LOADING_FONT_SIZE: LOADING_FONT_SIZE$1,
	MAX_FONT_SIZE: MAX_FONT_SIZE,
	MAX_LETTER_SPACING: MAX_LETTER_SPACING,
	DEFAULT_MIME_TYPE: DEFAULT_MIME_TYPE,
	ACCEPTED_VIDEO_EXTENSIONS: ACCEPTED_VIDEO_EXTENSIONS,
	DEFAULT_MAX_NB_OF_UNITS_TO_LOAD_AFTER: DEFAULT_MAX_NB_OF_UNITS_TO_LOAD_AFTER,
	MIN_SHARE_OF_UNITS_TO_LOAD_BEFORE: MIN_SHARE_OF_UNITS_TO_LOAD_BEFORE,
	DEFAULT_VIDEO_LOAD_TIMEOUT: DEFAULT_VIDEO_LOAD_TIMEOUT,
	ROTATION_BY_TICK: ROTATION_BY_TICK,
	LINE_WIDTH: LINE_WIDTH,
	SIZE_COEFFICIENT: SIZE_COEFFICIENT,
	DEFAULT_DURATION: DEFAULT_DURATION,
	POSSIBLE_PIXEL_ERROR: POSSIBLE_PIXEL_ERROR,
	ACCEPTED_VALUES: ACCEPTED_VALUES,
	REFERENCE_PERCENT: REFERENCE_PERCENT,
	VELOCITY_FACTOR: VELOCITY_FACTOR,
	TIME_CONSTANT: TIME_CONSTANT,
	MAX_ZOOM: MAX_ZOOM,
	ZOOM_SENSITIVITY: ZOOM_SENSITIVITY,
	VIEWPORT_DIMENSION_PERCENT: VIEWPORT_DIMENSION_PERCENT,
	SNAP_JUMP_SPEED_FACTOR: SNAP_JUMP_SPEED_FACTOR,
	STICKY_MOVE_SPEED_FACTOR: STICKY_MOVE_SPEED_FACTOR
});

const hasAScheme = (url) => {
	const regExp = new RegExp("^(?:[a-z]+:)?//", "i");
	return (regExp.test(url) === true)
};

const getFolderPathFromManifestPath = (manifestPath) => {
	if (!manifestPath || manifestPath.split("/").length === 1) {
		return ""
	}
	const folderPath = manifestPath.split(`/${DEFAULT_MANIFEST_FILENAME}`)[0];
	return folderPath
};

// For type checking

const isAString = (value) => (
	(typeof value === "string" || value instanceof String)
);

const isANumber = (value) => (Number.isFinite(value) === true);

const isAnObject = (value) => ( // Excluding the array case
	(value !== null && typeof value === "object" && Array.isArray(value) === false)
);

const getValidValueAndUnit = (value) => {
	const validValueAndUnit = {};
	if (value.slice(-1) === "%") {
		let validValue = value.substring(0, value.length - 1);
		validValue = Number(validValue);
		if (isANumber(validValue) === true && validValue >= 0
			&& validValue <= 100) { // Percent values should be between 0 and 100
			validValueAndUnit.value = validValue;
			validValueAndUnit.unit = "%";
		}
	} else if (value.length > 1 && value.slice(-2) === "px") {
		let validValue = value.substring(0, value.length - 2);
		validValue = Number(validValue);
		if (isANumber(validValue) === true && validValue >= 0) { // Pixel values should be positive
			validValueAndUnit.value = validValue;
			validValueAndUnit.unit = "px";
		}
	}
	if (validValueAndUnit.unit) {
		return validValueAndUnit
	}
	return null
};

// For checking data values
const returnValidValue = (valueType, value, shouldReturnDefaultValue) => {
	const { type, allowed, defaultValue } = ACCEPTED_VALUES[valueType] || {};

	if (type === "number") {
		if (value !== undefined && isANumber(value) === true) {
			return value
		}
		return (shouldReturnDefaultValue === true && defaultValue !== undefined)
			? defaultValue
			: null
	}
	if (type === "positiveNumber") {
		if (value !== undefined && isANumber(value) === true && value >= 0) {
			return value
		}
		return (shouldReturnDefaultValue === true && defaultValue !== undefined)
			? defaultValue
			: null
	}
	if (type === "strictlyPositiveNumber") {
		if (value !== undefined && isANumber(value) === true && value > 0) {
			return value
		}
		return (shouldReturnDefaultValue === true && defaultValue !== undefined)
			? defaultValue
			: null
	}
	if (type === "value&Unit") {
		if (value !== undefined && isAString(value) === true) {
			const validValueAndUnit = getValidValueAndUnit(value);
			if (validValueAndUnit) {
				return validValueAndUnit
			}
		}
		return (shouldReturnDefaultValue === true) ? defaultValue : null
	}
	if (type === "color") {
		const regExp = new RegExp("^#[0-9a-f]{6}$", "i");
		if (value && isAString(value) === true && regExp.test(value) === true) {
			return value
		}
		return (shouldReturnDefaultValue === true) ? defaultValue : null
	}
	if (type === "boolean") {
		if (value !== undefined && typeof value === "boolean") {
			return value
		}
		return (shouldReturnDefaultValue === true) ? defaultValue : null
	}
	if (type === "string") {
		if (value && isAString(value) === true
			&& (allowed === undefined || allowed.includes(value) === true)) {
			return value
		}
		return (shouldReturnDefaultValue === true) ? defaultValue : null
	}
	return null
};

// For handling resources

const getFileExtension = (path) => {
	if (!path) {
		return null
	}
	const pathParts = path.split(".");
	const extension = pathParts[pathParts.length - 1];
	return extension
};

const isOfType = (path, acceptableGeneralType, acceptableExtensions) => {
	const extension = getFileExtension(path);
	let isExtensionAcceptable = false;
	if (extension && acceptableExtensions) {
		acceptableExtensions.forEach((acceptableExtension) => {
			// Compare the uppercase versions of the extension strings
			if (extension.toUpperCase() === acceptableExtension.toUpperCase()) {
				isExtensionAcceptable = true;
			}
		});
	}
	return isExtensionAcceptable
};

const hasAVideoExtension = (path) => (
	isOfType(path, "video", ACCEPTED_VIDEO_EXTENSIONS)
);

/*const hasAnImageExtension = (path) => (
	isOfType(path, "image", constants.ACCEPTED_IMAGE_EXTENSIONS)
)*/

const getResourceAndMimeTypes = (path, type = null) => {
	let resourceType = null;

	// To assign a general resourceType, first check the specified value for type
	if (type) {
		const possibleType = type.split("/")[0];
		if (possibleType === "image" || possibleType === "video") {
			resourceType = possibleType;
		}
	}

	// If the specified value did not provide a relevant resourceType, check the path's extension
	if (!resourceType) {
		resourceType = (hasAVideoExtension(path) === true) ? "video" : "image";
	}
	// Note that the "image" resourceType is thus favored by default
	// Also note that we do not check that the mime type value is acceptable

	return { resourceType, mimeType: type || DEFAULT_MIME_TYPE }
};

// For parsing the aspect ratio value written as a string in the divina's viewportRatio property
const parseAspectRatio = (ratio) => {
	if (!ratio || isAString(ratio) === false) {
		return null
	}
	const parts = ratio.split(":");
	if (parts.length !== 2) {
		return null
	}
	const width = Number(parts[0]);
	const height = Number(parts[1]);
	if (isANumber(width) === true && isANumber(height) === true && height !== 0) {
		return (width / height)
	}
	return null
};

// For splitting an href into path and mediaFragment
const getPathAndMediaFragment = (href) => {
	if (!href || isAString(href) === false) {
		return { path: "" }
	}
	const hrefParts = href.split("#");
	const path = hrefParts[0];
	if (hrefParts.length === 1 || hrefParts.length > 2) {
		return { path }
	}
	const mediaFragment = hrefParts[1];
	return { path, mediaFragment }
};

const parseStringRect = (stringRect) => {
	let unit = "pixel";
	let xywh = null;
	let fragmentInfo = stringRect;
	fragmentInfo = fragmentInfo.split(":");
	if (fragmentInfo.length === 1) {
		[xywh] = fragmentInfo;
	} else if (fragmentInfo.length === 2) {
		[unit, xywh] = fragmentInfo;
	} else {
		return null
	}

	if (unit !== "percent" && unit !== "pixel") {
		return null
	}
	const xywhArray = xywh.split(",");
	if (xywhArray.length !== 4) {
		return null
	}

	let [x, y, w, h] = xywhArray;
	x = Number(x);
	y = Number(y);
	w = Number(w);
	h = Number(h);
	if (isANumber(x) === false
		|| isANumber(y) === false
		|| isANumber(w) === false
		|| isANumber(h) === false) {
		return null
	}

	return {
		x, y, w, h, unit: (unit === "percent") ? "%" : "px",
	}
};

const getRectWithSize = (rectWithUnit, { width, height }, shouldLimitSize = false) => {
	if (!rectWithUnit
		|| (rectWithUnit.unit !== "%" && rectWithUnit.unit !== "px")) {
		return null
	}

	let {
		x, y, w, h,
	} = rectWithUnit;
	if (isANumber(x) === false
		|| isANumber(y) === false
		|| isANumber(w) === false
		|| isANumber(h) === false) {
		return null
	}

	if (rectWithUnit.unit === "%") {
		x *= width / 100;
		y *= height / 100;
		w *= width / 100;
		h *= height / 100;
	}

	// Correct potential mistakes in the way a media fragment was written
	// by limiting the fragment to the natural dimensions of the resource
	if (shouldLimitSize === true) {
		x = Math.min(Math.max(x, 0), width);
		y = Math.min(Math.max(y, 0), height);
		w = Math.min(Math.max(w, 0), width - x);
		h = Math.min(Math.max(h, 0), height - y);
	}

	return {
		x, y, w, h,
	}
};

// For parsing a media fragment string

const getRectForMediaFragmentAndSize = (mediaFragment, size) => {
	if (!mediaFragment) {
		return null
	}
	const mediaFragmentParts = mediaFragment.split("=");
	if (mediaFragmentParts.length !== 2 || mediaFragmentParts[0] !== "xywh") {
		return null
	}
	const rectWithUnit = parseStringRect(mediaFragmentParts[1]);

	const shouldLimitSize = true;
	const rect = getRectWithSize(rectWithUnit, size, shouldLimitSize);
	if (!rect) {
		return null
	}
	const {
		x, y, w, h,
	} = rect;

	return {
		x, y, width: w, height: h,
	}
};

const getShortenedHref = (href) => {
	if (!href) {
		return null
	}
	return href.split("#")[0]
};

// For measuring a distance between 2 points (used for pinch)
const getDistance = (point1, point2) => (
	Math.sqrt((point2.x - point1.x) ** 2 + (point2.y - point1.y) ** 2)
);

// For converting colors
const convertColorStringToNumber = (hex) => {
	let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (result) {
		const r = parseInt(result[1], 16);
		const g = parseInt(result[2], 16);
		const b = parseInt(result[3], 16);
		result = r * (256 ** 2) + g * 256 + b;
		return result
	}
	return null
};

class Renderer$1 {

	// Used in Player

	get mainContainer() { return this._contentContainer }

	get size() {
		const { width, height } = this._renderer;
		return { width: width / this._pixelRatio, height: height / this._pixelRatio }
	}

	constructor(rootElement, backgroundColor = null, player) {
		this._player = player;

		this._pixelRatio = (window.devicePixelRatio || 1);

		// Create the Pixi application with a default background color
		const options = {
			transparent: (backgroundColor === "transparent"), // The PixiJS documentation is wrong!
			resolution: this._pixelRatio,
			autoDensity: true,
			antialias: true,
		};

		if (backgroundColor !== "transparent") {
			const shouldReturnDefaultValue = true;
			let color = returnValidValue("backgroundColor", backgroundColor,
				shouldReturnDefaultValue);
			color = convertColorStringToNumber(color);
			options.backgroundColor = color;
		}
		{
			this._renderer = pixi_js.autoDetectRenderer(options);

			this._stage = new pixi_js.Container();
			this._stage.interactive = false;
			this._stage.interactiveChildren = false;

			// Create the renderer's loop
			this._renderFunction = () => {
				if (!this._renderer) {
					return
				}
				this._renderer.render(this._stage);
			};
			this._loop = new Loop$1(this._renderFunction);
		}

		// Add the Pixi app's canvas to the DOM
		rootElement.appendChild(this._renderer.view);

		// Create the root container
		const parent = null;
		this._rootContainer = new Container$1("root", "root", parent, this._stage);

		// Create the container that will hold content (i.e. the current pageNavigator's pages)
		this._contentContainer = new Container$1("content", "content", this._rootContainer);

		this._zoomFactor = 1;
		this._viewportRect = {};
	}

	refreshOnce() {
		if (!this._loop) {
			return
		}
		this._loop.setDirty(true);
	}

	// Used in Player on a resize
	setSize(width, height) {
		if (width === this.size.width && height === this.size.height) {
			return
		}

		// Resize the canvas using Pixi's built-in function
		this._renderer.resize(width, height);
		{
			this._renderFunction(); // To avoid flickering (better than calling the Loop)
		}
	}

	// Used in Player as a consequence of a zoomFactor change or on a resize
	updateDisplay(zoomFactor, viewportRect) {
		this._zoomFactor = zoomFactor;
		this._viewportRect = viewportRect;

		const {
			x, y, width, height,
		} = this._viewportRect;

		// Update the pivot used to center containers by default
		this._contentContainer.setPivot({
			x: -x - width / 2,
			y: -y - height / 2,
		});

		const rendererWidth = this.size.width;
		const rendererHeight = this.size.height;
		const actualWidth = Math.min(viewportRect.width * zoomFactor, rendererWidth);
		const actualHeight = Math.min(viewportRect.height * zoomFactor, rendererHeight);
		const actualX = (rendererWidth - actualWidth) / 2;
		const actualY = (rendererHeight - actualHeight) / 2;
		this._maskRect = {
			x: actualX,
			y: actualY,
			width: actualWidth,
			height: actualHeight,
		};
		this.applyMask();
	}

	applyMask() {
		if (this._mask || !this._maskRect) {
			return
		}
		const {
			x, y, width, height,
		} = this._maskRect;
		this._rootContainer.setMaskRect(x, y, width, height);
	}

	applyViewportConstraints() {
		// Add a global mask (used to express viewportRatio constraints if specified)
		this._rootContainer.addMask();
		// Apply mask
		this.applyMask();
	}

	// Used in Player
	destroy() {
		if (this._loop) {
			this._loop.destroy();
			this._loop = null;
		}

		{
			this._stage.destroy(true);

			const shouldRemoveView = true;
			this._renderer.destroy(shouldRemoveView);
			this._renderer = null;
		}

		this._rootContainer = null;
		this._contentContainer = null;

		pixi_js.utils.clearTextureCache();
	}

}

class TextBlock$1 extends Container$1 {

	constructor(name, parent, text, textStyle, rect, lineWidth, boundingRect) {
		const finalStyle = new pixi_js.TextStyle(textStyle);
		const pixiTextContainer = new pixi_js.Text("", finalStyle);
		pixiTextContainer.anchor.set(0.5);
		pixiTextContainer.text = text;
		super("text", name, parent, pixiTextContainer);

		this._rect = rect;
		this._lineWidth = lineWidth;
		this._boundingRect = boundingRect;

		const { align } = textStyle;
		this._hAlign = align;
	}

	setReferencePosition(position) {
		const actualPosition = { // "left"
			x: position.x - this._boundingRect.width / 2 + this._rect.x + this._rect.width / 2,
			y: position.y - this._boundingRect.height / 2 + this._rect.y + this._rect.height / 2,
		};

		if (this._hAlign === "center" && this._lineWidth < this._boundingRect.width) {
			actualPosition.x += (this._boundingRect.width - this._lineWidth) / 2;
		} else if (this._hAlign === "right" && this._lineWidth < this._boundingRect.width) {
			actualPosition.x += this._boundingRect.width - this._lineWidth;
		}

		this.setPosition(actualPosition);
	}

	destroy() {
		this.pixiContainer.destroy({ children: true, texture: true, baseTexture: true });
		this.removeFromParent();
	}

}

class TextElement$1 {

	get boundingRect() { return this._boundingRect }

	constructor(name, parent, textOptions = {}) {
		this._name = name;
		this._parent = parent;

		const {
			fillColor,
			fontFamily,
			fontSize,
			lineHeight,
			letterSpacing,
			rect,
			hAlign,
		} = textOptions;

		const { unscaledSize = {} } = parent;
		const textStyle = {
			fill: fillColor,
			fontFamily,
			wordWrap: true,
			wordWrapWidth: undefined, // undefined is better than 0 (e.g. for TextManager)
			align: hAlign,
			letterSpacing: Math.min(letterSpacing || 0, MAX_LETTER_SPACING),
		};
		let maxWidth = unscaledSize.width;
		if (rect) {
			maxWidth = (rect.unit === "%")
				? (rect.w * unscaledSize.width) / 100
				: rect.w;
		}
		if (fontSize) {
			let actualFontSize = (fontSize.unit === "%")
				? (fontSize.value * unscaledSize.height) / 100
				: fontSize.value;
			actualFontSize = Math.min(actualFontSize, MAX_FONT_SIZE);
			textStyle.fontSize = actualFontSize;
		}
		if (lineHeight) {
			textStyle.lineHeight = (lineHeight.unit === "%")
				? (lineHeight.value * unscaledSize.height) / 100
				: lineHeight.value;
		}

		this._maxWidth = maxWidth;
		this._textStyle = textStyle;
		this._boundingRect = { width: 0, height: 0 };

		this._text = null;
		this._textBlocksArray = [];
	}

	setText(text) {
		if (this._text === text) {
			return
		}
		this.destroy();
		this._text = text;

		// 1. Split the initial text string in substrings separated by specific lookup strings

		// Items in lookupStringsArray are ordered in a way that favors complex tags/markdown
		const lookupStringsArray = [
			" ",
			"\\*", "\\_",
			"\n", "<br>", "<br/>", "<br />",
			"***", "_**", "___", "**_",
			"**", "__", "<b>", "</b>", "<strong>", "</strong>",
			"*", "_", "<i>", "</i>", "<em>", "</em>",
		];
		const currentStyles = {};
		const resultsArray = TextElement$1._lookupAndSplit(text, lookupStringsArray, false, currentStyles,
			[]);

		// 2. Compute text metrics for each substring (i.e. the dimensions of bounding rectangles)

		const linesArray = [];
		let currentLine = [];
		let currentLineWidth = 0;
		let nbOfSpaces = 0;

		resultsArray.forEach((substring) => {
			const {
				string, isNewLine, isBold, isItalic,
			} = substring;

			if (string === " " && isNewLine === false) {
				nbOfSpaces += 1; // All spaces have the same size, whatever their isBold or isItalic

			} else {
				let actualString = "";
				for (let i = 0; i < nbOfSpaces; i += 1) {
					actualString += " ";
				}
				actualString += string;

				let actualTextStyle = { ...this._textStyle };
				if (isBold === true) {
					actualTextStyle.fontWeight = "bold";
				}
				if (isItalic === true) {
					actualTextStyle.fontStyle = "italic";
				}
				actualTextStyle = new pixi_js.TextStyle(actualTextStyle);

				// IMPORTANT NOTE: PixiJS does not measure spaces at the end of a string,
				// but does include the measure of those at the start!
				let textMetrics = pixi_js.TextMetrics.measureText(actualString, actualTextStyle);

				if (isNewLine === true
					|| (this._maxWidth && currentLineWidth + textMetrics.width > this._maxWidth)) {
					currentLine.width = currentLineWidth;
					linesArray.push(currentLine);
					currentLine = [];
					currentLineWidth = 0;

					// Get rid of spaces
					actualString = string;
					textMetrics = pixi_js.TextMetrics.measureText(string, actualTextStyle);
				}

				substring.string = actualString;
				substring.textMetrics = textMetrics;
				currentLine.push(substring);
				currentLineWidth += textMetrics.width;

				nbOfSpaces = 0;
			}
		});

		// Last line
		if (currentLine.length > 0) {
			currentLine.width = currentLineWidth;
			linesArray.push(currentLine);
		}

		// 3. Merge substrings by style within a line

		const styledLines = [];
		let styledLine = [];
		let styledText = "";
		let left = 0;
		let blockWidth = 0;
		let currentStyle = null;
		let lineHeight = 0;
		let maxLineWidth = 0;

		linesArray.forEach((line) => {
			styledLine = [];
			styledText = "";
			left = 0;
			blockWidth = 0;
			line.forEach(({
				string, isBold, isItalic, textMetrics,
			}) => {
				if (!lineHeight) {
					lineHeight = Math.max(textMetrics.height, textMetrics.lineHeight);
				}
				if (!currentStyle) {
					currentStyle = { isBold, isItalic };

				// If the style changes, store merged substrings
				} else if (currentStyle.isBold !== isBold || currentStyle.isItalic !== isItalic) {

					if (styledText.length > 0) {

						// Apply style
						const finalStyle = { ...this._textStyle };
						if (currentStyle.isBold === true) {
							finalStyle.fontWeight = "bold";
						}
						if (currentStyle.isItalic === true) {
							finalStyle.fontStyle = "italic";
						}

						// Store text (blocks)
						let actualBlockWidth = blockWidth;
						if (string.charAt(0) === " ") {
							actualBlockWidth += this._textStyle.letterSpacing;
						}
						styledLine.push({
							text: styledText, style: finalStyle, left, width: actualBlockWidth,
						});
						left += actualBlockWidth;
					}
					styledText = "";
					currentStyle = { isBold, isItalic };
					blockWidth = 0;
				}

				styledText += string;
				blockWidth += textMetrics.width + this._textStyle.letterSpacing;
			});
			// Last block
			if (styledText.length > 0) {
				const finalStyle = { ...this._textStyle };
				if (currentStyle.isBold === true) {
					finalStyle.fontWeight = "bold";
				}
				if (currentStyle.isItalic === true) {
					finalStyle.fontStyle = "italic";
				}
				styledLine.push({
					text: styledText, style: finalStyle, left, width: blockWidth,
				});
			}
			styledLine.width = left + blockWidth;
			if (!maxLineWidth || maxLineWidth < styledLine.width) {
				maxLineWidth = styledLine.width;
			}
			styledLines.push(styledLine);
		});

		this._boundingRect = { width: maxLineWidth, height: lineHeight * styledLines.length };

		// 4. Create all text blocks

		styledLines.forEach((line, i) => {
			line.forEach((lineItem) => {
				const rect = { // Relative inside boundingRect? Depends on align!
					x: lineItem.left, y: i * lineHeight, width: lineItem.width, height: lineHeight,
				};
				const textBlock = new TextBlock$1(this._name, this._parent, lineItem.text, lineItem.style,
					rect, line.width, this._boundingRect);
				this._textBlocksArray.push(textBlock);
			});
		});
	}

	static _lookupAndSplit(string, lookupStringsArray, isNewLine, currentStyles, resultsArray) {
		let newResultsArray = [...resultsArray];
		let firstIndex = null;
		let firstLookupString = null;

		// Look up for specific characters/strings respecting priorities
		lookupStringsArray.forEach((lookupString) => {
			const index = string.indexOf(lookupString);
			if (index !== -1 && (firstIndex === null || index < firstIndex)) {
				firstIndex = index;
				firstLookupString = lookupString;
			}
		});

		if (firstIndex !== null) {
			let substring = string.substring(0, firstIndex);
			if (firstLookupString === "\\*") {
				substring += "*";
			} else if (firstLookupString === "\\_") {
				substring += "_";
			}
			newResultsArray = TextElement$1._addSubstring(substring, isNewLine, currentStyles,
				newResultsArray);
			isNewLine = false;

			if (firstLookupString === " ") {
				newResultsArray = TextElement$1._addSubstring(" ", isNewLine, currentStyles, newResultsArray);
			}

			switch (firstLookupString) {
			case "\n":
			case "<br>":
			case "<br/>":
			case "<br />":
				isNewLine = true;
				break
			case "***":
				currentStyles.tripleStar = !currentStyles.tripleStar;
				break
			case "___":
				currentStyles.tripleUnderscore = !currentStyles.tripleUnderscore;
				break
			case "_**":
				currentStyles.tripleCompound = true;
				break
			case "**_":
				currentStyles.tripleCompound = false;
				break
			case "**":
				currentStyles.doubleStar = !currentStyles.doubleStar;
				break
			case "__":
				currentStyles.doubleUnderscore = !currentStyles.doubleUnderscore;
				break
			case "*":
				currentStyles.singleStar = !currentStyles.singleStar;
				break
			case "_":
				currentStyles.singleUnderscore = !currentStyles.singleUnderscore;
				break
			case "<b>":
				currentStyles.b = true;
				break
			case "</b>":
				currentStyles.b = false;
				break
			case "<strong>":
				currentStyles.strong = true;
				break
			case "</strong>":
				currentStyles.strong = false;
				break
			case "<i>":
				currentStyles.i = true;
				break
			case "</i>":
				currentStyles.i = false;
				break
			case "<em>":
				currentStyles.em = true;
				break
			case "</em>":
				currentStyles.em = false;
				break
			}

			const nextString = string.substring(firstIndex + firstLookupString.length);
			newResultsArray = TextElement$1._lookupAndSplit(nextString, lookupStringsArray,
				isNewLine, currentStyles, newResultsArray);
			return newResultsArray
		}

		newResultsArray = TextElement$1._addSubstring(string, isNewLine, currentStyles, newResultsArray);
		return newResultsArray
	}

	static _addSubstring(string, isNewLine, currentStyles, resultsArray) {
		if (string.length === 0 && isNewLine === false) { // i.e. if a space (not a line break)
			return resultsArray
		}
		let isBold = false;
		let isItalic = false;
		Object.entries(currentStyles).forEach(([style, value]) => {
			if (value === true) {
				if (style === "tripleStar" || style === "tripleUnderscore" || style === "tripleCompound"
					|| style === "doubleStar" || style === "doubleUnderscore"
					|| style === "b" || style === "strong") {
					isBold = true;
				}
				if (style === "tripleStar" || style === "tripleUnderscore" || style === "tripleCompound"
					|| style === "singleStar" || style === "singleUnderscore"
					|| style === "i" || style === "em") {
					isItalic = true;
				}
			}
		});
		const newSubstring = {
			string, isNewLine, isBold, isItalic,
		};
		const newResultsArray = [...resultsArray, newSubstring];
		return newResultsArray
	}

	setPosition(position) {
		this._textBlocksArray.forEach((textBlock) => {
			textBlock.setReferencePosition(position);
		});
	}

	destroy() {
		this._textBlocksArray.forEach((textBlock) => {
			textBlock.destroy();
		});
		this._textBlocksArray = [];
	}

}

// Used in TextureElement

class LoadingAnimation {

	constructor(textureElement, parentContainerScale = 1, player) {
		this._textureElement = textureElement;
		this._parentContainerScale = parentContainerScale;
		this._player = player;

		const { name, pixiContainer } = textureElement;
		this._name = name;
		this._parentContainer = pixiContainer;

		this._ticker = new pixi_js.Ticker();
		this._ticker.stop();
		this._isPlaying = false;
		this._rotation = 0;
		this._tickerFunction = () => {
			if (!this._loadingAnimationGraphics || this._isPlaying === false) {
				return
			}
			this._loadingAnimationGraphics.rotation += ROTATION_BY_TICK;

			const { isInViewport } = this._textureElement;
			if (isInViewport === true) {
				player.refreshOnce();
			}
		};
		this._ticker.add(this._tickerFunction);
	}

	_updateGraphics() {
		if (this._loadingAnimationGraphics) {
			this._parentContainer.removeChild(this._loadingAnimationGraphics);
		}

		const { LINE_WIDTH, SIZE_COEFFICIENT } = constants;

		this._loadingAnimationGraphics = new pixi_js.Graphics();
		this._loadingAnimationGraphics.name = `${this._name}LoadingAnimation`;
		this._parentContainer.addChild(this._loadingAnimationGraphics);
		const lineTextureStyle = { width: LINE_WIDTH, texture: pixi_js.Texture.WHITE };
		this._loadingAnimationGraphics.lineTextureStyle(lineTextureStyle);

		const { viewportRect } = this._player;
		const { width, height } = viewportRect;
		const radius = Math.min(width, height) * SIZE_COEFFICIENT;
		const endAngle = -Math.PI / 3;
		this._loadingAnimationGraphics.arc(0, 0, radius, 0, endAngle);

		this._loadingAnimationGraphics.scale.set(1 / this._parentContainerScale);
	}

	addAndStart() {
		this._ticker.start();
		this._isPlaying = true;
		this._updateGraphics();
	}

	resize(parentContainerScale) {
		if (this._parentContainerScale === parentContainerScale) {
			return
		}
		this._parentContainerScale = parentContainerScale;
		if (this._isPlaying === true) {
			this._updateGraphics();
		}
	}

	stopAndRemove() {
		this._isPlaying = false;
		this._ticker.stop();
		if (this._loadingAnimationGraphics) {
			this._parentContainer.removeChild(this._loadingAnimationGraphics);
			this._loadingAnimationGraphics = null;
		}
	}

}

class TextureElement$1 extends Container$1 {

	// Used in LayerPile

	get scale() { return this._scale } // For a parent slice (i.e. when role is "layersParent")

	get size() {
		// If the resource is (possibly) clipped, return the (possibly) clipped size
		if (this._clipped === true) {
			const { viewportRect } = this._player;
			return {
				width: Math.min(this._width * this._scale, viewportRect.width),
				height: Math.min(this._height * this._scale, viewportRect.height),
			}
		}
		return this.unclippedSize
	}

	// Used below
	get unclippedSize() {
		// In double reading mode, empty slices should be considered to have their neighbor's size
		if (this._role === "empty" && this._neighbor) {
			return this._neighbor.size
		}
		// Otherwise just return the actual size of the sprite in the viewport
		return {
			width: this._width * this._scale,
			height: this._height * this._scale,
		}
	}

	// Used in TextSlice and TextElement
	get unscaledSize() { return { width: this._width, height: this._height } }

	// Used in Slice and LoadingAnimation
	get isInViewport() { return this._isInViewport }

	// Used in Slice and SequenceSlice
	get player() { return this._player }

	// Used in Slice and TextSlice

	get role() { return this._role }

	get parentInfo() { return this._parentInfo }

	constructor(role, player, parentInfo = null) {
		super();

		this._role = role;
		this._player = player;
		this._parentInfo = parentInfo;

		this._texture = null;

		this._sprite = new pixi_js.Sprite();
		this._sprite.anchor.set(0.5);
		this._pixiContainer.addChild(this._sprite);

		this._isInViewport = false;
		this._sprite.visible = false;

		this._playableSprite = null;
		this._namePrefix = null;

		this._width = 1;
		this._height = 1;
		this._scale = 1;

		this._fit = null;
		this._clipped = false;

		this._neighbor = null;

		this._duration = 0;

		this._loadingAnimation = null;

		if (this._role === "layersParent") {
			this._sprite.visible = false;
		}
	}

	// Used in StoryBuilder
	setNeighbor(neighborSlice) {
		this._neighbor = neighborSlice;
	}

	addAndStartLoadingAnimation() {
		if (this._loadingAnimation) {
			return
		}
		this._loadingAnimation = new LoadingAnimation(this, this._scale, this._player);
		this._loadingAnimation.addAndStart();
	}

	stopAndRemoveLoadingAnimation() {
		if (!this._loadingAnimation) {
			return
		}
		this._loadingAnimation.stopAndRemove();
	}

	setSize(size) {
		const { width, height } = size;

		// Canvases cannot draw content less than 1 pixel wide and high
		this._width = Math.max(width, 1);
		this._height = Math.max(height, 1);

		this._sprite.width = this._width;
		this._sprite.height = this._height;

		if (this._playableSprite) {
			this._playableSprite.width = this._width;
			this._playableSprite.height = this._height;
		}
	}

	assignDummyTexture() {
		this.setTexture(null);
	}

	setTexture(texture) {
		// No need to add a texture to a parent slice
		if (this._role === "layersParent") {
			return
		}
		this._texture = texture;
		if (!texture) {
			this.setBackgroundColor(DEFAULT_DUMMY_COLOR);
		} else {
			this._sprite.texture = texture.pixiTexture;
			this._setTint(0xFFFFFF);
		}
	}

	setBackgroundColor(color) {
		this._sprite.texture = pixi_js.Texture.WHITE;
		const tint = convertColorStringToNumber(color);
		this._setTint(tint);
	}

	_setTint(tint) {
		this._sprite.tint = tint;
	}

	// Used in Slice
	setVideoTexture(videoTexture) {
		this._sprite.texture = null;

		if (this._playableSprite) {
			this.pixiContainer.removeChild(this._playableSprite);
		}
		this._playableSprite = pixi_js.Sprite.from(videoTexture.pixiTexture);
		this._addPlayableSprite();

		this._playableSprite.visible = this._isInViewport;

		this._playableSprite.position = this._sprite.position;
	}

	_addPlayableSprite() {
		if (!this._playableSprite) {
			return
		}

		this._playableSprite.anchor.set(0.5);

		// Since a playableSprite for a SequenceSlice has a different way of computing size,
		// the dimensions are applied for a video playableSprite only via setVideoTexture

		const spriteName = `${this.name}PlayableSprite`;
		this._playableSprite.name = spriteName;

		this.pixiContainer.addChild(this._playableSprite);

		if (this.maskingPixiContainer) {
			this.pixiContainer.addChild(this._maskingPixiContainer);
		}
	}

	// Used in SequenceSlice (since clipped forced to true, a mask will necessarily be created)
	setTexturesArray(texturesArray) {
		this._sprite.texture = null;

		// PixiJS does not allow for a direct assignement (playableSprite.textures = texturesArray),
		// so remove the sequence sprite before recreating it
		if (this._playableSprite) {
			this.pixiContainer.removeChild(this._playableSprite);
		}
		if (!texturesArray || texturesArray.length === 0) {
			return
		}
		const pixiTexturesArray = texturesArray.map(({ texture, time }) => (
			{ texture: texture.pixiTexture, time }
		));
		this._playableSprite = new pixi_js.AnimatedSprite(pixiTexturesArray);
		this._addPlayableSprite();
	}

	unsetVideoTexture() {
		if (!this._playableSprite) {
			return
		}
		this.pixiContainer.removeChild(this._playableSprite);
		this._playableSprite.texture = null;
	}

	// Used in Container (called with parent = null) and LayerPile (via Slice)
	// Bear in mind that the parent of a layersChild slice is a segment (not the parentSlice!)
	setParent(parent = null) {
		super.setParent(parent);

		// Keep the existing name for a transition slice
		if (!parent || (this.name && this._role === "transition")) {
			return
		}

		let { name } = parent;
		if (this._parentInfo) {
			name += `Layer${this._parentInfo.layerIndex}`;
		}
		if (this._role === "transition") {
			name += "Transition";
		}
		this._sprite.name = `${name}Sprite`;
		const suffix = "Slice";
		this.setName(name, suffix);
	}

	resize(fit, clipped) {
		this._fit = fit;
		this._clipped = clipped;

		this._applyFit(fit);
		if (clipped === true) {
			this._applyClip();
		}

		// If the slice has a parent slice, position it respective to that parent slice
		if (this._role === "layersChild" && this._parentInfo) {
			// Used unclippedSize since to ensure that the position is based
			// on the top left point of the parent slice (instead of the effective viewport)
			const { unclippedSize } = this._parentInfo.slice;
			this._sprite.position = {
				x: (this.size.width - unclippedSize.width / this._scaleFactor) / (2 * this._scale),
				y: (this.size.height - unclippedSize.height / this._scaleFactor) / (2 * this._scale),
			};
			if (this._playableSprite) {
				this._playableSprite.position = this._sprite.position;
			}
			if (this.maskingPixiContainer) {
				this.maskingPixiContainer.position = this._sprite.position;
			}
		}

		if (this._loadingAnimation) {
			this._loadingAnimation.resize(this._scale);
		}
	}

	_applyFit(fit) {
		if (!this._width || !this._height
			|| this._role === "layersChild") { // Scale will remain at 1 for a child
			return
		}

		const ratio = this._width / this._height;
		const { viewportRect } = this._player;
		const { height } = viewportRect;
		let { width } = viewportRect;

		// In double reading mode, fit the resource inside a rectangle half the viewport width (maximum)
		if (this._player.readingMode === "double") {
			width = this._getWidthForHalfSegmentSlice(width);
		}

		// Compute the scale to be applied to the container based on fit
		const viewportRatio = width / height;
		let scale = 1;
		switch (fit) {
		case "height":
			scale = this._getScaleWhenForcingHeight(height);
			break
		case "width":
			scale = this._getScaleWhenForcingWidth(width);
			break
		case "contain":
			if (ratio >= viewportRatio) {
				scale = this._getScaleWhenForcingWidth(width);
			} else {
				scale = this._getScaleWhenForcingHeight(height);
			}
			break
		case "cover":
			if (ratio >= viewportRatio) {
				scale = this._getScaleWhenForcingHeight(height);
			} else {
				scale = this._getScaleWhenForcingWidth(width);
			}
			break
		}

		// Now apply the scale to the container
		if (this._role === "layersParent") {
			if (this._scale !== scale) { // So as not to trigger an infinite loop
				this.setScale(scale);
				if (this.parent) {
					this.parent.resizePage();
				}
			}
		} else {
			this.setScale(scale);
		}
	}

	_getWidthForHalfSegmentSlice(width) {
		let actualWidth = width;
		if (this._role === "empty" && this._neighbor) {
			const { size } = this._neighbor;
			actualWidth = Math.min(width / 2, size.width);
		} else {
			actualWidth /= 2;
		}
		return actualWidth
	}

	_getScaleWhenForcingHeight(viewportHeight) {
		const scale = viewportHeight / this._height;
		return scale
	}

	_getScaleWhenForcingWidth(viewportWidth) {
		const scale = viewportWidth / this._width;
		return scale
	}

	// Size the clipping mask based on viewport size if the resource needs to be clipped
	_applyClip() {
		const { viewportRect } = this._player;
		const { width, height } = viewportRect;
		// Only add a mask if it's absolutely necessary (since masks do have a cost in performance)
		if (this._fit === "contain"
			|| (this._width / this._height) <= ((width + POSSIBLE_PIXEL_ERROR) / height)) {
			return
		}
		if (!this.maskingPixiContainer) {
			this.addMask();
		}

		this.setMaskRect((-width / this._scale) / 2, (-height / this._scale) / 2,
			width / this._scale, height / this._scale);
	}

	// Used in TextSlice
	applySizeClip() {
		if (!this.maskingPixiContainer) {
			this.addMask();
		}
		this.setMaskRect(-this._width / 2, -this._height / 2, this._width, this._height);
	}

	// Used in Layer
	setIsInViewport(isInViewport) {
		if (isInViewport !== this._isInViewport) {
			this._sprite.visible = isInViewport;
			if (this._playableSprite) {
				this._playableSprite.visible = isInViewport;
			}
		}
		this._isInViewport = isInViewport;
	}

	// Used in SequenceSlice

	goToFrameAndPlay(frameIndex) {
		if (!this._playableSprite) {
			return
		}
		this._playableSprite.gotoAndPlay(frameIndex);
	}

	goToFrameAndStop(frameIndex) {
		if (!this._playableSprite) {
			return
		}
		this._playableSprite.gotoAndStop(frameIndex);
	}

	// Used in Slice on final destroy
	destroy() {
		this._sprite.texture = null;
		if (this._playableSprite) {
			this._playableSprite.texture = null;
		}
	}

}

class BaseTexture {

	// Used in Loader
	get pixiBaseTexture() { return this._pixiBaseTexture }

	constructor(pixiBaseTexture) {
		this._pixiBaseTexture = pixiBaseTexture;
	}

	destroy() {
		if (!this._pixiBaseTexture) {
			return
		}
		this._pixiBaseTexture.destroy();
	}

}

class Texture$1 {

	// Used in Loader
	get pixiTexture() { return this._pixiTexture }

	// Used in Slice

	get video() { return this._video }

	get size() {
		if (this._video) {
			return { width: this._video.videoWidth, height: this._video.videoHeight }
		}
		return (this._pixiTexture) ? this._pixiTexture.frame : { width: 0, height: 0 }
	}

	constructor(pixiTexture, video = null) {
		this._pixiTexture = pixiTexture;
		if (video) {
			this._video = video;
		}
	}

	// Used in TextureResource
	static createVideoTexture(videoPath) {
		const pixiTexture = pixi_js.Texture.from(videoPath);

		// Prevent autoplay at start
		pixiTexture.baseTexture.resource.autoPlay = false;

		const baseTexture = new BaseTexture(pixiTexture.baseTexture);

		const video = pixiTexture.baseTexture.resource.source;
		const texture = new Texture$1(pixiTexture, video);

		return { baseTexture, texture }
	}

	// Used in TextureResource
	static cropToFragment(uncroppedTexture, mediaFragment) {
		const { pixiTexture, video } = uncroppedTexture;
		const croppedPixiTexture = pixiTexture.clone();

		const rect = getRectForMediaFragmentAndSize(mediaFragment, croppedPixiTexture);
		if (rect) {
			const {
				x, y, width, height,
			} = rect;
			const frame = new pixi_js.Rectangle(x, y, width, height);
			croppedPixiTexture.frame = frame;
			croppedPixiTexture.updateUvs();
		}

		const texture = (video)
			? new Texture$1(croppedPixiTexture, video)
			: new Texture$1(croppedPixiTexture);

		return texture
	}

	destroy() {
		if (this._pixiTexture) {
			this._pixiTexture.destroy();
		}
		if (this._video) {
			this._video = null;
		}
	}

}

class Loader$1 {

	get hasTasks() { return (Object.values(this._resourceIdsToLoad).length > 0) }

	constructor() {
		this._loader = new pixi_js.Loader();
		this._loader.onError.add((error, loader, resource) => {
			const { name } = resource;
			const resourceId = Number(name);
			this._resourceIdsToLoad[resourceId] = false;
		});
		this.reset();
	}

	// Kill the ongoing loading operation (if there is one)
	reset() {
		this._resourceIdsToLoad = {};
		this._loader.reset();
	}

	// Add a sourcePath to the list of source paths to load
	add(resourceId, sourcePath) {
		this._resourceIdsToLoad[resourceId] = true;
		// Note that loadType is forced to image!
		const name = String(resourceId);
		this._loader.add(name, sourcePath, {
			crossOrigin: "anonymous", loadType: pixi_js.LoaderResource.LOAD_TYPE.IMAGE,
		});
	}

	// For each array of resources (source paths) that have been correctly loaded...
	onComplete(doWithTextureDataArray) {
		if (!doWithTextureDataArray) {
			return
		}
		// Even if the loader has failed to load the resource, the function below will be executed
		// (after that in this._loader.onError, hence the check of this._resourceIdsToLoad[resourceId])
		this._loader.onComplete.add((_, resources) => {
			const textureDataArray = [];
			Object.values(resources).forEach((resource) => {
				const { name, texture } = resource; // The texture here is a PixiJS texture
				const resourceId = Number(name);
				if (this._resourceIdsToLoad[resourceId] === true && texture && texture.baseTexture) {
					const { baseTexture } = texture;
					const textureData = {
						resourceId,
						texture: {
							base: new BaseTexture(baseTexture),
							full: new Texture$1(texture),
						},
					};
					textureDataArray.push(textureData);
					pixi_js.Texture.removeFromCache(texture.pixiTexture);
					pixi_js.BaseTexture.removeFromCache(baseTexture.pixiBaseTexture);
				}
			});
			doWithTextureDataArray(textureDataArray);
		});
	}

	// Load stored source paths
	load() {
		this._loader.load();
	}

}

var PixiRenderer = /*#__PURE__*/Object.freeze({
	__proto__: null,
	Renderer: Renderer$1,
	Loop: Loop$1,
	Container: Container$1,
	TextBlock: TextBlock$1,
	TextElement: TextElement$1,
	TextureElement: TextureElement$1,
	Loader: Loader$1,
	Texture: Texture$1
});

const chosenRenderer = PixiRenderer;

const {
	Renderer,
	Loop,
	Container,
	TextBlock,
	TextElement,
	TextureElement,
	Loader,
	Texture,
} = chosenRenderer;

const {
	LOADING_FILL_COLOR,
	LOADING_FONT_FAMILY,
	LOADING_FONT_SIZE,
} = constants;

class TextManager extends Container {

	constructor(mainContainer, player) {
		super("textManager", "textManager", mainContainer);

		this._player = player;

		const textOptions = {
			fillColor: LOADING_FILL_COLOR,
			fontFamily: LOADING_FONT_FAMILY,
			fontSize: LOADING_FONT_SIZE,
			hAlign: "center",
		};
		this._textElement = new TextElement("loadingText", this, textOptions);
	}

	showMessage(message) { // Where message should be = { type, data }
		// Beware: we can have message.text = 0 (when a Divina starts loading)
		if (!message || !message.type || message.data === undefined) {
			return
		}

		// Write full text based on message type
		const { type, data, loadingMessage } = message;
		const shouldReturnDefaultValue = true;
		let text = returnValidValue("loadingMessage", loadingMessage, shouldReturnDefaultValue);
		switch (type) {
		case "loading":
			text += `... ${data}%`;
			break
		case "error":
			text = `ERROR!\n${data}`;
			break
		}

		if (!this._textElement || !text) {
			return
		}
		this._textElement.setText(text);

		// Refresh display
		this._player.refreshOnce();
	}

	destroy() {
		if (!this._textElement) {
			return
		}
		this._textElement.destroy();
		this._textElement = null;

		this.removeFromParent();
	}

}

class InteractionManager {

	// Used below

	get canConsiderInteractions() { return this._player.canConsiderInteractions }

	get pageNavigator() { return this._player.pageNavigator }

	constructor(player, rootElement) {
		this._player = player; // Useful only to get viewportRect below
		this._rootElement = rootElement;

		// Create Hammer object to handle user gestures
		this._mc = new Hammer__namespace.Manager(rootElement);

		// Implement single tap detection
		this._singleTap = new Hammer__namespace.Tap({ event: "singletap" });
		this._mc.add(this._singleTap);

		// Only finalize the implementation of single tap detection at this stage
		this._handleSingleTap = this._handleSingleTap.bind(this);
		this._mc.on("singletap", this._handleSingleTap);

		this._doOnCenterTap = null;
		this._percentFunction = null; // For (non-wheel scroll) viewport drags
		this._initialTouchPoint = null; // For non-wheel scroll zoom
		this._lastScrollEvent = null; // For non-wheel scroll in general
		this._wasLastEventPanend = false; // For (non-wheel scroll) viewport drags
	}

	_handleSingleTap(e) {
		// If story not loaded yet, only allow a center tap
		if (this.canConsiderInteractions === false) {
			if (this._doOnCenterTap) {
				this._doOnCenterTap();
			}
			return
		}

		const { viewportRect } = this._player;
		const {
			x, y, width, height,
		} = this._rootElement.getBoundingClientRect();

		// Get coordinates of the canvas' origin in _rootElement
		const topLeftCanvasPoint = {
			x: (width - viewportRect.width) / 2,
			y: (height - viewportRect.height) / 2,
		};

		// Compute the reference lengths used for checking what viewport zone a hit lies in
		const { REFERENCE_PERCENT } = constants;
		const referenceXLength = topLeftCanvasPoint.x + viewportRect.width * REFERENCE_PERCENT;
		const referenceYLength = topLeftCanvasPoint.y + viewportRect.height * REFERENCE_PERCENT;

		const hitPointer = e.center;
		const hitX = hitPointer.x - x;
		const hitY = hitPointer.y - y;

		// Based on the PageNavigator's direction and where in the window the user tap lied in,
		// decide whether the tap was a forward, center or backward tap
		this._handleDiscontinuousGesture(true, (hitX >= width - referenceXLength),
			(hitX <= referenceXLength), (hitY >= height - referenceYLength),
			(hitY <= referenceYLength), this._doOnCenterTap);
	}

	_handleDiscontinuousGesture(expression, goRightIntentExpression, goLeftIntentExpression,
		goDownIntentExpression, goUpIntentExpression, doOtherwise = null) {
		if (this.canConsiderInteractions === false) {
			return
		}

		const { currentPage } = this.pageNavigator;
		const { hitZoneToPrevious, hitZoneToNext, secondaryAxis } = currentPage || {};

		let { goForward, goBackward, goSidewaysIfPossible } = this.pageNavigator;
		goForward = goForward.bind(this.pageNavigator);
		goBackward = goBackward.bind(this.pageNavigator);
		goSidewaysIfPossible = goSidewaysIfPossible.bind(this.pageNavigator);

		if ((expression === goRightIntentExpression && hitZoneToNext === "right")
			|| (expression === goLeftIntentExpression && hitZoneToNext === "left")
			|| (expression === goDownIntentExpression && hitZoneToNext === "bottom")
			|| (expression === goUpIntentExpression && hitZoneToNext === "top")) {
			goForward();
		} else if ((expression === goRightIntentExpression && hitZoneToPrevious === "right")
			|| (expression === goLeftIntentExpression && hitZoneToPrevious === "left")
			|| (expression === goDownIntentExpression && hitZoneToPrevious === "bottom")
			|| (expression === goUpIntentExpression && hitZoneToPrevious === "top")) {
			goBackward();
		} else if (
			!(secondaryAxis === "x" && expression === goRightIntentExpression
				&& goSidewaysIfPossible("right") === true)
			&& !(secondaryAxis === "x" && expression === goLeftIntentExpression
				&& goSidewaysIfPossible("left") === true)
			&& !(secondaryAxis === "y" && expression === goDownIntentExpression
				&& goSidewaysIfPossible("down") === true)
			&& !(secondaryAxis === "y" && expression === goUpIntentExpression
				&& goSidewaysIfPossible("up") === true)
			&& doOtherwise) {
			doOtherwise();
		}
	}

	setStoryInteractions(options) {
		const {
			doOnCenterTap,
			allowsWheelScroll,
			allowsZoomOnCtrlOrAltScroll,
			allowsZoomOnDoubleTap,
			allowsSwipe,
			isPaginationSticky,
		} = options;

		this._doOnCenterTap = doOnCenterTap;

		const shouldReturnDefaultValue = true;
		this._allowsSwipe = returnValidValue("allowsSwipe", allowsSwipe, shouldReturnDefaultValue);
		this._allowsWheelScroll = returnValidValue("allowsWheelScroll", allowsWheelScroll,
			shouldReturnDefaultValue);
		this._allowsZoomOnDoubleTap = returnValidValue("allowsZoomOnDoubleTap", allowsZoomOnDoubleTap,
			shouldReturnDefaultValue);
		this._allowsZoomOnCtrlOrAltScroll = returnValidValue("allowsZoomOnCtrlOrAltScroll",
			allowsZoomOnCtrlOrAltScroll, shouldReturnDefaultValue);
		this._isPaginationSticky = returnValidValue("isPaginationSticky", isPaginationSticky,
			shouldReturnDefaultValue);

		// Implement key press handling
		this._handleKeyUp = this._handleKeyUp.bind(this);
		window.addEventListener("keyup", this._handleKeyUp);

		// Implement zoom handling if relevant

		// Implement pinch detection for touch devices
		const pinch = new Hammer__namespace.Pinch();
		this._mc.add(pinch);
		this._handlePinch = this._handlePinch.bind(this);
		this._mc.on("pinch", this._handlePinch);

		if (this._allowsZoomOnDoubleTap === true) {

			// Implement single and double tap detection
			const doubleTap = new Hammer__namespace.Tap({ event: "doubletap", taps: 2 });
			this._mc.add([doubleTap, this._singleTap]);
			this._singleTap.requireFailure(doubleTap);
			doubleTap.recognizeWith(this._singleTap);

			// Only finalize the implementation of single tap detection at this stage
			this._handleDoubleTap = this._handleDoubleTap.bind(this);
			this._mc.on("doubletap", this._handleDoubleTap);
		}

		// Note that zooming may also be possible via ctrl/alt + scroll

		// Implement swipe detection if relevant
		if (this._allowsSwipe === true) {
			const swipe = new Hammer__namespace.Swipe({
				direction: Hammer__namespace.DIRECTION_ALL,
				velocity: 0.3, // Default value is 0.3
			});
			this._mc.add(swipe);
			this._handleSwipe = this._handleSwipe.bind(this);
			this._mc.on("swipeleft swiperight swipeup swipedown", this._handleSwipe);
		}

		// Implement non-wheel (= pan) scroll detection

		const pan = new Hammer__namespace.Pan({ direction: Hammer__namespace.DIRECTION_ALL });
		this._mc.add(pan);
		this._onNonWheelScroll = this._onNonWheelScroll.bind(this);
		this._mc.on("panleft panright panup pandown panend", this._onNonWheelScroll);

		// Implement wheel scroll detection if relevant
		if (this._allowsWheelScroll === true) {
			this._onWheelScroll = this._onWheelScroll.bind(this);
			this._rootElement.addEventListener("wheel", this._onWheelScroll);
		}

		// Reset scroll (works for both wheel and non-wheel scroll)
		this._resetScroll();
	}

	// Double tap is used to trigger the "quick change" zoom (switching zoomFactor at once
	// between the values of 1 and MAX_ZOOM_FACTOR - the value defined in constants.js)
	_handleDoubleTap(e) {
		if (this.canConsiderInteractions === false) {
			return
		}
		const touchPoint = e.center;
		const zoomData = { isContinuous: false, touchPoint };
		this._player.zoom(zoomData);
	}

	_handlePinch(e) {
		if (this.canConsiderInteractions === false) {
			return
		}
		if (e.type === "pinchend") {
			this._lastDistance = null;
		} else {
			const { viewportRect } = this._player;
			const pointers = [
				{ x: viewportRect.width / 2, y: viewportRect.height / 2 },
				{ x: e.center.x, y: e.center.y },
			];
			const distance = getDistance(pointers[0], pointers[1]);
			if (!this._lastDistance) {
				this._lastDistance = distance;
			} else if (this._lastDistance > 0) {
				const touchPoint = {
					x: (pointers[0].x + pointers[1].x) / 2,
					y: (pointers[0].y + pointers[1].y) / 2,
				};
				const zoomData = {
					isContinuous: true,
					touchPoint,
					multiplier: distance / this._lastDistance,
				};
				this._player.zoom(zoomData);
				this._lastDistance = distance;
			}
		}
	}

	_handleKeyUp(e) {
		this._handleDiscontinuousGesture(e.code, "ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp");
	}

	_handleSwipe(e) {
		this._handleDiscontinuousGesture(e.type, "swipeleft", "swiperight", "swipeup", "swipedown");
	}

	// For touch-device and mouse click-and-drag scroll events
	_onNonWheelScroll(e) {
		requestAnimationFrame(() => {
			if (this.canConsiderInteractions === false) {
				return
			}
			const {
				srcEvent,
				type,
				center,
				deltaX,
				deltaY,
			} = e;

			// For a zoom non-wheel scroll (i.e. ctrl/alt + non-wheel scroll)
			if ((srcEvent.ctrlKey || srcEvent.altKey)
				&& this._allowsZoomOnCtrlOrAltScroll === true) {

				// Store the coordinates of the first touch point of the gesture
				if (!this._initialTouchPoint) {
					this._initialTouchPoint = center;
				}

				// If the gesture has finished, reset zoom handling information
				if (type === "panend") {
					this._resetScroll();
					this._initialTouchPoint = null;

				// If the gesture is going on, send zoom data to the current page navigator
				} else {
					const zoomData = {
						isContinuous: true,
						touchPoint: this._initialTouchPoint,
						delta: deltaY - this._lastScrollEvent.deltaY,
					};
					this._player.zoom(zoomData);
					this._lastScrollEvent = e;
				}

			// When a non-zoom non-wheel scroll ends
			} else if (type === "panend") {
				// If this event immediately follows a panend, cancel it
				if (this._wasLastEventPanend === true) {
					return
				}

				// Attempt to end a controlled transition; if it fails (because none was currently
				// under way), attempt a sticky page change if possible; if it fails as well (if
				// viewportPercent was not enough), then only trigger a drag end (via _releaseScroll)
				let viewportPercent = this._percentFunction(e.deltaX, e.deltaY);
				viewportPercent = Math.min(Math.max(viewportPercent, -1), 1);

				if (this.pageNavigator.endControlledTransition(viewportPercent) === false
					&& (this._isPaginationSticky === false
					|| this.pageNavigator.attemptStickyStep() === false)) {
					this._releaseScroll(e);
				}

				this._resetScroll();
				this._wasLastEventPanend = true;

			// For normal non-wheel scroll
			} else {
				const { currentPage } = this.pageNavigator;
				const { inScrollDirection } = currentPage;

				const { viewportRect } = this._player;
				const { width, height } = viewportRect;
				const { VIEWPORT_DIMENSION_PERCENT } = constants;

				switch (inScrollDirection) {
				case "ltr":
					this._percentFunction = (dx) => (-dx / (width * VIEWPORT_DIMENSION_PERCENT));
					break
				case "rtl":
					this._percentFunction = (dx) => (dx / (width * VIEWPORT_DIMENSION_PERCENT));
					break
				case "ttb":
					this._percentFunction = (_, dy) => (-dy / (height * VIEWPORT_DIMENSION_PERCENT));
					break
				case "btt":
					this._percentFunction = (_, dy) => (dy / (height * VIEWPORT_DIMENSION_PERCENT));
					break
				}

				let viewportPercent = this._percentFunction(deltaX, deltaY);
				viewportPercent = Math.min(Math.max(viewportPercent, -1), 1);

				const scrollEvent = {
					deltaX: deltaX - this._lastScrollEvent.deltaX,
					deltaY: deltaY - this._lastScrollEvent.deltaY,
					viewportPercent,
				};
				const isWheelScroll = false;
				this._scroll(scrollEvent, isWheelScroll);
				this._lastScrollEvent = e;
				this._wasLastEventPanend = false;
			}
		});
	}

	_resetScroll() {
		this._lastScrollEvent = {
			deltaX: 0,
			deltaY: 0,
			viewportPercent: 0,
		};
	}

	// Record velocity and timestamp on drag end (i.e. on scroll release)
	_releaseScroll(e) {
		const velocity = {
			x: -e.velocityX * VELOCITY_FACTOR,
			y: -e.velocityY * VELOCITY_FACTOR,
		};
		const releaseDate = Date.now();
		this._autoScroll(velocity, releaseDate, e);
	}

	// Apply kinetic scrolling formula after drag end (i.e. on scroll release)
	_autoScroll(velocity, releaseDate) {
		const elapsedTime = Date.now() - releaseDate;
		let deltaX = -velocity.x * Math.exp(-elapsedTime / TIME_CONSTANT);
		let deltaY = -velocity.y * Math.exp(-elapsedTime / TIME_CONSTANT);

		// Simple hack to allow for a smoother stop (using half pixels)
		if (Math.abs(deltaX) < 1 || Math.abs(deltaY) < 1) {
			deltaX = Math.round(deltaX * 2) / 2;
			deltaY = Math.round(deltaY * 2) / 2;
		} else {
			deltaX = Math.round(deltaX);
			deltaY = Math.round(deltaY);
		}
		if (Math.abs(deltaX) >= 0.5 || Math.abs(deltaY) >= 0.5) {
			// On a drag end, viewportPercent information is useless
			this._scroll({ deltaX, deltaY });
			requestAnimationFrame(this._autoScroll.bind(this, velocity, releaseDate));
		}
	}

	// Apply scroll to the current page via the pageNavigator
	_scroll(e, isWheelScroll) {
		if (this.canConsiderInteractions === false) {
			return
		}
		const { deltaX, deltaY, viewportPercent } = e;
		this.pageNavigator.handleScroll({ deltaX, deltaY, viewportPercent }, isWheelScroll);
	}

	// For mouse and trackpad scroll events
	_onWheelScroll(e) {
		e.preventDefault();
		requestAnimationFrame(() => {
			if (this.canConsiderInteractions === false) {
				return
			}
			if ((e.ctrlKey || e.altKey)
				&& this._allowsZoomOnCtrlOrAltScroll === true) {
				const zoomData = {
					isContinuous: true,
					touchPoint: { x: e.x, y: e.y },
					delta: e.deltaY,
				};
				this._player.zoom(zoomData);

			} else {
				// There is no end to a wheel event, so no viewportPercent information
				// can be constructed to attempt a sticky page change
				const isWheelScroll = true;
				const { direction } = this.pageNavigator;
				// If the story's direction is ltr or rtl, then an "actual" mouse wheel
				// should prompt the story to move forward/backward
				if ((direction === "ltr" || direction === "rtl") && e.deltaX === 0) {
					const sign = (direction === "rtl") ? 1 : -1;
					this._scroll({ deltaX: sign * e.deltaY, deltaY: 0 }, isWheelScroll);
				} else {
					this._scroll({ deltaX: -e.deltaX, deltaY: -e.deltaY }, isWheelScroll);
				}
			}
		});
	}

	// For button hits

	goRight() {
		this._handleDiscontinuousGesture(true, true, false, false, false);
	}

	goLeft() {
		this._handleDiscontinuousGesture(true, false, true, false, false);
	}

	goDown() {
		this._handleDiscontinuousGesture(true, false, false, true, false);
	}

	goUp() {
		this._handleDiscontinuousGesture(true, false, false, false, true);
	}

	// Remove all event listeners on destroy
	destroy() {
		this._mc.off("singletap", this._handleSingleTap);
		this._mc.off("doubletap", this._handleDoubleTap);
		this._mc.off("pinch", this._handlePinch);
		this._mc.off("swipeleft swiperight swipeup swipedown", this._handleSwipe);
		this._mc.off("panleft panright panup pandown panend", this._onNonWheelScroll);
		this._rootElement.removeEventListener("wheel", this._onWheelScroll);
		window.removeEventListener("keyup", this._handleKeyUp);
	}

}

class CoreResource {

	get id() { return this._id }

	get type() { return this._type }

	get mimeType() { return this._mimeType }

	get path() { return this._path }

	get loadStatus() { return this._loadStatus }

	// Used in Slice

	get width() { return this._width }

	get height() { return this._height }

	get fallbacksArray() { return this._fallbacksArray }

	// Used in AudioResource
	get player() { return this._player }

	// Used in Player
	get tags() { return this._tags }

	// Used in ResourceManager

	get hasNotStartedLoading() { return (this._loadStatus === 0) }

	get hasLoadedSomething() { return (this._loadStatus === -1 || this._loadStatus === 2) }

	// Used in AudioResource
	set loadStatus(loadStatus) { this._loadStatus = loadStatus; }

	static get counter() {
		CoreResource._counter = (CoreResource._counter === undefined)
			? 0
			: (CoreResource._counter + 1);
		return CoreResource._counter
	}

	constructor(coreResourceData, player) {
		this._id = CoreResource.counter;
		this._player = player;

		const {
			type, mimeType, path, width, height, fallbacksArray,
		} = coreResourceData;

		this._type = type;
		this._mimeType = mimeType;
		this._path = path;
		if (width) {
			this._width = width;
		}
		if (height) {
			this._height = height;
		}
		if (fallbacksArray) {
			this._fallbacksArray = fallbacksArray;
		}

		this._tags = {};
		POSSIBLE_TAG_NAMES.forEach((tagName) => {
			const tagValue = coreResourceData[tagName];
			if (tagValue !== undefined) {
				this._tags[tagName] = tagValue;
			}
		});

		this._loadStatus = 0;
	}

	notifyLoadStart() {
		if (this._loadStatus === 0) {
			this._loadStatus = 1;
		}
	}

	cancelLoad() {
		this._loadStatus = 0;
	}

	forceDestroy() {
		this._loadStatus = 0;
	}

}

class TextureResource extends CoreResource {

	constructor(coreResourceData, player) {
		super(coreResourceData, player);

		this._baseTexture = null;
		this._textures = {}; // Textures represent cropped versions of baseTexture, by fragment

		this.addOrUpdateFragment("full");
	}

	// Used above (in which case sliceId is undefined) and in ResourceManager
	addOrUpdateFragment(fragment = "full", sliceId) {
		if (!this._textures[fragment]) {
			this._textures[fragment] = {
				texture: null,
				sliceIdsSet: new Set(),
			};
		}

		// On a readingMode change, the baseTexture may already be present,
		// so adding new fragments implies that the corresponding textures be created
		if (this._baseTexture && this._textures.full && this._textures.full.texture
			&& !this._textures[fragment].texture) {
			const fullTexture = this._textures.full.texture;
			const croppedTexture = Texture.cropToFragment(fullTexture, fragment);
			this._textures[fragment].texture = croppedTexture;
		}

		if (sliceId !== undefined) {
			this._textures[fragment].sliceIdsSet.add(sliceId);
		}
	}

	resetSliceIdsSets() {
		Object.keys(this._textures).forEach((fragment) => {
			this._textures[fragment].sliceIdsSet = new Set();
		});
	}

	cancelLoad(slices) {
		Object.values(this._textures).forEach(({ sliceIdsSet }) => {
			sliceIdsSet.forEach((sliceId) => {
				const slice = slices[sliceId];
				slice.cancelTextureLoad();
			});
		});
		super.cancelLoad();
	}

	setActualTexture(textureData) { // textureData = { name, texture }
		if (this.loadStatus === 0 // If loading was cancelled
			|| !textureData || !textureData.texture
			|| !textureData.texture.base || !textureData.texture.full) {
			return
		}
		const { texture } = textureData;
		const { base, full } = texture;
		this._baseTexture = base;

		// If loading has failed...
		if (this.loadStatus === -1) {

			// ...then if a fallback was defined, and it is to be cropped,
			// store the cropped (fragment) texture directly everywhere
			if (this._fallbackFragment) {
				const croppedTexture = Texture.cropToFragment(full, this._fallbackFragment);
				Object.keys(this._textures).forEach((fragment) => {
					this._textures[fragment].texture = croppedTexture;
				});

			// ...otherwise do with the full texture
			} else {
				this._setFullTextureAndCreateFragmentsIfNeeded(full);
			}

		// ...otherwise loadStatus = 1 and loading has succeeded, so proceed with the full texture
		} else {
			this._setFullTextureAndCreateFragmentsIfNeeded(full);
			this.loadStatus = 2;
		}
	}

	_setFullTextureAndCreateFragmentsIfNeeded(fullTexture) {
		this._textures.full.texture = fullTexture;
		this._createFragmentsIfNeeded(fullTexture);
	}

	_createFragmentsIfNeeded(fullTexture) {
		Object.keys(this._textures).forEach((fragment) => {
			if (fragment !== "full") {
				const croppedTexture = Texture.cropToFragment(fullTexture, fragment);
				this._textures[fragment].texture = croppedTexture;
			}
		});
	}

	applyAllTextures(slices) {
		const fullTexture = this._textures.full.texture;
		Object.values(this._textures).forEach(({ texture, sliceIdsSet }) => {
			sliceIdsSet.forEach((sliceId) => {
				const slice = slices[sliceId];
				if (slice) {
					const sliceTexture = (this.loadStatus === -1) ? fullTexture : texture;
					const isAFallback = (this.loadStatus === -1);
					slice.updateTextures(sliceTexture, isAFallback);
				}
			});
		});
	}

	// Used for a SequenceSlice only
	getTextureForFragment(fragment = null) {
		const actualFragment = (this.loadStatus !== -1 && fragment) ? fragment : "full";
		const { texture } = this._textures[actualFragment] || {};
		if (!texture) {
			return null
		}
		return texture
	}

	destroyIfPossible(forceDestroy = false, slices) {
		if (this.loadStatus === 0) {
			return
		}
		const canBeDestroyed = (forceDestroy === true)
			|| (this._checkIfCanBeDestroyed(slices) === true);
		if (canBeDestroyed === true) {
			this._forceDestroy(slices); // A different function for video and basic texture resources
		}
	}

	_checkIfCanBeDestroyed(slices) {
		let canBeDestroyed = true;
		Object.values(this._textures).forEach((fragmentData) => {
			const { sliceIdsSet } = fragmentData;
			sliceIdsSet.forEach((sliceId) => {
				const slice = slices[sliceId];
				if (slice) {
					const { isActive } = slice;
					if (isActive === true) {
						canBeDestroyed = false;
					}
				}
			});
		});
		return canBeDestroyed
	}

	_forceDestroy(slices) {
		this.forceDestroyTextures(slices);
	}

	// Used above and in VideoTextureResource
	forceDestroyTextures(slices) {
		Object.entries(this._textures).forEach(([fragment, fragmentData]) => {
			const { texture, sliceIdsSet } = fragmentData;
			if (texture) {
				sliceIdsSet.forEach((sliceId) => {
					const slice = slices[sliceId];
					if (slice) {
						slice.removeTexture();
					}
				});
				if (texture.destroy) {
					texture.destroy();
				}
				this._textures[fragment].texture = null;
			}
		});
		if (this._baseTexture && this._baseTexture.destroy) {
			this._baseTexture.destroy();
		}
		this._baseTexture = null;

		this.forceDestroy(); // CoreResource's function!
	}

}

class VideoTextureResource extends TextureResource {

	constructor(coreResourceData, player) {
		super(coreResourceData, player);

		this._type = "video";

		this._video = null;
		this._timeout = null;
		this._doOnLoadSuccess = null;
		this._doOnLoadFail = null;
		this._fallbackFragment = null;
	}

	attemptToLoadVideo(src, doOnVideoLoadSuccess, doOnVideoLoadFail, videoLoadTimeout,
		allowsParallel, resolve) {

		// Create video element
		const video = document.createElement("video");
		video.preload = "auto";
		video.loop = true; // All videos will loop by default
		video.autoplay = false; // Prevent autoplay at start
		video.muted = true; // Only a muted video can autoplay
		video.setAttribute("playsinline", ""); // Required to play in iOS
		video.crossOrigin = "anonymous";
		video.src = src;
		this._video = video;

		const doOnLoadFail = () => {
			const forceFailIfNeeded = false;
			this._clear(forceFailIfNeeded);

			if (doOnVideoLoadFail && this.fallbacksArray.length > 0) {
				this.loadStatus = -1;

				// Let's create the baseTexture from the appropriate fallback image
				// (note that we don't care that the type will not be the right one anymore!)

				const { path, fragment } = this.player.getBestMatchForCurrentTags(this.fallbacksArray);
				if (fragment) {
					this._fallbackFragment = fragment;
				}

				const fallbackPath = path;
				doOnVideoLoadFail(resolve, fallbackPath);

			} else {
				this.loadStatus = 0;
				resolve();
			}
		};
		this._doOnLoadFail = doOnLoadFail;
		video.addEventListener("error", doOnLoadFail);

		// Event to track should be loadedmetadata, but duration change proved more reliable
		const doOnLoadSuccess = () => {
			this._doOnDurationChange(resolve, doOnVideoLoadSuccess);
		};
		this._doOnLoadSuccess = doOnLoadSuccess;
		video.addEventListener("durationchange", doOnLoadSuccess);

		// If resources are loaded serially, a failing video load should not block loading
		if (allowsParallel === false) {
			this._timeout = setTimeout(doOnLoadFail, videoLoadTimeout);
		}
	}

	_clear(forceFailIfNeeded) {
		this._removeTracesOfVideoLoad(forceFailIfNeeded);
		this._video = null;
	}

	_removeTracesOfVideoLoad(forceFailIfNeeded) {
		if (this._timeout) {
			clearTimeout(this._timeout);
			this._timeout = null;
			if (forceFailIfNeeded === true) {
				this._doOnLoadFail();
			}
		}
		if (this._video && this._doOnLoadFail) {
			this._video.removeEventListener("error", this._doOnLoadFail);
		}
		this._doOnLoadFail = null;
		if (this._video && this._doOnLoadSuccess) {
			this._video.removeEventListener("durationchange", this._doOnLoadSuccess);
		}
		this._doOnLoadSuccess = null;
		this._fallbackFragment = null;
	}

	// Once a video's duration is different from zero, get useful information
	_doOnDurationChange(resolve, doOnVideoLoadSuccess) {
		const { duration } = this._video || {};

		if (this.loadStatus !== 0 // Loading may indeed have been cancelled
			&& duration && doOnVideoLoadSuccess) {
			this._removeTracesOfVideoLoad(); // But keep this._video, so don't clear()!

			const { baseTexture, texture } = Texture.createVideoTexture(this._video);
			const textureData = {
				resourceId: this.id,
				texture: {
					base: baseTexture,
					full: texture,
				},
			};

			doOnVideoLoadSuccess(resolve, textureData);

		// If the video failed loading
		} else if (this._doOnLoadFail) {
			this._doOnLoadFail();
		}
	}

	cancelLoad(slices) {
		const forceFailIfNeeded = true;
		this._clear(forceFailIfNeeded);
		super.cancelLoad(slices);
	}

	_forceDestroy(slices) {
		const forceFailIfNeeded = true;
		this._clear(forceFailIfNeeded);
		this.forceDestroyTextures(slices);
	}

}

class AudioResource extends CoreResource {

	// Used in Timer
	get shouldPlay() { return this._shouldPlay }

	constructor(coreResourceData, player) {
		super(coreResourceData, player);

		this._type = "audio";

		this._audio = null;
		this._timeout = null;
		this._doOnLoadSuccess = null;
		this._doOnLoadFail = null;

		const { looping } = coreResourceData;
		this._looping = looping;

		this._shouldPlay = false;
		this._hasPlayedOnceInPage = false;
	}

	attemptToLoadAudio(src, doOnAudioLoadSuccess, audioLoadTimeout, allowsParallel, resolve) {

		this._hasPlayedOnceInPage = false;

		// Create audio element
		const audio = document.createElement("audio");
		audio.preload = "auto";
		audio.autoplay = false; // Prevent autoplay at start
		audio.setAttribute("playsinline", ""); // Required to play in iOS
		audio.crossOrigin = "anonymous";
		audio.loop = this._looping;
		audio.src = src;
		this._audio = audio;

		const doOnLoadFail = () => {
			this._clear();
			this.loadStatus = 0;
			resolve();
		};
		this._doOnLoadFail = doOnLoadFail;
		audio.addEventListener("error", doOnLoadFail);

		// Event to track should be loadedmetadata, but duration change proved more reliable
		const doOnLoadSuccess = () => {
			this._doOnDurationChange(doOnAudioLoadSuccess);
		};
		this._doOnLoadSuccess = doOnLoadSuccess;
		audio.addEventListener("durationchange", doOnLoadSuccess);

		// If resources are loaded serially, a failing audio load should not block loading
		if (allowsParallel === false) {
			this._timeout = setTimeout(doOnLoadFail, audioLoadTimeout);
		}
	}

	mute() {
		if (!this._audio) {
			return
		}
		this._audio.volume = 0;
	}

	unmute() {
		if (!this._audio) {
			return
		}
		this._audio.volume = 0.2;
		if (this._shouldPlay === true) {
			const shouldCheckVolume = false;
			this._play(shouldCheckVolume);
		}
	}

	_play(shouldCheckVolume = true) {
		if (!this._audio || this._hasPlayedOnceInPage === true) {
			return
		}

		// Deal with volume
		if (shouldCheckVolume === true) {
			const { isMuted } = this.player;
			this._audio.volume = (isMuted === true) ? 0 : 0.2;
		}

		const playPromise = this._audio.play();
		if (playPromise !== undefined) {
			playPromise.then(() => {
				// Play
			}).catch(() => {
				// Caught error prevents play
			});
		}
	}

	_clear() {
		this._removeTracesOfAudioLoad();
		if (this._doOnEnded) {
			this._audio.removeEventListener("ended", this._doOnEnded);
		}
		this._audio = null;
	}

	_removeTracesOfAudioLoad() {
		clearTimeout(this._timeout);
		this._timeout = null;
		if (this._audio && this._doOnLoadFail) {
			this._audio.removeEventListener("error", this._doOnLoadFail);
		}
		this._doOnLoadFail = null;
		if (this._audio && this._doOnLoadSuccess) {
			this._audio.removeEventListener("durationchange", this._doOnLoadSuccess);
		}
		this._doOnLoadSuccess = null;
	}

	// Once an audio's duration is different from zero, get useful information
	_doOnDurationChange(doOnAudioLoadSuccess) {
		if (this.loadStatus === 0) { // If loading was cancelled
			this._clear();
			return
		}

		const { duration } = this._audio;

		if (duration && doOnAudioLoadSuccess) {
			this._removeTracesOfAudioLoad();

			if (this._looping === false) {
				this._doOnEnded = () => {
					this._hasPlayedOnceInPage = true;
				};
				this._audio.addEventListener("ended", this._doOnEnded);
			}

			if (this._shouldPlay === true) {
				this._play();
			}

			doOnAudioLoadSuccess();

		// If the audio failed loading
		} else if (this._doOnLoadFail) {
			this._doOnLoadFail();
		}
	}

	playIfNeeded() {
		if (this._shouldPlay === true) {
			return
		}
		this._shouldPlay = true;
		this._play();
	}

	stopIfNeeded() {
		this._shouldPlay = false;
		if (!this._audio) {
			return
		}
		this._audio.pause();
		this._audio.currentTime = 0;
	}

	resetForPlay() {
		this._shouldPlay = false;
		this._hasPlayedOnceInPage = false;
		if (!this._audio) {
			return
		}
		this._audio.pause();
		this._audio.currentTime = 0;
	}

	cancelLoad() {
		this._clear();
		super.cancelLoad();
	}

	forceDestroy() {
		this._clear();
		super.forceDestroy();
	}

}

class AsyncTaskQueue {

	get nbOfTasks() { return this._tasksArray.length }

	constructor(maxPriority, allowsParallel, getPriorityFromTaskData) {
		this._maxPriority = maxPriority;
		this._allowsParallel = allowsParallel;
		this._getPriorityFromTaskData = getPriorityFromTaskData;

		this._tasksArray = [];
		this.reset();

		this._doAfterEachInitialTask = null;

		this._hasStarted = false;
	}

	reset() {
		this._tasksArray.forEach((task) => { task.kill(); });

		// Useful in serial mode only
		this._isRunning = false;
	}

	updatePriorities() {
		this._tasksArray.forEach((task, i) => {
			const priority = this._getPriorityAndUpdateTaskIfRelevant(task, task.data);

			// In parallel mode, remove task if relevant
			if (this._allowsParallel === true && priority > this._maxPriority) {
				task.kill();
				this._tasksArray.splice(i, 1);
			}
		});
	}

	_getPriorityAndUpdateTaskIfRelevant(task, data) {
		const { priority, forcedPriority } = task;
		if (forcedPriority !== null) {
			return forcedPriority
		}
		const possiblyNewPriority = (this._getPriorityFromTaskData)
			? this._getPriorityFromTaskData(data)
			: 0;
		if (priority === null || possiblyNewPriority <= priority) {
			task.setData(data);
			task.setPriority(possiblyNewPriority);
		}
		return possiblyNewPriority
	}

	addTask(task) {
		const priority = this._getPriorityAndUpdateTaskIfRelevant(task, task.data);
		if (this._allowsParallel === false) {
			this._tasksArray.push(task);
			if (this._hasStarted === true && this._isRunning === false) {
				this._runNextTaskInQueue();
			}
		} else if (priority <= this._maxPriority) {
			this._tasksArray.push(task);
			if (this._hasStarted === true) {
				this._runTask(task);
			}
		}
	}

	updateTaskWithData(task, data) { // The task cannot be running already at this stage
		this._getPriorityAndUpdateTaskIfRelevant(task, data);
	}

	_runTask(task) {
		if (this._allowsParallel === false) {
			this._isRunning = true;
		}

		const doAtTheVeryEnd = () => {
			// Remove task from list
			const { id } = task;
			const index = this._tasksArray.findIndex((arrayTask) => (arrayTask.id === id));
			this._tasksArray.splice(index, 1);

			// If was an initial task, check whether all initial tasks have been run
			if (this._doAfterEachInitialTask) {
				this._doAfterEachInitialTask();
			}

			if (this._allowsParallel === false) {
				this._isRunning = false;
				this._runNextTaskInQueue();
			}
		};

		task.run(doAtTheVeryEnd);
	}

	_runNextTaskInQueue() { // In serial mode only
		if (this.nbOfTasks === 0 || this._isRunning === true) {
			return
		}
		const nextTask = this._getTaskWithHighestPriority();
		if (!nextTask) {
			return
		}
		this._runTask(nextTask);
	}

	_getTaskWithHighestPriority() { // Actually the *lowest* possible value for the priority key ;)
		let nextTask = null;
		this._tasksArray.forEach((task) => {
			const { priority } = task;
			if (!nextTask || priority < nextTask.priority) {
				nextTask = task;
			}
		});
		return nextTask
	}

	setDoAfterEachInitialTask(doAfterEachInitialTask) {
		this._doAfterEachInitialTask = doAfterEachInitialTask;
	}

	start() {
		this._hasStarted = true;
		if (this._allowsParallel === true) {
			this._tasksArray.forEach((task) => {
				this._runTask(task);
			});
		} else {
			this._runNextTaskInQueue();
		}
	}

	getTaskWithId(id) {
		const foundTask = this._tasksArray.find((task) => (task.id === id));
		return foundTask
	}

}

class ResourceLoadTaskQueue extends AsyncTaskQueue {

	constructor(loadingMode, maxPriority, allowsParallel, priorityFactor) {

		// Task priorities will be evaluated based on segment differences (absolute segmentIndex)
		const getPriorityFromTaskData = (data) => {
			let priority = 0;
			if (!data || data.segmentIndex === null || data.pageIndex === null
				|| this._targetIndex === null) {
				return priority
			}
			const taskIndex = (loadingMode === "segment") ? data.segmentIndex : data.pageIndex;
			priority = taskIndex - this._targetIndex;

			if (priority < 0) {
				if (priorityFactor) {
					priority *= -priorityFactor;
					priority = Math.ceil(priority);
				} else {
					priority = -priority;
				}
			}
			return priority
		};

		super(maxPriority, allowsParallel, getPriorityFromTaskData);

		this._loadingMode = loadingMode;
		this._targetIndex = null;
	}

	updatePriorities(targetPageIndex, targetSegmentIndex) {
		this._targetIndex = (this._loadingMode === "segment") ? targetSegmentIndex : targetPageIndex;
		super.updatePriorities();
	}

}

class Task {

	// Used in AsyncTaskQueue

	get id() { return this._id }

	get data() { return this._data }

	get priority() { return this._priority }

	get forcedPriority() { return this._forcedPriority }

	constructor(id, data, doAsync, doOnEnd, doOnKill, forcedPriority) {
		this._id = id;
		this.setData(data);
		this._doAsync = doAsync;
		this._doOnEnd = doOnEnd;
		this._doOnKill = doOnKill;
		this._forcedPriority = (forcedPriority !== undefined) ? forcedPriority : null;

		this._priority = this._forcedPriority;
		this._isRunning = false;
	}

	setData(data) {
		this._data = data;
	}

	setPriority(priority) {
		this._priority = priority;
	}

	run(doAtTheVeryEnd) {
		this._isRunning = true;

		const callback = () => {
			this._isRunning = false;
			if (this._doOnEnd) {
				this._doOnEnd();
			}
			if (doAtTheVeryEnd) {
				doAtTheVeryEnd();
			}
		};

		if (this._doAsync) {
			this._doAsync()
				.then(callback)
				.catch(() => {
					callback();
				});
		} else {
			callback();
		}
	}

	kill() {
		if (this._isRunning === true && this._doOnKill) {
			this._doOnKill();
		}
		this._isRunning = false;
	}

}

class ResourceManager {

	// Used in PageNavigator

	get loadingMode() { return this._loadingMode }

	get allowsDestroy() { return this._allowsDestroy }

	get maxNbOfUnitsToLoadAfter() { return this._maxNbOfUnitsToLoadAfter }

	get maxNbOfUnitsToLoadBefore() { return this._maxNbOfUnitsToLoadBefore }

	// Used in Player

	get haveFirstResourcesLoaded() { return this._haveAllInitialTasksRun }

	constructor(player) {
		this._player = player;

		this._doWithLoadPercentChange = null;
		this._resourceSource = {};

		this._resources = {};

		this._taskQueue = null;

		this._haveAllInitialTasksRun = false;
		this._nbOfCompletedTasks = 0;

		this._maxNbOfUnitsToLoadAfter = 0;
		this._maxNbOfUnitsToLoadBefore = 0;
	}

	getResourceId(coreResourceData) {
		const { type, path } = coreResourceData || {};
		if (!path || isAString(path) === false) {
			return null
		}

		// Check if a resource with the same path already exists, but consider it
		// only if it is an image (duplicates are allowed for video and audio resources)
		let resource = null;
		let i = 0;
		const resourcesArray = Object.values(this._resources);
		while (i < resourcesArray.length && !resource) {
			// Duplicates are not allowed for "image" and "audio" resources
			if (resourcesArray[i].path === path && type !== "video") {
				resource = resourcesArray[i];
			}
			i += 1;
		}

		if (!resource) { // Create and store new resource
			switch (type) {
			case "image":
				resource = new TextureResource(coreResourceData, this._player);
				break
			case "video":
				resource = new VideoTextureResource(coreResourceData, this._player);
				break
			case "audio":
				resource = new AudioResource(coreResourceData, this._player);
				break
			default:
				return null
			}
			this._resources[resource.id] = resource;
		}

		const { id } = resource;
		return id
	}

	getResourceWithId(resourceId) {
		return this._resources[resourceId] || {}
	}

	// Used in Player to configure ResourceManager
	setResourceSourceAndOptions(resourceSource, options) {
		this._resourceSource = resourceSource;

		const {
			loadingMode,
			allowsDestroy,
			allowsParallel,
			videoLoadTimeout = DEFAULT_VIDEO_LOAD_TIMEOUT,
		} = options || {};

		const shouldReturnDefaultValue = true;
		this._loadingMode = returnValidValue("loadingMode", loadingMode,
			shouldReturnDefaultValue);
		this._allowsDestroy = returnValidValue("allowsDestroy", allowsDestroy,
			shouldReturnDefaultValue);
		this._allowsParallel = returnValidValue("allowsParallel", allowsParallel,
			shouldReturnDefaultValue);
		this._videoLoadTimeout = videoLoadTimeout;

		let priorityFactor = 1;

		const { maxNbOfUnitsToLoadAfter } = options || {};

		if (maxNbOfUnitsToLoadAfter === null) { // If was explicitly set as null!
			this._maxNbOfUnitsToLoadAfter = null;
			this._maxNbOfUnitsToLoadBefore = null;
			priorityFactor = Math.max((1 / MIN_SHARE_OF_UNITS_TO_LOAD_BEFORE) - 1, 1);

		} else {
			this._maxNbOfUnitsToLoadAfter = (isANumber(maxNbOfUnitsToLoadAfter) === true
				&& maxNbOfUnitsToLoadAfter >= 0)
				? maxNbOfUnitsToLoadAfter
				: DEFAULT_MAX_NB_OF_UNITS_TO_LOAD_AFTER;
			this._maxNbOfUnitsToLoadAfter = Math.ceil(this._maxNbOfUnitsToLoadAfter);

			this._maxNbOfUnitsToLoadBefore = this._maxNbOfUnitsToLoadAfter;
			this._maxNbOfUnitsToLoadBefore *= MIN_SHARE_OF_UNITS_TO_LOAD_BEFORE;
			this._maxNbOfUnitsToLoadBefore = Math.ceil(this._maxNbOfUnitsToLoadBefore);

			priorityFactor = (this._maxNbOfUnitsToLoadAfter / this._maxNbOfUnitsToLoadBefore) || 1;
		}

		this._buildAsyncTaskQueue(priorityFactor);
	}

	_buildAsyncTaskQueue(priorityFactor) {
		const { slices } = this._player;
		const nbOfSlices = Object.keys(slices).length;
		const maxPriority = this._maxNbOfUnitsToLoadAfter || nbOfSlices;

		this._taskQueue = new ResourceLoadTaskQueue(this._loadingMode, maxPriority,
			this._allowsParallel, priorityFactor);
	}

	setDoWithLoadPercentChange(doWithLoadPercentChange) {
		if (!doWithLoadPercentChange) {
			return
		}
		this._doWithLoadPercentChange = doWithLoadPercentChange;
		this._doWithLoadPercentChange(0);
	}

	// Stop all loading tasks when setting (including changing) the page navigator (used in Player)
	killPendingLoads() {
		if (!this._taskQueue) {
			return
		}
		this._taskQueue.reset();
		// Note that killing all tasks will call their respective resource.cancelLoad()
		this._nbOfCompletedTasks = 0;
	}

	// Used in PageNavigator (way to update priorities for load tasks if some are still pending))
	updatePriorities(targetPageIndex, targetSegmentIndex) {
		this._taskQueue.updatePriorities(targetPageIndex, targetSegmentIndex);
	}

	// Used in PageNavigator (sliceResourceDataArray.length=1 except for a sequence)
	loadResources(sliceResourceDataArray, pageIndex, segmentIndex) {
		let taskId = null;

		const resourceIdsToLoadArray = [];
		sliceResourceDataArray.forEach(({ resourceId, fragment, sliceId }) => {
			if (this._resources[resourceId]) {
				const resource = this._resources[resourceId] || {};
				if (resource.type !== "audio") { // addOrUpdateFragment is only defined for a TextureResource
					resource.addOrUpdateFragment(fragment, sliceId);
				}

				// If has not started loading, start preparing the loading task
				if (resource.hasNotStartedLoading === true) {
					if (taskId === null) {
						taskId = String(resourceId);
					} else { // For a sequence, all images are loaded together as just one task
						taskId += String(resourceId);
					}
					resourceIdsToLoadArray.push(resourceId);
					resource.notifyLoadStart();

				// Otherwise if a texture has been loaded, ensure it is applied
				} else if (resource.hasLoadedSomething === true && resource.type !== "audio") {
					const { slices } = this._player;
					resource.applyAllTextures(slices);
				}
			}
		});

		const callback = () => {
			const { slices } = this._player;
			resourceIdsToLoadArray.forEach((resourceId) => {
				const resource = this._resources[resourceId];
				if (resource && resource.type !== "audio") {
					resource.applyAllTextures(slices);
				}
			});
		};
		// Note that callback will ensure slice.loadStatus=2 (or -1),
		// which will prevent re-triggering loadResourcesWithIds for the slice
		if (resourceIdsToLoadArray.length === 0) {
			callback();
			return
		}

		let task = this._taskQueue.getTaskWithId(taskId);
		const data = { pageIndex, segmentIndex };

		// Add resource load task to queue if not already in queue
		if (!task) {
			const loader = new Loader();
			const doAsync = () => this._loadResources(resourceIdsToLoadArray, loader);
			const doOnEnd = callback;
			const doOnKill = () => {
				// Cancel loading for resources not loaded yet (and thus change their load status)
				loader.reset();
				const { slices } = this._player;
				resourceIdsToLoadArray.forEach((resourceId) => {
					if (this._resources[resourceId]) {
						const resource = this._resources[resourceId];
						if (resource.hasLoadedSomething === false) {
							resource.cancelLoad(slices);
						}
					}
				});
			};
			task = new Task(taskId, data, doAsync, doOnEnd, doOnKill);
			this._taskQueue.addTask(task);

		// In serial mode, if task exists, update data to potentially update its priority
		} else if (this._allowsParallel === false) {
			this._taskQueue.updateTaskWithData(data);
		}
	}

	_loadResources(resourceIdsArray, loader) {
		return new Promise((resolve, reject) => {
			this._addResourcesToLoaderAndLoad(resourceIdsArray, loader, resolve, reject);
		})
	}

	_addResourcesToLoaderAndLoad(resourceIdsArray, loader, resolve, reject) {
		const firstResourceId = resourceIdsArray[0];
		const firstResource = this._resources[firstResourceId];
		if (!firstResource) {
			reject();
			return
		}

		if (firstResource.type === "audio" || firstResource.type === "video") {

			// Only consider a video if it is alone, i.e. not in a sequence
			// (more constraining than what the type itself allows)
			if (resourceIdsArray.length !== 1) {
				reject();
				return
			}

			const { path } = firstResource;
			const src = this._getSrc(path);

			if (firstResource.type === "audio") {
				const doOnAudioLoadSuccess = (data) => {
					this._acknowledgeResourceHandling([data], resolve);
				};
				firstResource.attemptToLoadAudio(src, doOnAudioLoadSuccess, this._videoLoadTimeout,
					this._allowsParallel, resolve);

			} else if (firstResource.type === "video") {
				const doOnVideoLoadSuccess = (resolve2, textureData) => {
					this._acknowledgeResourceHandling([textureData], resolve2);
				};
				const doOnVideoLoadFail = (resolve2, fallbackPath = null) => {
					if (fallbackPath) {
						const resourceData = { resourceId: firstResourceId, path, fallbackPath };
						this._addToLoaderAndLoad([resourceData], loader, resolve2);

					} else {
						const { slices } = this._player;
						firstResource.cancelLoad(slices);
						resolve2();
					}
				};

				firstResource.attemptToLoadVideo(src, doOnVideoLoadSuccess, doOnVideoLoadFail,
					this._videoLoadTimeout, this._allowsParallel, resolve);
			}

		} else {
			const resourceDataArray = [];
			resourceIdsArray.forEach((resourceId) => {
				if (this._resources[resourceId]) {
					const { type, path } = this._resources[resourceId];
					// Reminder: a sequence transition forces its resourcesArray
					// to only contain image types anyway
					if (type === "image") {
						resourceDataArray.push({ resourceId, path });
					}
				}
			});
			this._addToLoaderAndLoad(resourceDataArray, loader, resolve);
		}
	}

	_getSrc(path, fallbackPath = null) {
		let src = fallbackPath || path;

		const { folderPath, data } = this._resourceSource;

		// If src has a scheme, use the address as is, otherwise add folderPath as prefix
		if (folderPath && hasAScheme(src) === false) {
			src = `${folderPath}/${src}`;

		// If the story was opened with data (i.e. not from a folder)
		// and the resource is a video, use the dataURI as src
		} else if (data && data.base64DataByHref) {
			src = data.base64DataByHref[path];
		}

		return src
	}

	_addToLoaderAndLoad(resourceDataArray, loader, resolve) {
		resourceDataArray.forEach(({ resourceId, path, fallbackPath }) => {
			this._addToLoader(loader, resourceId, path, fallbackPath);
		});
		this._load(loader, resolve);
	}

	_addToLoader(loader, resourceId, path, fallbackPath = null) {
		const src = this._getSrc(path, fallbackPath);
		loader.add(resourceId, src);
	}

	_load(loader, resolve) {
		if (loader.hasTasks === true) {
			// If loading succeeds, move on
			loader.onComplete((dataArray) => {
				this._acknowledgeResourceHandling(dataArray, resolve);
			});
			loader.load();
		} else {
			this._acknowledgeResourceHandling(null, resolve);
		}
	}

	_acknowledgeResourceHandling(dataArray, resolve) {
		if (dataArray) {
			dataArray.forEach((textureData) => {
				const { resourceId } = textureData || {};
				if (resourceId !== undefined && this._resources[resourceId]
					&& this._resources[resourceId].type !== "audio") {
					const textureResource = this._resources[resourceId];
					textureResource.setActualTexture(textureData);
				}
			});
		}
		resolve();
	}

	// Used in Player
	runInitialTasks(doAfterRunningInitialTasks, forcedNb = null) {
		// Start the async queue with a function to handle a change in load percent
		this._nbOfCompletedTasks = 0;
		let nbOfTasks = forcedNb || this._taskQueue.nbOfTasks;
		nbOfTasks = Math.min(nbOfTasks, this._taskQueue.nbOfTasks);

		const doAfterEachInitialTask = () => {
			this._nbOfCompletedTasks += 1;
			if (this._doWithLoadPercentChange) {
				const percent = (nbOfTasks > 0) ? (this._nbOfCompletedTasks / nbOfTasks) : 1;
				const loadPercent = Math.round(100 * percent);
				this._doWithLoadPercentChange(loadPercent);
			}

			if (this._nbOfCompletedTasks === nbOfTasks && doAfterRunningInitialTasks) {
				this._taskQueue.setDoAfterEachInitialTask(null);
				this._haveAllInitialTasksRun = true;
				doAfterRunningInitialTasks();
			}
		};
		this._taskQueue.setDoAfterEachInitialTask(doAfterEachInitialTask);
		this._taskQueue.start();
	}

	// Used in SequenceSlice
	getTextureWithId(resourceId, fragment = null) {
		if (!this._resources[resourceId] || this._resources[resourceId].type === "audio") {
			return null
		}
		const resource = this._resources[resourceId];
		const texture = resource.getTextureForFragment(fragment);
		return texture
	}

	// Used in Slice (and SequenceSlice)
	destroyResourceForSliceIfPossible(resourceId) {
		if (!this._resources[resourceId] || this._resources[resourceId].type === "audio") {
			return
		}
		const textureResource = this._resources[resourceId];
		const forceDestroy = false;
		const { slices } = this._player;
		textureResource.destroyIfPossible(forceDestroy, slices);
	}

	// Used in PageNavigator (after a change in reading mode or tag)
	forceDestroyAllResourcesExceptIds(resourceIdsArray) {
		Object.values(this._resources).forEach((resource) => {
			const { id, hasLoadedSomething } = resource;
			if (hasLoadedSomething === true && resourceIdsArray.includes(id) === false) {
				const forceDestroy = true;
				const { slices } = this._player;
				resource.destroyIfPossible(forceDestroy, slices);
			}
		});

	}

	// Used in Player (on app destroy)
	destroy() {
		this.killPendingLoads();
		Object.values(this._resources).forEach((resource) => {
			if (resource.type !== "audio") {
				const forceDestroy = true;
				const { slices } = this._player;
				resource.destroyIfPossible(forceDestroy, slices);
			}
		});
		this._resources = null;
		this._taskQueue = null;
	}

}

class TimeAnimationManager {

	constructor(player) {
		this._player = player;
		this._animations = {};

		this._oldPageIndex = null;
	}

	// Used in StoryBuilder

	addSoundAnimations(soundAnimations, pageIndex) {
		if (pageIndex === null) { // Global sound animations
			this._animations.global = { isActive: false, soundAnimations };
		} else { // Page sound animations
			if (!this._animations[pageIndex]) {
				this._animations[pageIndex] = { isActive: false };
			}
			this._animations[pageIndex].soundAnimations = soundAnimations;
		}
	}

	addSliceAnimation(slice, animation, pageIndex) {
		if (!this._animations[pageIndex]) {
			this._animations[pageIndex] = { isActive: false };
		}
		if (!this._animations[pageIndex].sliceAnimations) {
			this._animations[pageIndex].sliceAnimations = [];
		}
		this._animations[pageIndex].sliceAnimations.push({ slice, animation });
	}

	// Used in PageNavigator (on finalizeEntry, i.e. at the end of a page transition)
	initializeAnimations(pageIndex) {
		// Ensure global sound animations are playing
		if (this._animations.global && this._animations.global.isActive === false) {
			this._animations.global.soundAnimations.forEach(({ resourceId }) => {
				const { resourceManager } = this._player;
				const resource = resourceManager.getResourceWithId(resourceId);
				if (resource) {
					resource.playIfNeeded();
				}
			});
			this._animations.global.isActive = true;
		}

		const audioResourcesToStopSet = this._stopAnimationsAndReturnAudioResources(this._oldPageIndex);

		const { resourceManager } = this._player;

		// Now deal with new page animations

		if (this._animations[pageIndex]) {
			this._animations[pageIndex].isActive = true;

			const initialDate = Date.now();

			const { soundAnimations, sliceAnimations } = this._animations[pageIndex];

			// Initiate all sound animations
			if (soundAnimations) {
				soundAnimations.forEach((animation) => {
					const { resourceId, start } = animation;
					if (audioResourcesToStopSet.has(resourceId) === true && start === 0) {
						audioResourcesToStopSet.delete(resourceId);
					}
					this._runSoundAnimation(pageIndex, animation, initialDate);
				});
			}

			// Initiate all slice animations
			if (sliceAnimations) {
				sliceAnimations.forEach(({ slice, animation }) => {
					this._runSliceAnimation(pageIndex, animation, initialDate, slice);
				});
			}
		}

		// Stop all remaining old sounds
		audioResourcesToStopSet.forEach((resourceId) => {
			const audioResource = resourceManager.getResourceWithId(resourceId);
			if (audioResource) {
				audioResource.resetForPlay();
			}
		});

		this._oldPageIndex = pageIndex;
	}

	_stopAnimationsAndReturnAudioResources(pageIndex) {
		const audioResourcesToStopSet = new Set();

		if (pageIndex === null || pageIndex === undefined || !this._animations[pageIndex]) {
			return audioResourcesToStopSet
		}

		this._animations[pageIndex].isActive = false;

		const { soundAnimations, sliceAnimations } = this._animations[pageIndex];

		if (soundAnimations) {
			soundAnimations.forEach((animation) => {
				const { raf, resourceId } = animation;
				cancelAnimationFrame(raf);
				audioResourcesToStopSet.add(resourceId);
			});
		}

		if (sliceAnimations) {
			sliceAnimations.forEach(({ slice, animation }) => {
				// If the initial value is not defined, then no change has been applied to the slice
				const { raf, variable, initialValue } = animation;
				cancelAnimationFrame(raf);
				if (initialValue !== undefined) {
					slice.setVariable(variable, initialValue);
				}
			});
		}

		return audioResourcesToStopSet
	}

	_runSoundAnimation(pageIndex, animation, initialDate) {
		let isFirstPlayInPage = true;

		const { resourceId, start, end } = animation;
		const { resourceManager } = this._player;
		const resource = resourceManager.getResourceWithId(resourceId);
		if (!resource) {
			return
		}

		const loop = () => {
			const { isActive } = this._animations[pageIndex];
			if (isActive === false) {
				return
			}
			const date = Date.now();
			if (date < initialDate + start) { // Before start
				animation.raf = requestAnimationFrame(loop);
			} else if (!end) {
				if (isFirstPlayInPage === true) {
					resource.playIfNeeded();
					isFirstPlayInPage = false;
				}
				animation.raf = requestAnimationFrame(loop);
			} else if (date < initialDate + end) {
				if (isFirstPlayInPage === true) {
					resource.playIfNeeded();
					isFirstPlayInPage = false;
				}
				animation.raf = requestAnimationFrame(loop);
			} else {
				resource.stopIfNeeded();
			}
		};

		animation.raf = requestAnimationFrame(loop);
	}

	_runSliceAnimation(pageIndex, animation, initialDate, slice) {
		const { variable, keyframesArray } = animation;
		if (!keyframesArray || keyframesArray.length <= 1) {
			return
		}
		let lastKeyframe = null; // Then: { key, value }
		let keyframeIndex = 0;
		let keyframe = keyframesArray[keyframeIndex];
		let { key, value } = keyframe;

		const initialValue = slice.getVariable(variable); // Get current value for desired variable
		animation.initialValue = initialValue;

		const loop = () => {
			const { isActive } = this._animations[pageIndex];
			if (isActive === false) {
				return
			}
			const date = Date.now();

			if (date < initialDate + key) {

				// Before start (i.e. before first keyframe)
				if (!lastKeyframe) {
					animation.raf = requestAnimationFrame(loop);

				// Between two keyframes (linear easing is assumed)
				} else {
					const duration = key - lastKeyframe.key;
					if (duration > 0) {
						const multiplier = (date - lastKeyframe.key - initialDate) / duration;
						const currentValue = lastKeyframe.value + (value - lastKeyframe.value) * multiplier;
						slice.setVariable(variable, currentValue);
					} else {
						slice.setVariable(variable, value);
					}
					this._player.refreshOnce();
					animation.raf = requestAnimationFrame(loop);
				}

			} else { // Go to next keyframe (if possible)
				slice.setVariable(variable, value);
				this._player.refreshOnce();

				keyframeIndex += 1;
				if (keyframeIndex >= keyframesArray.length) {
					return
				}
				lastKeyframe = keyframe;
				keyframe = keyframesArray[keyframeIndex];
				key = keyframe.key;
				value = keyframe.value;

				animation.raf = requestAnimationFrame(loop);
			}
		};

		if (initialValue !== null) {
			animation.raf = requestAnimationFrame(loop);
		}
	}

	// Used in Player, on destroying the player
	destroy() {
		this._stopAnimationsAndReturnAudioResources(this._oldPageIndex);
		this._animations = {};
	}

}

class EventEmitter {

	constructor() {
		this._callbacks = {};
	}

	on(event, callback) {
		if (!this._callbacks[event]) {
			this._callbacks[event] = [];
		}
		this._callbacks[event].push(callback);
	}

	emit(event, data) {
		const callbacksArray = this._callbacks[event];
		if (!callbacksArray) {
			return
		}
		callbacksArray.forEach((callback) => {
			callback(data);
		});
	}

}

// Note that size is obtained from underlying TextureElement

class Slice extends TextureElement {

	// Used in Player
	get id() { return this._id }

	// Used in TagManager
	get resourceInfoArray() { return this._resourceInfoArray }

	// Used in StoryBuilder and Player
	get pageNavInfo() { return this._pageNavInfo }

	// Used in StoryBuilder
	get pageSide() { return (this._properties) ? this._properties.pageSide : null }

	// Used in StateHandler
	get canPlay() { return (this._duration > 0) }

	// Used in SequenceSlice, Layer and ResourceManager
	get loadStatus() { return this._loadStatus }

	// Used in TextSlice
	get hasVariableSize() {
		return (!this._referenceSize
			|| (this._referenceSize.width === null || this._referenceSize.height === null))
	}

	// Used in TextureResource
	get isActive() {
		if (!this.parent) {
			return true
		}
		const { pageNavigator } = this.player;
		const { segmentRange } = pageNavigator;
		const { startIndex, endIndex } = segmentRange;
		const { segmentIndex } = this.parent;
		return (segmentIndex >= startIndex && segmentIndex <= endIndex)
	}

	// Used below

	static get counter() {
		Slice._counter = (Slice._counter === undefined)
			? 0
			: (Slice._counter + 1);
		return Slice._counter
	}

	get _video() { return (this._videoTexture) ? this._videoTexture.video : null }

	get _resourceManager() { return this.player.resourceManager }

	// Used in SequenceSlice
	get properties() { return this._properties }

	// Used in SequenceSlice
	set loadStatus(loadStatus) { this._loadStatus = loadStatus; }

	constructor(resourceInfoArray, properties, player, parentInfo = null) {
		const { role } = properties;
		super(role, player, parentInfo);

		this._id = Slice.counter;

		this._resourceInfoArray = resourceInfoArray;
		this._properties = properties;

		this.player.addSlice(this._id, this);

		const main = (resourceInfoArray && Array.isArray(resourceInfoArray) === true
			&& resourceInfoArray.length > 0)
			? resourceInfoArray[0]
			: null;
		const { id } = main || {};
		const { resourceManager } = player;
		const mainResource = resourceManager.getResourceWithId(id) || {};
		const {
			type = properties.type,
			width = properties.width,
			height = properties.height,
		} = mainResource;
		this._type = `${type}Slice`;

		// Set a (surely temporary) size
		this._referenceSize = { width, height };
		this._updateSizeFromReferenceSize();

		// Add a dummy texture to begin with
		this._hasLoadedOnce = false;
		if (role === "empty") {
			this._loadStatus = 2;
		} else if (type === "text") {
			this._loadStatus = 2;
		} else {
			this.assignDummyTexture();
			this._loadStatus = 0;
		}

		this._pageNavInfo = {};

		this._videoTexture = null;
		this._doOnEnd = null;

		this._playLoop = null;
	}

	_updateSizeFromReferenceSize() {
		const { width, height } = this._referenceSize;
		if (width && height) {
			this.setSize(this._referenceSize);
		} else {
			const { viewportRect } = this.player;
			const viewportRatio = (viewportRect.height > 0)
				? (viewportRect.width / viewportRect.height)
				: 1;
			if (width) {
				const size = { width, height: width / viewportRatio };
				this.setSize(size);
			} else if (height) {
				const size = { height, width: height * viewportRatio };
				this.setSize(size);
			} else {
				this.setSize(viewportRect);
			}
		}
	}

	// Used in StoryBuilder
	setPageNavInfo(type, pageNavInfo) {
		this._pageNavInfo[type] = pageNavInfo;
	}

	// Used in Layer (for PageNavigator)
	getResourceIdsToLoad(force = false) { // force = true on changing tags or reading modes
		if (this.role === "empty" || this._type === "textSlice"
			|| (force === false && (this._loadStatus === 1 || this._loadStatus === 2))) {
			return []
		}

		const { id, fragment } = this.getRelevantResourceIdAndFragment(this._resourceInfoArray);

		if (id === null) {
			this._loadStatus = 0;
			this._updateParentLoadStatus();
			return []
		}

		this._loadStatus = 1;
		this._updateParentLoadStatus();
		this.addAndStartLoadingAnimation();
		return [[{ sliceId: this._id, resourceId: id, fragment }]]
	}

	getRelevantResourceIdAndFragment(resourceInfoArray) {
		let { id, fragment } = resourceInfoArray[0] || {};

		if (resourceInfoArray.length < 2) {
			return { id, fragment }
		}

		// Check which alternate is most appropriate
		const reworkedArray = resourceInfoArray.map((resourceInfo) => {
			const resource = this._resourceManager.getResourceWithId(resourceInfo.id);
			const { path, tags } = resource || {};
			return {
				...tags, id: resourceInfo.id, path, fragment: resourceInfo.fragment,
			}
		});

		const result = this.player.getBestMatchForCurrentTags(reworkedArray);
		id = result.id;
		fragment = result.fragment;

		return { id, fragment }
	}

	_updateParentLoadStatus() {
		const { pageNavigator } = this.player;
		if (!pageNavigator) { // On Player destroy, pageNavigator is already null
			return
		}
		const { pageNavType } = pageNavigator;
		if (!this._pageNavInfo[pageNavType] // If Slice is not in current pageNavigator anymore...
			|| !this.parent || !this.parent.updateLoadStatus) {
			return
		}
		this.parent.updateLoadStatus();
	}

	// Once the associated texture has been created, it can be applied to the slice
	updateTextures(texture, isAFallback) {
		if (!texture) {
			this._loadStatus = 0;
			this.assignDummyTexture();

		} else {
			this._loadStatus = (isAFallback === true) ? -1 : 2;

			if (texture !== this._texture) { // this._texture is to be found in TextureElement
				const { video, size } = texture;
				const { width, height } = size;

				// If the texture is a normal image or fallback image
				if (!video) {
					this.setTexture(texture);
					this.player.refreshOnce();

					if (this._hasLoadedOnce === false) {
						// The dimensions are now correct and can be kept
						this.setSizeFromActualTexture(width, height);
						this._hasLoadedOnce = true;
					}

				// Otherwise, if the texture is a video
				} else if (video.duration) {
					this._videoTexture = texture;

					if (this._hasLoadedOnce === false) {
						this._duration = video.duration;

						// The dimensions are now correct and can be kept
						this.setSizeFromActualTexture(width, height);

						this._hasLoadedOnce = true;
					}

					this._doOnEnd = null;

					if (this._shouldPlay === true) {
						this.play();
					}
				}
			}
		}

		this._updateParentLoadStatus();
		this.stopAndRemoveLoadingAnimation();
	}

	// On the first successful loading of the resource's texture
	setSizeFromActualTexture(width, height) {
		if (width === this.unscaledSize.width && height === this.unscaledSize.height) {
			return
		}
		this.setSize({ width, height });

		// Now only resize the page where this slice appears
		if (this._parent && this.isActive === true) {
			this._parent.resizePage();
		}
	}

	cancelTextureLoad() {
		this._loadStatus = 0;
		this._updateParentLoadStatus();
		this.stopAndRemoveLoadingAnimation();
	}

	play() {
		this._shouldPlay = true;
		if (!this._video) {
			return
		}

		const shouldUseRaf = (("requestVideoFrameCallback" in HTMLVideoElement.prototype) === false);

		const playPromise = this._video.play();
		if (playPromise !== undefined) {
			playPromise.then(() => {
				this.setVideoTexture(this._videoTexture);
				this._playLoop = () => {
					if (this.isInViewport === true) {
						this.player.refreshOnce();
					}
					if (this._playLoop) {
						if (shouldUseRaf === false) {
							this._video.requestVideoFrameCallback(this._playLoop);
						} else {
							requestAnimationFrame(this._playLoop);
						}
					}
				};
				this._playLoop();
			}).catch(() => {
				// Caught error prevents play (keep the catch to avoid issues with video pause)
			});
		}
	}

	// Stop a video by pausing it and returning to its first frame
	stop() {
		this._shouldPlay = false;
		if (this._video) {
			this._video.pause();
			this._video.currentTime = 0;
			this._video.loop = true;
			this._destroyPlayLoop();
		}
		// Since changing pages will force a stop (on reaching the normal end of a transition
		// or forcing it), now is the appropriate time to remove the "ended" event listener
		if (this._doOnEnd) {
			this._video.removeEventListener("ended", this._doOnEnd);
			this._doOnEnd = null;
		}
	}

	_destroyPlayLoop() {
		cancelAnimationFrame(this._playLoop);
		this._playLoop = null;
	}

	setDoOnEnd(doOnEnd) {
		if (!this._video) {
			return
		}
		this._video.loop = false;
		this._doOnEnd = doOnEnd.bind(this);
		this._video.addEventListener("ended", this._doOnEnd);
	}

	resize(sequenceFit = null) {
		if (sequenceFit) {
			const sequenceClipped = false;
			super.resize(sequenceFit, sequenceClipped);
			return
		}

		if (this._type === "textSlice") {
			this._updateSizeFromReferenceSize();
		}

		const { pageNavigator } = this.player;
		const { metadata } = pageNavigator;

		const fit = metadata.forcedFit || this._properties.fit || metadata.fit;

		let clipped = false;
		if (metadata.forcedClipped !== undefined
			&& (metadata.forcedClipped === true || metadata.forcedClipped === false)) {
			clipped = pageNavigator.metadata.forcedClipped;
		} else if (this._properties !== undefined
			&& (this._properties.clipped === true || this._properties.clipped === false)) {
			clipped = this._properties.clipped;
		} else {
			clipped = metadata.clipped;
		}

		super.resize(fit, clipped);
	}

	// Used in Layer

	setupForEntry() {
		this.resize();
	}

	finalizeEntry() {
		this.play();
	}

	finalizeExit() {
		this.stop();
	}

	// Used in Layer
	destroyResourcesIfPossible() {
		this.stopAndRemoveLoadingAnimation();

		if (this._loadStatus !== 2 || this.role === "empty" || this._type === "textSlice") {
			return
		}

		const idsArray = this._getLoadedIds(); // A different function for Slice and SequenceSlice
		idsArray.forEach((id) => {
			this._resourceManager.destroyResourceForSliceIfPossible(id);
		});
	}

	_getLoadedIds() {
		const { id } = this.getRelevantResourceIdAndFragment(this._resourceInfoArray);
		return (id !== null) ? [id] : []
	}

	// Used in TextureResource
	removeTexture() {
		if (this._video) {
			this.unsetVideoTexture();
			this._videoTexture = null;
		} else {
			this.setTexture(null);
		}
		this.setAsUnloaded();
	}

	// Used above and in SequenceSlice
	setAsUnloaded() {
		this._loadStatus = 0;
		this._updateParentLoadStatus();
		this.stopAndRemoveLoadingAnimation();
	}

	// Used in LayerPile (for Segment, and ultimately for Camera's virtual point)
	// ...but also in Player for target hrefs!
	getInfo() {
		if (this.role === "empty" || !this._resourceInfoArray || this._resourceInfoArray.length < 1) {
			return { href: "", path: "", mimeType: DEFAULT_MIME_TYPE }
		}
		const { id, fragment } = this._resourceInfoArray[0];
		const resource = this._resourceManager.getResourceWithId(id);
		const { path, mimeType } = resource;
		let href = path;
		if (href && fragment) {
			href += `#${fragment}`;
		}
		return { href: href || "", path: path || "", type: mimeType || DEFAULT_MIME_TYPE }
	}

	// Called by Player on final destroy
	destroy() {
		this._destroyPlayLoop();

		// Clear textures
		super.destroy();
		this._videoTexture = null;

		// Remove event listeners
		if (this._video && this._doOnEnd) {
			this._video.removeEventListener("ended", this._doOnEnd);
			this._doOnEnd = null;
		}
	}

	// Used in StoryBuilder
	static createEmptySlice(player) {
		const resourceInfoArray = [];
		const properties = { role: "empty", type: "empty" };
		const parentInfo = null;
		const slice = new Slice(resourceInfoArray, properties, player, parentInfo);
		return slice
	}

	// Used in TimeAnimationManager

	setVariable(variable, value) {
		switch (variable) {
		case "alpha":
			this.setAlpha(value);
			break
		case "x":
			this.setX(value);
			break
		case "y":
			this.setY(value);
			break
		case "scale":
			this.setScaleFactor(value);
			this.resize(); // So as to reposition child layers based on scaleFactor
			break
		case "rotation":
			this.setRotation(value);
			break
		}
	}

	getVariable(variable) {
		switch (variable) {
		case "alpha":
			return this.getAlpha()
		case "x":
			return this.getX()
		case "y":
			return this.getY()
		case "scale":
			return this.getScaleFactor()
		case "rotation":
			return this.getRotation()
		default:
			return null
		}
	}

}

class TextSlice extends Slice {

	constructor(resourceInfoArray, textOptions, properties, player, parentInfo = null) {
		super([], properties, player, parentInfo);

		this._textOptions = textOptions;

		this._resourceInfoArray = resourceInfoArray; // Which is a textVersionsArray

		const { backgroundColor } = textOptions;
		if (backgroundColor) {
			this.setBackgroundColor(backgroundColor);
		}

		this._text = null;
		this._textElement = null;
	}

	resize() {
		const oldSize = this.size;
		super.resize();
		this.applySizeClip();
		if (!this._textElement || (this.hasVariableSize === true // At least one dimension is not fixed
			&& (this.size.width !== oldSize.width || this.size.height !== oldSize.height))) {
			this._createAndPositionTextElement();
		}
	}

	_createAndPositionTextElement() {
		if (this._textElement) {
			this._textElement.destroy();
		}
		this._textElement = new TextElement("text", this, this._textOptions);
		if (!this._text) {
			return
		}
		this._textElement.setText(this._text);

		const { boundingRect } = this._textElement;
		const { width, height } = boundingRect;
		const position = {
			x: (width - this.unscaledSize.width) / 2,
			y: (height - this.unscaledSize.height) / 2,
		};

		const { rect, hAlign, vAlign } = this._textOptions;
		if (rect) {
			const shouldLimitSize = false;
			const actualRect = getRectWithSize(rect, this.size, shouldLimitSize);
			if (actualRect) {
				const {
					x, y, w, h,
				} = actualRect;
				position.x += x;
				if (hAlign !== "left") {
					const delta = w - width;
					if (hAlign === "center") {
						position.x += delta / 2;
					} else if (hAlign === "right") {
						position.x += delta;
					}
				}
				position.y += y;
				if (vAlign !== "top") {
					const delta = h - height;
					if (vAlign === "center") {
						position.y += delta / 2;
					} else if (vAlign === "bottom") {
						position.y += delta;
					}
				}
			}
		} else {
			if (hAlign === "center") {
				position.x = 0;
			} else if (hAlign === "right") {
				position.x = (this.unscaledSize.width - width) / 2;
			}
			if (vAlign === "center") {
				position.y = 0;
			} else if (vAlign === "bottom") {
				position.y = (this.unscaledSize.height - height) / 2;
			}
		}

		// Layer child slices need to be offset
		if (this.role === "layersChild" && this.parentInfo) {
			const parentSlice = this.parentInfo.slice;
			const { unscaledSize } = parentSlice;
			position.x -= (unscaledSize.width - this.unscaledSize.width) / 2;
			position.x -= (unscaledSize.height - this.unscaledSize.height) / 2;
		}

		this._textElement.setPosition(position);
	}

	setLanguage(language) {
		const text = this._getRelevantText(language);
		if (this._text === text) {
			return
		}
		this._text = text;
		this._createAndPositionTextElement();
	}

	_getRelevantText(language) {
		if (!this._resourceInfoArray || this._resourceInfoArray.length < 1) {
			return ""
		}
		let { text } = this._resourceInfoArray[0];
		this._resourceInfoArray.forEach((textVersion) => {
			if (textVersion.language === language) {
				text = textVersion.text;
			}
		});
		return text
	}

	getInfo() {
		if (!this._resourceInfoArray || this._resourceInfoArray.length < 1) {
			return { href: "", path: "", type: "text/plain" }
		}
		const { text } = this._resourceInfoArray[0];
		return { href: text, path: text, type: "text/plain" }
	}

	destroy() {
		if (this._textElement) {
			this._textElement.destroy();
		}
		super.destroy();
	}

}

class SequenceSlice extends Slice {

	// Used in TagManager
	get arrayOfResourceInfoArray() {
		return this._arrayOfResourceInfoArray
	}

	// Used in LayerTransition
	get canPlay() { return (this._duration > 0 && this._texturesArray.length > 0) }

	constructor(resourceInfoArray, arrayOfResourceInfoArray, properties, player, parentInfo = null) {
		super(resourceInfoArray, properties, player, parentInfo);

		this._arrayOfResourceInfoArray = arrayOfResourceInfoArray;
		const { duration } = properties;
		this._duration = duration || 0;

		this._type = "sequenceSlice";

		this._hasLoadedOnce = false;
		this._texturesArray = [];
		this._nbOfFrames = 0;
		this._nbOfLoadedFrameTextures = 0;

		this._stepDuration = null;
	}

	getResourceIdsToLoad(force = false) {
		if (force === false && (this.loadStatus === 1 || this.loadStatus === 2)) {
			return []
		}

		const resourceDataArray = [];
		this._arrayOfResourceInfoArray.forEach((resourceInfoArray) => {
			const { id, fragment } = this.getRelevantResourceIdAndFragment(resourceInfoArray);
			if (id !== null) {
				resourceDataArray.push({ sliceId: this._id, resourceId: id, fragment });
			}
		});

		this.loadStatus = 1;
		this._updateParentLoadStatus();
		this.addAndStartLoadingAnimation();
		return [resourceDataArray]
	}

	updateTextures() {
		if (!this._duration) {
			return
		}

		this._texturesArray = this._createTexturesArray();
		if (this._texturesArray.length === 0) {
			this.loadStatus = 0;
			return
		}

		this.loadStatus = (this._texturesArray.length < this._arrayOfResourceInfoArray.length) ? -1 : 2;

		this.stopAndRemoveLoadingAnimation();

		this.setTexturesArray(this._texturesArray);
		// Note: No need to refresh the player (Slice's setVisibility will deal with it)
	}

	_createTexturesArray() {
		let texturesArray = [];

		if (this._arrayOfResourceInfoArray.length > 0) {

			// Build texturesList
			const texturesList = [];
			this._arrayOfResourceInfoArray.forEach((resourceInfoArray) => {
				const texture = this._getLoadedTexture(resourceInfoArray);

				if (texture) {
					// Get natural dimensions from the first valid texture in the list
					if (this._hasLoadedOnce === false) {
						const { size } = texture;
						const { width, height } = size;
						this.setSizeFromActualTexture(width, height);
						this._hasLoadedOnce = true;
					}
					texturesList.push(texture);
				}
			});

			// Now build texturesArray with time information
			if (texturesList.length > 0) {
				this._nbOfFrames = texturesList.length;
				// Compute how long each image will be displayed
				// Note that the textures that have not been created are skipped,
				// meaning that the total number of textures may be less than planned,
				// and thus the time spent on each actual texture longer than expected
				this._stepDuration = this._duration / texturesList.length;
				texturesArray = texturesList.map((texture) => ({ texture, time: this._stepDuration }));
			}

		}
		return texturesArray
	}

	// The associated texture can either come from an image or fallback image
	_getLoadedTexture(resourceInfoArray) {
		const { resourceManager } = this.player;
		const { id, fragment } = this.getRelevantResourceIdAndFragment(resourceInfoArray);
		const texture = resourceManager.getTextureWithId(id, fragment);
		return texture
	}

	play() {
		if (!this.goToFrameAndPlay) {
			return
		}
		this.goToFrameAndPlay(0);
		this._playLoop = setInterval(() => {
			if (this.isInViewport === true) {
				this.player.refreshOnce();
			}
		}, this._stepDuration);
	}

	stop() {
		if (!this.goToFrameAndStop) {
			return
		}
		this.goToFrameAndStop(0);
		this._destroyPlayLoop();
	}

	_destroyPlayLoop() {
		clearInterval(this._playLoop);
		this._playLoop = null;
	}

	pauseAtPercent(percent) {
		if (!this.goToFrameAndStop || this._nbOfFrames < 1) {
			return
		}
		const frameIndex = Math.min(Math.floor(percent * this._nbOfFrames), this._nbOfFrames - 1);
		this.goToFrameAndStop(frameIndex);
		this._destroyPlayLoop();
	}

	resize() {
		const { pageNavigator } = this.player;
		const fit = pageNavigator.metadata.forcedFit || this.properties.fit
			|| pageNavigator.metadata.fit;
		super.resize(fit);
	}

	// Used in Slice
	_getLoadedIds() {
		const idsArray = [];
		this._arrayOfResourceInfoArray.forEach((resourceInfoArray) => {
			const { id } = this.getRelevantResourceIdAndFragment(resourceInfoArray);
			if (id !== null) {
				idsArray.push(id);
			}
		});
		return idsArray
	}

	// Used in TextureResource
	removeTexture() {
		this.setTexturesArray(null);
		this.setAsUnloaded();
	}

	destroy() {
		this._destroyPlayLoop();
		super.destroy();
	}

}

class ResourceBuilder {

	static createResourceInfoArray(object, player) {
		const {
			href,
			type,
			text,
			width,
			height,
			language,
			alternate,
		} = object || {};

		const shouldReturnDefaultValue = false;
		const actualWidth = returnValidValue("positive", width, shouldReturnDefaultValue);
		const actualHeight = returnValidValue("positive", height, shouldReturnDefaultValue);

		let sliceType = null;
		let main = {};

		let mediaFragment = null; // Only useful for a "resource" slice

		let resourceInfoArray = [];
		let result = {};

		// If no valid href is specified, an object will be returned with the specified dimensions
		// to allow for correctly-sized dummy slices (i.e. slices with dummy textures)
		// - and we shall use a textSlice with no text string to handle that!

		if (text || !href || isAString(href) === false) {
			sliceType = "text";

			const actualText = (text && isAString(text) === true) ? text : "";
			main = { text: actualText };

			result = {
				...result,
				width: actualWidth,
				height: actualHeight,
			};

		} else {
			sliceType = "resource";

			const pathAndMediaFragment = getPathAndMediaFragment(href);
			const { path } = pathAndMediaFragment;
			mediaFragment = pathAndMediaFragment.mediaFragment;
			const { resourceType, mimeType } = getResourceAndMimeTypes(path, type);
			main = { type: resourceType, mimeType, path };
			if (actualWidth) {
				main.width = actualWidth;
			}
			if (actualHeight) {
				main.height = actualHeight;
			}
			if (language && isAString(language) === true) {
				main.language = language;
			}
			if (resourceType === "video") {
				main.fallbacksArray = [];
			}
		}

		// Create alternates (and fallbacks) by flattening the alternate tree
		const oldAltParts = {};
		const alternatesArray = [];
		ResourceBuilder._handleAlternateArray(object, alternate, oldAltParts, main, alternatesArray,
			sliceType);

		if (sliceType === "text") {
			resourceInfoArray = [main, ...alternatesArray];

		} else { // "resource"
			// Process main...
			let id = ResourceBuilder.getResourceId(main, player);
			main = { id };
			if (mediaFragment) {
				main.fragment = mediaFragment;
			}
			resourceInfoArray = [main];

			// ...and alternates
			if (alternatesArray.length > 0) {
				alternatesArray.forEach((alt) => {
					id = ResourceBuilder.getResourceId(alt, player);
					const newAlt = { id };
					if (alt.fragment) {
						newAlt.fragment = alt.fragment;
					}
					resourceInfoArray.push(newAlt);
				});
			}
		}

		result = {
			...result,
			type: sliceType,
			resourceInfoArray,
		};

		return result
	}

	// For now, width and height are not taken into account in alternates, however it would be
	// possible to add a "ratio" tag and compute ratios based on specified widths and heights

	static _handleAlternateArray(object, alternateArray, oldAltParts, parentResource,
		alternatesArray, sliceType) {
		if (!alternateArray || Array.isArray(alternateArray) === false) {
			return
		}
		alternateArray.forEach((alternateObject) => {
			const key = (sliceType === "resource") ? "href" : "text";
			const condition = (alternateObject && alternateObject[key]
				&& isAString(alternateObject[key]) === true);
			if (condition === true) {

				const newAltParts = { ...oldAltParts };
				let hasAtLeastOneTagChange = false;
				POSSIBLE_TAG_NAMES.forEach((tagName) => {
					const tagValue = alternateObject[tagName];
					if (tagValue !== undefined && tagValue !== object[tagName]) {
						// Note that, ideally, we should also check that tagValue is acceptable
						newAltParts[tagName] = tagValue;
						hasAtLeastOneTagChange = true;
					}
				});

				const newAlt = { ...newAltParts };

				if (sliceType === "resource") {
					const { path, mediaFragment } = getPathAndMediaFragment(alternateObject.href);
					const { type } = alternateObject;
					const { resourceType, mimeType } = getResourceAndMimeTypes(path, type);
					newAlt.type = resourceType;
					newAlt.mimeType = mimeType;
					newAlt.path = path;
					if (resourceType === "video") {
						newAlt.fallbacksArray = [];
					}
					if (mediaFragment) {
						newAlt.fragment = mediaFragment;
					}
				} else {
					newAlt.text = alternateObject.text;
				}

				if (hasAtLeastOneTagChange === true
					|| (sliceType === "resource" && parentResource.type !== newAlt.type)) {
					// If the move was from video to image
					if (sliceType === "resource" && parentResource.type === "video"
						&& newAlt.type === "image") {
						parentResource.fallbacksArray.push(newAlt);
						if (hasAtLeastOneTagChange === true) {
							alternatesArray.push(newAlt);
						}
					} else {
						alternatesArray.push(newAlt);
					}
				}

				ResourceBuilder._handleAlternateArray(object, alternateObject.alternate, newAltParts,
					newAlt, alternatesArray, sliceType);
			}
		});
	}

	static getResourceId(coreResourceData, player) {
		const { resourceManager } = player;
		const id = resourceManager.getResourceId(coreResourceData);
		return id
	}

}

class Transition {

	static createTransition(transition, player, textOptions) {
		const {
			type, duration, direction, file, sequence,
		} = transition || {};

		let shouldReturnDefaultValue = false;

		const actualType = returnValidValue("transitionType", type, shouldReturnDefaultValue);
		if (!actualType) {
			return null
		}

		const actualTransition = { type: actualType };

		const actualDuration = returnValidValue("duration", duration, shouldReturnDefaultValue);
		if (actualDuration) {
			actualTransition.duration = actualDuration;
		}

		if (actualType === "slide-in" || actualType === "slide-out" || actualType === "push") {
			shouldReturnDefaultValue = false;
			const actualDirection = returnValidValue("direction", direction,
				shouldReturnDefaultValue);
			if (!direction) {
				return null
			}
			actualTransition.direction = actualDirection;
		}

		if (actualType === "animation") {
			if (file && isAnObject(file) === true) {
				actualTransition.sliceType = "video";

				const fullObject = {
					...file,
					type: "video",
				};
				const parentInfo = null;
				const forcedRole = "transition";
				const linkObject = new LinkObject(fullObject, player, textOptions, parentInfo, forcedRole);
				const { slice } = linkObject;
				actualTransition.slice = slice;

			} else if (sequence) {
				actualTransition.sliceType = "sequence";

				const sliceProperties = {
					role: "transition",
					clipped: true,
					duration: actualDuration || DEFAULT_DURATION,
				};

				const {
					arrayOfResourceInfoArray, fit,
				} = LinkObject.buildArrayOfResourceInfoArray(sequence, player);
				if (fit) {
					sliceProperties.fit = fit;
				}

				shouldReturnDefaultValue = true;
				sliceProperties.duration = returnValidValue("duration", duration,
					shouldReturnDefaultValue);

				const resourceInfoArray = [];
				const slice = new SequenceSlice(resourceInfoArray, arrayOfResourceInfoArray,
					sliceProperties, player);
				actualTransition.slice = slice;
			} else {
				return null
			}
		}

		return actualTransition
	}

	// Used in DivinaParser to split each page transition into two layer half transitions
	static getEntryAndExitTransitions(transition, isForward) {
		const {
			type, duration, direction, sliceType, slice,
		} = transition;
		let entry = {
			type,
			duration, // Duration may remain undefined
			isDiscontinuous: true,
		};
		let exit = {
			type,
			duration, // Duration may remain undefined
			isDiscontinuous: true,
		};

		switch (type) {
		case "cut": // Duration is not taken into account, i.e. the cut occurs at once
			entry = null;
			exit = null;
			break
		case "dissolve":
			if (isForward === true) {
				entry.type = "fade-in";
				exit.type = "show";
			} else {
				exit.type = "fade-out";
				entry.type = "show";
			}
			break
		case "slide-in":
			entry.direction = direction;
			exit.type = "show";
			break
		case "slide-out":
			entry.type = "show";
			exit.direction = direction;
			break
		case "push":
			entry.type = "slide-in";
			entry.direction = direction;
			exit.type = "slide-out";
			exit.direction = direction;
			break
		case "animation":
			entry.sliceType = sliceType;
			entry.slice = slice;
			exit.type = "hide";
			exit.duration = 0;
			break
		}

		return { entry, exit }
	}

	static getValidHalfTransition(entryOrExit) {
		const { type, duration, direction } = entryOrExit || {};

		const shouldReturnDefaultValue = false;
		const actualType = returnValidValue("halfTransitionType", type, shouldReturnDefaultValue);
		if (!actualType) {
			return null
		}

		const actualDuration = returnValidValue("duration", duration, shouldReturnDefaultValue);

		const actualEntryOrExit = {
			type: actualType,
			isDiscontinuous: false,
		};

		if (!actualDuration && actualDuration !== 0) {
			actualEntryOrExit.duration = actualDuration;
		}

		if (actualType === "slide-in" || actualType === "slide-out") {
			if (!direction) {
				return null
			}
			const actualDirection = returnValidValue("direction", direction, shouldReturnDefaultValue);
			if (actualDirection) {
				actualEntryOrExit.direction = actualDirection;
			}
		}

		return actualEntryOrExit
	}

}

class LinkObject {

	get slice() { return this._slice }

	get hAlign() { return this._hAlign }

	get vAlign() { return this._vAlign }

	get transitionForward() { return this._transitionForward }

	get transitionBackward() { return this._transitionBackward }

	get snapPointsArray() { return this._snapPointsArray }

	get soundAnimationsArray() { return this._soundAnimationsArray }

	get childrenArray() { return this._childrenArray }

	get visualAnimationsArray() { return this._visualAnimationsArray }

	constructor(divinaObject, player, textOptions, parentInfo = null, forcedRole = null) {
		this._textOptions = textOptions;

		this._slice = null;

		this._hAlign = null;
		this._vAlign = null;

		this._transitionForward = null;
		this._transitionBackward = null;

		this._snapPointsArray = null;

		this._soundAnimationsArray = null;

		// For link object layers (will eventually result in the creation of a unique segment)
		this._childrenArray = null;

		// For link object animations (the unique segment holding them may have states)
		this._visualAnimationsArray = null;

		// Now build the slice associated to the link object (by default),
		// and also child link objects (and their slices) and transitions (and slices) as needed
		this._buildSlicesAndTransitions(divinaObject, player, parentInfo, forcedRole);
	}

	_buildSlicesAndTransitions(divinaObject, player, parentInfo = null, forcedRole = null) {
		const { properties } = divinaObject || {};
		const {
			fit,
			clipped,
			hAlign,
			vAlign,
			page,
			transitionForward,
			transitionBackward,
			snapPoints,
			sounds,
			layers,
			animations,
			backgroundColor,
			fillColor,
			fontFamily,
			fontSize,
			lineHeight,
			letterSpacing,
			rect,
			sequence,
		} = properties || {};

		let role = forcedRole || "standard";
		if (parentInfo) {
			role = "layersChild"; // Will be positioned based on the parent's top left point
		} else if (layers) {
			role = "layersParent"; // Will give its dimensions as reference (but won't be displayed)
		}

		let shouldReturnDefaultValue = false;

		let sliceFit = null;
		if (parentInfo) { // If a layersChild (i.e. the slice in a child layer)
			sliceFit = "pixel";
		} else {
			sliceFit = returnValidValue("fit", fit, shouldReturnDefaultValue);
		}

		const sliceClipped = returnValidValue("clipped", clipped, shouldReturnDefaultValue);

		const sliceHAlign = returnValidValue("hAlign", hAlign, shouldReturnDefaultValue);
		const sliceVAlign = returnValidValue("vAlign", vAlign, shouldReturnDefaultValue);
		if (sliceHAlign) {
			this._hAlign = sliceHAlign;
		}
		if (sliceVAlign) {
			this._vAlign = sliceVAlign;
		}

		const pageSide = returnValidValue("pageSide", page, shouldReturnDefaultValue);

		const sliceProperties = {
			role,
			fit: sliceFit,
			clipped: sliceClipped,
			hAlign: sliceHAlign,
			vAlign: sliceVAlign,
			pageSide,
		};

		let result = ResourceBuilder.createResourceInfoArray(divinaObject, player);
		const { resourceInfoArray } = result;

		// If the link object is that for a sequence
		if (sequence) {
			const { files, duration } = sequence;

			result = LinkObject.buildArrayOfResourceInfoArray(files, player);
			if (result.fit) {
				sliceProperties.fit = result.fit;
			}
			if (result.clipped) {
				sliceProperties.clipped = result.clipped;
			}
			const { arrayOfResourceInfoArray } = result;

			shouldReturnDefaultValue = true;
			sliceProperties.duration = returnValidValue("duration", duration,
				shouldReturnDefaultValue);

			this._slice = new SequenceSlice(resourceInfoArray, arrayOfResourceInfoArray, sliceProperties,
				player, parentInfo);

		// Otherwise the link object has a non-sequence slice: either resource (image or video) or text
		} else if (result.type === "resource") {
			this._slice = new Slice(resourceInfoArray, sliceProperties, player, parentInfo);

		} else {
			const textOptions = {
				backgroundColor: returnValidValue("backgroundColor", backgroundColor,
					shouldReturnDefaultValue) || this._textOptions.backgroundColor,
				fillColor: returnValidValue("fillColor", fillColor, shouldReturnDefaultValue)
					|| this._textOptions.fillColor,
				fontFamily: returnValidValue("fontFamily", fontFamily, shouldReturnDefaultValue)
					|| this._textOptions.fontFamily,
				fontSize: returnValidValue("fontSize", fontSize, shouldReturnDefaultValue)
					|| this._textOptions.fontSize,
				lineHeight: returnValidValue("lineHeight", lineHeight, shouldReturnDefaultValue)
					|| this._textOptions.lineHeight,
				letterSpacing: returnValidValue("letterSpacing", letterSpacing,
					shouldReturnDefaultValue) || this._textOptions.letterSpacing,
				hAlign: sliceHAlign || this._textOptions.hAlign,
				vAlign: sliceVAlign || this._textOptions.vAlign,
			};
			if (rect) {
				const actualRect = parseStringRect(rect);
				if (actualRect) {
					textOptions.rect = actualRect;
				}
			}

			sliceProperties.width = result.width;
			sliceProperties.height = result.height;
			sliceProperties.type = "text";

			this._slice = new TextSlice(resourceInfoArray, textOptions, sliceProperties, player,
				parentInfo);
		}

		// Handle detailed transition data
		if (transitionForward) {
			const transition = Transition.createTransition(transitionForward, player, this._textOptions);
			if (transition) {
				this._transitionForward = transition;
			}
		}
		if (transitionBackward) {
			const transition = Transition.createTransition(transitionBackward, player, this._textOptions);
			if (transition) { // An invalid transition has a type forced as null
				this._transitionBackward = transition;
			}
		}

		// Handle snap points
		if (snapPoints && Array.isArray(snapPoints) === true) {
			this._snapPointsArray = [];
			snapPoints.forEach((snapPoint) => {
				const validSnapPoint = LinkObject._getValidPoint(snapPoint);
				if (validSnapPoint !== null) {
					this._snapPointsArray.push(validSnapPoint);
				}
			});
		}

		// Handle sounds
		if (sounds) {
			this._soundAnimationsArray = [];
			sounds.forEach((sound) => {
				const shouldConsiderStartAndEnd = true;
				const soundAnimation = LinkObject.getValidSoundAnimation(sound, player,
					shouldConsiderStartAndEnd);
				if (soundAnimation) {
					this._soundAnimationsArray.push(soundAnimation);
				}
			});
		}

		// Handle layers (note that we do not consider layers for a child layer object)
		if (!parentInfo && layers && Array.isArray(layers) === true) {
			this._childrenArray = this._getChildrenArray(layers, this._slice, player);
		}

		// Handle animations
		if (animations) {
			this._visualAnimationsArray = LinkObject._getVisualAnimationsArray(animations);
		}
	}

	// Used above and in Transition
	static buildArrayOfResourceInfoArray(sequenceImagesArray, player) {
		const result = { arrayOfResourceInfoArray: [] };

		if (!sequenceImagesArray || Array.isArray(sequenceImagesArray) === false
			|| sequenceImagesArray.length === 0) {
			return result
		}

		sequenceImagesArray.forEach((sequenceImage, i) => {
			if (sequenceImage && isAnObject(sequenceImage) === true) {

				// We allow fit and clipped information to be gathered from first file
				// (note that if the first file was empty, too bad, i=0 has passed!)
				if (i === 0 && sequenceImage.properties) {
					const shouldReturnDefaultValue = false;

					let fileFit = sequenceImage.properties.fit;
					fileFit = returnValidValue("fit", fileFit,
						shouldReturnDefaultValue);
					if (fileFit !== null) {
						result.fit = fileFit;
					}

					let fileClipped = sequenceImage.properties.clipped;
					fileClipped = returnValidValue("clipped", fileClipped,
						shouldReturnDefaultValue);
					if (fileClipped !== null) {
						result.clipped = fileClipped;
					}
				}

				const fullObject = {
					...sequenceImage,
					type: sequenceImage.type || DEFAULT_MIME_TYPE,
				};
				const { resourceInfoArray } = ResourceBuilder.createResourceInfoArray(fullObject, player);
				result.arrayOfResourceInfoArray.push(resourceInfoArray);
			}
		});
		return result
	}

	static _getValidPoint(point) {
		let validPoint = null;

		const { viewport, x, y } = point || {};
		const shouldReturnDefaultValue = false;
		const actualViewport = returnValidValue("viewport", viewport,
			shouldReturnDefaultValue);
		if (actualViewport === null
			|| (isAString(x) === false && isAString(y) === false)) {
			return validPoint
		}

		validPoint = { viewport: actualViewport };

		if (x !== undefined && x.length > 0) {
			const validValueAndUnit = getValidValueAndUnit(x);
			if (validValueAndUnit) {
				const { value, unit } = validValueAndUnit;
				validPoint.x = value;
				validPoint.unit = unit;
			}
		}
		if (y !== undefined && y.length > 0) {
			const validValueAndUnit = getValidValueAndUnit(y);
			if (validValueAndUnit) {
				const { value, unit } = validValueAndUnit;
				validPoint.y = value;
				validPoint.unit = unit;
			}
		}

		if (validPoint.unit) { // Note that x and y cannot cannot have different units
			return validPoint
		}
		return null
	}

	// Used above and in DivinaParser
	static getValidSoundAnimation(sound, player, shouldConsiderStartAndEnd = false) {
		const { href, properties } = sound || {};
		const { looping, animation } = properties || {};
		if (!href) {
			return null
		}

		const { path } = getPathAndMediaFragment(href);
		const coreResourceData = { path, type: "audio" };
		if (sound.type) {
			coreResourceData.mimeType = sound.type;
		}
		const shouldReturnDefaultValue = true;
		coreResourceData.looping = returnValidValue("looping", looping,
			shouldReturnDefaultValue);

		const resourceId = ResourceBuilder.getResourceId(coreResourceData, player);
		if (resourceId === null) {
			return null
		}

		if (shouldConsiderStartAndEnd === false) {
			return { resourceId }
		}

		let soundAnimation = null;
		if (!animation) {
			return {
				resourceId,
				type: "time",
				start: 0,
			}
		}

		const { type, start, end } = animation;
		const actualType = returnValidValue("animationType", type, shouldReturnDefaultValue);
		const actualStart = LinkObject._processSoundStartOrEnd(actualType, start);

		if (actualStart === null) {
			return null
		}
		soundAnimation = {
			resourceId,
			type: actualType,
			start: actualStart,
		};
		if (end) {
			const actualEnd = LinkObject._processSoundStartOrEnd(actualType, end);
			if (actualEnd) {
				soundAnimation.end = actualEnd;
			}
		}

		return soundAnimation
	}

	static _processSoundStartOrEnd(type, value) { // value is that for start or end
		const shouldReturnDefaultValue = false;
		let actualValue = null;
		switch (type) {
		case "time":
			actualValue = returnValidValue("positive", value, shouldReturnDefaultValue);
			break
		case "progress":
			actualValue = returnValidValue("positive", value, shouldReturnDefaultValue);
			if (actualValue !== null && actualValue > 1) {
				actualValue = null;
			}
			break
		case "point":
			actualValue = LinkObject._getValidPoint(value);
			break
		}
		return actualValue
	}

	_getChildrenArray(layers, slice, player) {
		const childrenArray = [];
		layers.forEach((layerObject) => {
			if (layerObject) {
				const layerProperties = layerObject.properties || {};
				const {
					entryForward, exitBackward, exitForward, entryBackward,
				} = layerProperties;

				// Create a new link object, using this link object's slice as the parent slice
				const parentInformation = {
					slice,
					layerIndex: childrenArray.length,
				};
				const linkObject = new LinkObject(layerObject, player, this._textOptions,
					parentInformation);

				const child = { linkObject };
				let actualHalfTransition = null;

				// Handle half transitions
				actualHalfTransition = Transition.getValidHalfTransition(entryForward);
				if (actualHalfTransition) {
					child.entryForward = actualHalfTransition;
				}
				actualHalfTransition = Transition.getValidHalfTransition(entryBackward);
				if (actualHalfTransition) {
					child.entryBackward = actualHalfTransition;
				}
				actualHalfTransition = Transition.getValidHalfTransition(exitForward);
				if (actualHalfTransition) {
					child.exitForward = actualHalfTransition;
				}
				actualHalfTransition = Transition.getValidHalfTransition(exitBackward);
				if (actualHalfTransition) {
					child.exitBackward = actualHalfTransition;
				}

				// Handle transitions - which shall take precedence over half transitions
				if (layerProperties.transitionForward) {
					const transition = Transition.createTransition(layerProperties.transitionForward,
						player, this._textOptions);
					if (transition) {
						child.transitionForward = transition;
					}
				}
				if (layerProperties.transitionBackward) {
					const transition = Transition.createTransition(layerProperties.transitionBackward,
						player, this._textOptions);
					if (transition) {
						child.transitionBackward = transition;
					}
				}

				childrenArray.push(child);
			}
		});
		return childrenArray
	}

	static _getVisualAnimationsArray(animations) {
		const animationsArray = [];
		animations.forEach((animation) => {
			const { type, variable, keyframes } = animation || {};

			let shouldReturnDefaultValue = true;
			const animationType = returnValidValue("animationType", type,
				shouldReturnDefaultValue);

			shouldReturnDefaultValue = false; // No default value for an animation variable
			const animationVariable = returnValidValue("animationVariable", variable,
				shouldReturnDefaultValue);

			if (animationVariable !== null && keyframes && Array.isArray(keyframes)
				&& keyframes.length > 0) {

				const keyframesArray = [];
				keyframes.forEach((keyframe) => {
					const { key, value } = keyframe || {};
					const actualKeyframe = { key };

					let isKeyValid = (isANumber(key) === true && key >= 0);
					if (animationType === "point") {
						const validPoint = LinkObject._getValidPoint(key);
						if (validPoint) {
							actualKeyframe.key = validPoint;
							isKeyValid = true;
						} else {
							isKeyValid = false;
						}
					}

					// Note that only numbers are accepted as animation values
					if (isKeyValid === true && isANumber(value) === true) {
						actualKeyframe.value = value;
						keyframesArray.push(actualKeyframe);
					}
				});

				if (keyframesArray.length > 0) {
					animationsArray.push({ type: animationType, variable, keyframesArray });
				}
			}
		});
		return animationsArray
	}

}

class DivinaParser {

	constructor(player) {
		this._player = player;
	}

	loadFromPath(path, pathType) {
		return new Promise((resolve, reject) => {
			DivinaParser.loadJson(path, pathType)
				.then((json) => {
					resolve(this._buildStoryFromJson(json));
				})
				.catch((error) => {
					reject(error);
				});
		})
	}

	static loadJson(path, pathType) { // pathType = "manifest" || "folder"
		return new Promise((resolve, reject) => {
			if (!path) {
				reject(new Error("No path was specified"));
			}
			const xhr = new XMLHttpRequest();
			const manifestPath = (pathType === "manifest")
				? path
				: `${path}/${DEFAULT_MANIFEST_FILENAME}`;
			xhr.open("GET", manifestPath);
			xhr.responseType = "text";
			xhr.onload = () => {
				const text = xhr.response;
				try {
					const json = JSON.parse(text);
					resolve(json);
				} catch (error) {
					reject(error);
				}
			};
			xhr.onerror = (error) => {
				reject(error);
			};
			xhr.send();
		})
	}

	loadFromJson(json = null) {
		return new Promise((resolve, reject) => {
			if (json) {
				resolve(this._buildStoryFromJson(json));
			} else {
				reject(new Error("No json was passed"));
			}
		})
	}

	_buildStoryFromJson(json) {
		if (!json) {
			return { error: new Error("Manifest is null") }
		}

		const {
			metadata, links, readingOrder, guided,
		} = json;
		if (!metadata) {
			return { error: new Error("No metadata") }
		}
		if (!readingOrder) {
			return { error: new Error("No readingOrder") }
		}

		// If there is a link with rel="self" that has a scheme, then use the part of the href
		// before the manifest's filename as the default folder path
		const folderPath = DivinaParser._getFolderPathFromLinks(links);

		// Get relevant metadata
		this._metadata = this._parseMetadata(metadata);

		// Create link objects for readingOrder and guided (if present)
		this._mainLinkObjectsArray = this._parseObjectsList(readingOrder);
		if (guided) {
			this._guidedLinkObjectsArray = this._parseObjectsList(guided);
		}

		// Now create relevant building information for all possible page navigators
		const pageNavigatorsData = this._createPageNavigatorsData();

		return { folderPath, pageNavigatorsData }
	}

	static _getFolderPathFromLinks(links) {
		if (!links || Array.isArray(links) === false || links.length === 0) {
			return null
		}
		let folderPath = null;
		links.forEach((link) => {
			const { rel, href } = link;
			if (rel === "self" && href && hasAScheme(href) === true) {
				folderPath = getFolderPathFromManifestPath(href);
			}
		});
		return folderPath
	}

	_parseMetadata(metadata) {
		const {
			readingProgression,
			language,
			presentation,
		} = metadata;

		const shouldReturnDefaultValue = true;

		const direction = returnValidValue("direction", readingProgression, shouldReturnDefaultValue);

		const {
			continuous,
			fit,
			clipped,
			overflow,
			hAlign,
			vAlign,
			spread,
			viewportRatio,
			// orientation,
			sounds,
			backgroundColor,
			fillColor,
			fontFamily,
			fontSize,
			lineHeight,
			letterSpacing,
		} = presentation || {};

		const storyContinuous = returnValidValue("continuous", continuous, shouldReturnDefaultValue);
		const storyFit = returnValidValue("fit", fit, shouldReturnDefaultValue);
		const storyClipped = returnValidValue("clipped", clipped, shouldReturnDefaultValue);
		const storyOverflow = returnValidValue("overflow", overflow, shouldReturnDefaultValue);
		const storyHAlign = returnValidValue("hAlign", hAlign, shouldReturnDefaultValue);
		const storyVAlign = returnValidValue("vAlign", vAlign, shouldReturnDefaultValue);
		const storySpread = returnValidValue("spread", spread, shouldReturnDefaultValue);

		// Keep viewport ratio if valid
		const storyViewportRatio = DivinaParser._getValidViewportRatio(viewportRatio);

		// Create a languagesArray that will always contain at least "unspecified"
		let languagesArray = ["unspecified"];
		if (language) {
			if (Array.isArray(language) === true) {
				languagesArray = [];
				language.forEach((languageItem) => {
					if (isAString(languageItem) === true) {
						languagesArray.push(languageItem);
					}
				});
			} else if (isAString(language) === true) {
				languagesArray = [language];
			}
		}

		// Create a soundsArray with valid (global) sounds only (global => no start or end values!)
		const soundsArray = [];
		if (sounds && Array.isArray(sounds) === true && sounds.length > 0) {
			sounds.forEach((sound) => {
				const shouldConsiderStartAndEnd = false;
				const soundAnimation = LinkObject.getValidSoundAnimation(sound, this._player,
					shouldConsiderStartAndEnd);
				if (soundAnimation) {
					soundsArray.push(soundAnimation);
				}
			});
		}

		// Create text options

		const storyBackgroundColor = returnValidValue("backgroundColor", backgroundColor,
			shouldReturnDefaultValue);
		const storyFillColor = returnValidValue("fillColor", fillColor, shouldReturnDefaultValue);
		const storyFontFamily = returnValidValue("fontFamily", fontFamily, shouldReturnDefaultValue);
		const storyFontSize = returnValidValue("fontSize", fontSize, shouldReturnDefaultValue);
		const storyLineHeight = returnValidValue("lineHeight", lineHeight, shouldReturnDefaultValue);
		const storyLetterSpacing = returnValidValue("letterSpacing", letterSpacing,
			shouldReturnDefaultValue);

		this._textOptions = {
			hAlign: storyHAlign,
			vAlign: storyVAlign,
			backgroundColor: storyBackgroundColor,
			fillColor: storyFillColor,
			fontFamily: storyFontFamily,
			fontSize: storyFontSize,
			lineHeight: storyLineHeight,
			letterSpacing: storyLetterSpacing,
		};

		return {
			direction,
			continuous: storyContinuous,
			fit: storyFit,
			clipped: storyClipped,
			overflow: storyOverflow,
			hAlign: storyHAlign,
			vAlign: storyVAlign,
			spread: storySpread,
			viewportRatio: storyViewportRatio || {},
			languagesArray,
			soundsArray,
		}
	}

	// Check viewport ratio (note that the "exact" constraint is forced as the default)
	static _getValidViewportRatio(viewportRatio) {
		if (!viewportRatio) {
			return null
		}
		const { constraint, aspectRatio } = viewportRatio;
		if (isAString(aspectRatio) === false) {
			return null
		}
		const numeratorAndDenominator = aspectRatio.split(":");
		if (numeratorAndDenominator.length !== 2) {
			return null
		}
		const numerator = Number(numeratorAndDenominator[0]);
		const denominator = Number(numeratorAndDenominator[1]);
		if (isANumber(numerator) === false || numerator <= 0
			|| isANumber(denominator) === false || denominator <= 0) {
			return null
		}
		const shouldReturnDefaultValue = true;
		const storyConstraint = returnValidValue("constraint", constraint, shouldReturnDefaultValue);
		return { constraint: storyConstraint, aspectRatio }
	}

	_parseObjectsList(divinaObjectsList) {
		if (!divinaObjectsList || Array.isArray(divinaObjectsList) === false) {
			return []
		}
		const objectsArray = [];
		divinaObjectsList.forEach((divinaObject) => {
			if (divinaObject) {
				const linkObject = new LinkObject(divinaObject, this._player, this._textOptions);
				objectsArray.push(linkObject);
			}
		});
		return objectsArray
	}

	_createPageNavigatorsData() {
		const {
			direction,
			continuous,
			fit,
			clipped,
			overflow,
			hAlign,
			vAlign,
			spread,
			viewportRatio,
			languagesArray,
			soundsArray,
		} = this._metadata;

		// Keep only useful data in the metadata object shared by all page navigators
		const cleanMetadata = {
			direction,
			continuous,
			fit,
			clipped,
			overflow,
			hAlign,
			vAlign,
			spread,
			viewportRatio,
			languagesArray,
		};
		const pageNavigatorsData = { metadata: cleanMetadata };

		// Create a "scroll" page navigator for a Divina with continuous=true
		if (continuous === true) {
			pageNavigatorsData.scroll = DivinaParser._createPageNavigatorData("scroll",
				this._mainLinkObjectsArray, soundsArray);

		// Create a "single" page navigator for a Divina with continuous=false
		} else {
			pageNavigatorsData.single = DivinaParser._createPageNavigatorData("single",
				this._mainLinkObjectsArray, soundsArray);

			// Also create a "double" page navigator if the double page reading mode is allowed
			if (spread !== "none") {
				const pageNavDirection = (direction === "rtl") ? "rtl" : "ltr";
				pageNavigatorsData.double = DivinaParser._createPageNavigatorData("double",
					this._mainLinkObjectsArray, soundsArray, pageNavDirection);
			}
		}

		// Create a "guided" page navigator if the Divina has a guided object
		if (this._guidedLinkObjectsArray && this._guidedLinkObjectsArray.length > 0) {
			pageNavigatorsData.guided = DivinaParser._createPageNavigatorData("guided",
				this._guidedLinkObjectsArray, soundsArray);
		}

		return pageNavigatorsData
	}

	static _createPageNavigatorData(pageNavType, linkObjectsArray, globalSoundsArray, direction) {
		// Each page navigator will also have a metadata object
		// (in adddition to shared metadata) with specific information
		let metadata = { hasSounds: false };
		let grouping = null;

		switch (pageNavType) {
		case "single":
			grouping = "single";
			break
		case "double":
			metadata = {
				direction, // Direction will be forced to either "ltr" or "rtl"
				forcedFit: "contain",
				forcedClipped: false,
				forcedTransitionType: "cut", // Transitions will be discarded
			};
			grouping = "double";
			break
		case "scroll":
			grouping = "stitched";
			break
		case "guided":
			metadata = {
				forcedFit: "contain",
				forcedClipped: false,
			};
			grouping = "single";
			break
		}

		const pageNavData = { metadata, pagesDataArray: [] };

		if (globalSoundsArray && globalSoundsArray.length > 0) {
			pageNavData.metadata.hasSounds = true;
			pageNavData.globalSoundsArray = globalSoundsArray;
		}

		let pageData = { segmentsDataArray: [] };
		let segmentData = {};

		let pageIndex = -1;
		let pageSegmentIndex = 0;
		let segmentIndex = 0;

		if (grouping === "single" || grouping === "stitched") {
			linkObjectsArray.forEach((linkObject) => {
				const {
					slice,
					hAlign,
					vAlign,
					transitionForward,
					transitionBackward,
					snapPointsArray,
					soundAnimationsArray,
					childrenArray,
				} = linkObject;
				// Note that visualAnimationsArray will only be considered in a child link object

				// It is time to create a new page...
				if (pageIndex === -1 // ... if we are at the beginning of the story
					|| grouping === "single" // ... or with each new resource in a discontinuous story
					|| transitionForward) { // ... or with each new "chapter" in a "chaptered webtoon"
					if (pageIndex !== -1) {
						pageNavData.pagesDataArray.push(pageData);
					}
					pageIndex += 1;
					pageSegmentIndex = 0;
					pageData = { segmentsDataArray: [] };
					segmentData = {};
				}

				// Add information to the slice to specify in which page and segment it appears
				slice.setPageNavInfo(pageNavType, { pageIndex, pageSegmentIndex, segmentIndex });
				segmentData.sliceId = slice.id;

				// Store align values at segment level for future use (see below)
				if (hAlign) {
					segmentData.hAlign = hAlign;
				}
				if (vAlign) {
					segmentData.vAlign = vAlign;
				}

				// Only consider transitions on the first segment of a page
				if (transitionForward && pageSegmentIndex === 0) {
					const isForward = true;
					const { entry, exit } = Transition.getEntryAndExitTransitions(transitionForward,
						isForward);
					if (pageIndex > 0 && exit) {
						pageNavData.pagesDataArray[pageIndex - 1].exitForward = exit;
					}
					pageData.entryForward = entry;

					if (transitionForward.slice) {
						transitionForward.slice.setPageNavInfo(pageNavType, {
							pageIndex, pageSegmentIndex, segmentIndex,
						});
					}
				}
				if (transitionBackward && pageSegmentIndex === 0) {
					const isForward = false;
					const { entry, exit } = Transition.getEntryAndExitTransitions(transitionBackward,
						isForward);
					if (pageIndex > 0 && entry) {
						pageNavData.pagesDataArray[pageIndex - 1].entryBackward = entry;
					}
					pageData.exitBackward = exit;

					if (transitionBackward.slice) {
						transitionBackward.slice.setPageNavInfo(pageNavType, {
							pageIndex, pageSegmentIndex, segmentIndex,
						});
					}
				}

				// Handle snap points
				if (snapPointsArray && snapPointsArray.length > 0) {
					segmentData.snapPointsArray = snapPointsArray;
				}

				// Handle sounds
				if (soundAnimationsArray && soundAnimationsArray.length > 0) {
					pageNavData.metadata.hasSounds = true;
					segmentData.soundAnimationsArray = soundAnimationsArray;
				}

				// Handle child link objects
				if (childrenArray && childrenArray.length > 0) {
					segmentData.childrenArray = [];
					childrenArray.forEach((child, i) => {
						if (child.linkObject && child.linkObject.slice) {
							const childLinkObject = child.linkObject;
							const childSlice = childLinkObject.slice;
							childSlice.setPageNavInfo(pageNavType, {
								pageIndex, pageSegmentIndex, segmentIndex,
							});
							const childData = { sliceId: childSlice.id };

							// Deal with transitions
							if (child.entryForward) {
								childData.entryForward = child.entryForward;
							}
							if (child.entryBackward) {
								childData.entryBackward = child.entryBackward;
							}
							if (child.exitForward) {
								childData.exitForward = child.exitForward;
							}
							if (child.exitBackward) {
								childData.exitBackward = child.exitBackward;
							}
							if (childLinkObject.transitionForward) {
								const transition = childLinkObject.transitionForward;
								const isForward = true;
								const { entry, exit } = Transition.getEntryAndExitTransitions(transition, isForward);
								if (i > 0 && exit) {
									segmentData.childrenArray[i - 1].exitForward = exit;
								}
								childData.entryForward = entry;
							}
							if (childLinkObject.transitionBackward) {
								const transition = childLinkObject.transitionBackward;
								const isForward = false;
								const { entry, exit } = Transition.getEntryAndExitTransitions(transition, isForward);
								if (i > 0 && entry) {
									segmentData.childrenArray[i - 1].entryBackward = entry;
								}
								childData.exitBackward = exit;
							}

							// For visual animations (necessarily carried by a child)
							if (childLinkObject.visualAnimationsArray
								&& childLinkObject.visualAnimationsArray.length > 0) {
								childData.visualAnimationsArray = childLinkObject.visualAnimationsArray;
							}

							// Note that animation transitions are not allowed for child layers
							segmentData.childrenArray.push(childData);
						}
					});
				}

				pageSegmentIndex += 1;
				segmentIndex += 1;

				pageData.segmentsDataArray.push(segmentData);
				segmentData = {};
			});

		} else if (grouping === "double") {
			// Snap points, animations and non-global sounds are discarded - and transitions forced to cut

			let lastPageSide = null;
			let isLonely = false;

			linkObjectsArray.forEach((linkObject, i) => {
				const { slice } = linkObject;
				const { pageSide } = slice || {};

				if (pageIndex === -1
					|| (direction === "ltr" && (lastPageSide !== "left" || pageSide !== "right"))
					|| (direction === "rtl" && (lastPageSide !== "right" || pageSide !== "left"))) {

					if (pageIndex !== -1) {
						pageNavData.pagesDataArray.push(pageData);
					}

					pageIndex += 1;
					pageSegmentIndex = 0;
					pageData = { segmentsDataArray: [] };

					const nextLinkObject = (i < linkObjectsArray.length - 1)
						? linkObjectsArray[i + 1]
						: null;
					const nextPageSide = (nextLinkObject && nextLinkObject.slice)
						? nextLinkObject.slice.pageSide
						: null;
					if (direction === "ltr") {
						pageSegmentIndex = (pageSide === "right") ? 1 : 0;
						if (pageSide === "right"
							|| (pageSide === "left" && nextPageSide !== "right")) {
							// A segment is "alone" if pageSide="center", but it is not "lonely",
							// in the sense that we don't need to create an empty segment next to it
							isLonely = true;
						}
					} else { // direction === "rtl"
						pageSegmentIndex = (pageSide === "left") ? 1 : 0;
						if (pageSide === "left"
							|| (pageSide === "right" && nextPageSide !== "left")) {
							// Same as above
							isLonely = true;
						}
					}
				}

				slice.setPageNavInfo(pageNavType, {
					pageIndex, pageSegmentIndex, segmentIndex, isLonely,
				});

				if (isLonely === true) {
					if (pageSegmentIndex === 0) {
						segmentData = { sliceId: slice.id };
						pageData.segmentsDataArray.push(segmentData);

						// Add an empty segment
						segmentData = {};
						pageData.segmentsDataArray.push(segmentData);
						segmentIndex += 1; // Note that empty segments will also have an index

					} else { // pageSegmentIndex === 1
						// Add an empty segment
						segmentData = {};
						pageData.segmentsDataArray.push(segmentData);
						segmentIndex += 1; // Note that empty segments will also have an index

						segmentData = { sliceId: slice.id };
						pageData.segmentsDataArray.push(segmentData);
					}

				} else {
					segmentData = { sliceId: slice.id };
					pageData.segmentsDataArray.push(segmentData);
				}

				isLonely = false;
				lastPageSide = pageSide;

				pageSegmentIndex += 1;
				segmentIndex += 1;
			});
		}

		// Do not forget to add the last created page to the page count and pagesDataArray
		pageIndex += 1;
		pageNavData.pagesDataArray.push(pageData);

		// Set hAlign and vAlign for each page based on their first link objects (if there is
		// more than one link object in the page, hAlign and vAlign will not be taken into account
		// in Camera anyway, since the size getter in Page will force a non-overflowing size)
		pageNavData.pagesDataArray.forEach(({ segmentsDataArray = [] }, i) => {
			if (segmentsDataArray.length === 1) {
				const firstSegmentData = segmentsDataArray[0];
				if (firstSegmentData.hAlign) {
					pageNavData.pagesDataArray[i].hAlign = firstSegmentData.hAlign;
				}
				if (firstSegmentData.vAlign) {
					pageNavData.pagesDataArray[i].vAlign = firstSegmentData.vAlign;
				}
			}
		});

		return pageNavData
	}

}

class TagManager {

	get tags() { return this._tags }

	constructor(languagesArray, slices, resourceManager) {
		this._tags = {
			language: {
				array: languagesArray,
				index: null,
			},
		};
		this._populateTags(slices, resourceManager);
	}

	_populateTags(slices, resourceManager) {
		Object.values(slices).forEach((slice) => {
			const {
				resourceInfoArray, arrayOfResourceInfoArray,
			} = slice;
			const fullResourcesArray = arrayOfResourceInfoArray || [resourceInfoArray];
			fullResourcesArray.forEach((individualResourceInfoArray) => {
				this._populateTagsForResourceInfoArray(individualResourceInfoArray, resourceManager);
			});
		});
	}

	_populateTagsForResourceInfoArray(resourceInfoArray, resourceManager) {
		resourceInfoArray.forEach((mainOrAlt) => {

			const { id } = mainOrAlt;

			if (id === undefined && mainOrAlt.language) { // For a text version
				const languagesArray = this._tags.language.array;
				if (languagesArray.includes(mainOrAlt.language) === false) {
					languagesArray.push(mainOrAlt.language);
				}

			} else { // For a resource version
				const resource = resourceManager.getResourceWithId(id);
				const { tags = {} } = resource || {};
				Object.entries(tags).forEach(([tagName, tagValue]) => {
					if (POSSIBLE_TAG_NAMES.includes(tagName) === true) {
						if (!this._tags[tagName]) {
							this._tags[tagName] = {
								array: [tagValue],
								index: null,
							};
						} else if (this._tags[tagName].array.includes(tagValue) === false) {
							this._tags[tagName].array.push(tagValue);
						}
					}
				});
			}
		});
	}

	setTag(tagName, tagValue) {
		if (!this._tags[tagName]) {
			return false
		}

		const { array } = this._tags[tagName];
		const index = array.indexOf(tagValue);
		if (index < 0) {
			return false
		}

		this._tags[tagName].index = index;

		return true
	}

	// Used in VideoTexture (for fallbacks) and Slice (for alternates)
	getBestMatchForCurrentTags(idPathFragmentAndTagsArray) {
		let id = null;
		let path = null;
		let fragment = null;

		let nbOfExactlyMatchingConditions = 0;
		let nbOfPassableConditions = 0;
		let maxReachedNbOfExactlyMatchingConditions = 0;
		let maxReachedNbOfPassableConditions = 0;

		// Check which fallback is most appropriate
		idPathFragmentAndTagsArray.forEach((idPathFragmentAndTagsItem) => {
			nbOfExactlyMatchingConditions = 0;
			nbOfPassableConditions = 0;

			POSSIBLE_TAG_NAMES.forEach((tagName) => {
				const { array, index } = this._tags[tagName] || {};
				if (index !== undefined && array && index < array.length) {
					const tagValue = array[index];
					if (idPathFragmentAndTagsItem[tagName] === tagValue) {
						nbOfExactlyMatchingConditions += 1;
					} else if (idPathFragmentAndTagsItem[tagName] === undefined) {
						nbOfPassableConditions += 1;
					}
				}
			});

			if (nbOfExactlyMatchingConditions > maxReachedNbOfExactlyMatchingConditions) {
				maxReachedNbOfExactlyMatchingConditions = nbOfExactlyMatchingConditions;
				maxReachedNbOfPassableConditions = nbOfPassableConditions;
				id = idPathFragmentAndTagsItem.id;
				path = idPathFragmentAndTagsItem.path;
				fragment = idPathFragmentAndTagsItem.fragment;

			} else if (nbOfExactlyMatchingConditions === maxReachedNbOfExactlyMatchingConditions
				&& nbOfPassableConditions > maxReachedNbOfPassableConditions) {
				maxReachedNbOfPassableConditions = nbOfPassableConditions;
				id = idPathFragmentAndTagsItem.id;
				path = idPathFragmentAndTagsItem.path;
				fragment = idPathFragmentAndTagsItem.fragment;
			}
		});

		return { id, path, fragment }
	}

}

class LayerTransition {

	get controlled() { return this._controlled }

	get slice() { return this._slice }

	get isRunning() { return this._isRunning }

	constructor(handler, layer, isExiting, entryOrExit, player) {
		this._handler = handler;
		this._layer = layer;
		this._isExiting = isExiting;
		this._player = player;

		this._type = "cut";
		this._controlled = false;

		this._startTime = null;
		this._isRunning = true;

		const {
			type, duration, direction, sliceType, slice, controlled,
		} = entryOrExit || {};

		if (!entryOrExit) {
			return
		}
		this._type = type;
		this._controlled = controlled;

		let actualDuration = duration;
		if (type !== "animation" || sliceType !== "video") {
			actualDuration = (duration !== undefined) ? duration : DEFAULT_DURATION;
			// A video animation is allowed to have no defined duration (it will play until the end)
			// Also, duration can be 0 for a "hide" layer transition
		}
		this._duration = actualDuration; // May still be undefined (but only for a video)

		if (type === "slide-in" || type === "slide-out") {
			this._direction = direction;

		} else if (type === "animation" && slice) {
			this._sliceType = sliceType;
			this._slice = slice;

			if (sliceType === "video" && slice && !actualDuration) {
				this._slice.setDoOnEnd(this.end.bind(this));
			}
			this._slice.resize();
		}
	}

	start(startTime) {
		// If the layerTransition is a video or sequence with no duration,
		// or a sequence with no frames loaded, skip it
		if (this._sliceType && (!this._slice || this._slice.canPlay === false)) {
			this.end();

		// Otherwise play the layerTransition
		} else {

			if (this._slice) {
				this._slice.setIsInViewport(true);
				this._slice.finalizeEntry(); // Start playing the transition sequence or video

			} else if (this._type === "slide-in" || this._type === "slide-out") {
				// Prevent resize from impacting the content's position
				const { content } = this._layer;
				if (this._direction === "ltr" || this._direction === "rtl") {
					content.setIsXPositionUpdating(true);
				} else if (this._direction === "ttb" || this._direction === "btt") {
					content.setIsYPositionUpdating(true);
				}
			}

			this._startTime = startTime;
			this._run(null);
		}
	}

	// The function will below shall loop if layerTransitionPercent !== null
	_run(layerTransitionPercent = null) {
		this._player.refreshOnce();

		if (this._isRunning === false) {
			return
		}

		let percent = 1;
		if (layerTransitionPercent !== null) {
			percent = layerTransitionPercent;

		// Note that this._duration may still be undefined for a video
		} else if (this._duration && this._duration > 0) {
			percent = (Date.now() - this._startTime) / this._duration;

		// Play a video transition until percent=1
		} else if (this._sliceType === "video" && this._slice) {
			percent = 0;
		}

		const { stateChange } = this._handler;

		// If the user has forced the transition to its end...
		if (stateChange.shouldForceToEnd === true
			// ... or if it is not a video running to its end, and it has actually ended,
			// end transition if percent=1, except if percent is given by layerTransitionPercent
			|| (percent >= 1 && layerTransitionPercent !== 1)) {
			this.end();

		// Otherwise just apply the required changes based on time
		} else if (this._type === "animation") {
			if (layerTransitionPercent === null) {
				// Continue playing the layerTransition, waiting for its eventual end
				requestAnimationFrame(this._run.bind(this, null));
			}

		} else {
			const { viewportRect } = this._handler;
			const { width, height } = viewportRect;
			const { content } = this._layer;

			if (this._type === "fade-in") {
				content.setAlpha(percent);
			} else if (this._type === "fade-out") {
				content.setAlpha(1 - percent);
			} else if (this._type === "slide-in") {
				switch (this._direction) {
				case "ltr":
					content.setXOffset((percent - 1) * width);
					break
				case "rtl":
					content.setXOffset((1 - percent) * width);
					break
				case "ttb":
					content.setYOffset((percent - 1) * height);
					break
				case "btt":
					content.setYOffset((1 - percent) * height);
					break
				}
			} else if (this._type === "slide-out") {
				switch (this._direction) {
				case "ltr":
					content.setXOffset(percent * width);
					break
				case "rtl":
					content.setXOffset(-percent * width);
					break
				case "ttb":
					content.setYOffset(percent * height);
					break
				case "btt":
					content.setYOffset(-percent * height);
					break
				}
			}
			if (this._type !== "hide") {
				content.setVisibility(true);
			}

			if (layerTransitionPercent === null) {
				requestAnimationFrame(this._run.bind(this, null));
			}
		}
	}

	end() {
		this._player.refreshOnce();
		this._isRunning = false;

		const { content } = this._layer || {};
		LayerTransition._resetLayerContent(content);
		LayerTransition._removeTemporarySlice(this._slice);

		if (this._isExiting === true) {
			this._layer.finalizeExit();
			content.removeFromParent();
		} else {
			this._layer.finalizeEntry();
		}

		this._handler.notifyTransitionEnd();
	}

	static _resetLayerContent(content) {
		if (!content) {
			return
		}
		content.setAlpha(1);
		content.setVisibility(true);
		content.setIsXPositionUpdating(false);
		content.setIsYPositionUpdating(false);
		content.resetPosition();
	}

	static _removeTemporarySlice(sequenceOrVideoSlice) {
		if (!sequenceOrVideoSlice) {
			return
		}
		sequenceOrVideoSlice.finalizeExit();
		sequenceOrVideoSlice.removeFromParent();
	}

	goToIntermediateState(percent) {
		this._run(percent);
	}

	cancel() {
		this._isRunning = false;

		const { content } = this._layer || {};
		LayerTransition._resetLayerContent(content);
		LayerTransition._removeTemporarySlice(this._slice);

		// Stop and remove an added layer
		if (this._isExiting === false) {
			this._layer.finalizeExit();
			content.removeFromParent();
		}
	}

	resize() {
		if (!this._slice) {
			return
		}
		this._slice.resize();
	}

}

class StateHandler {

	get type() { return this._type }

	// Used in LayerPile

	get isAtStart() { return (this._statesArray.length === 0 || this._stateIndex === 0) }

	get isAtEnd() {
		return (this._statesArray.length === 0
			|| this._stateIndex === this._statesArray.length - 1)
	}

	get isUndergoingChanges() { return (this._currentStateChange.status !== "none") }

	// Used in PageNavigator

	get isUndergoingControlledChanges() { return (this._currentStateChange.status === "controlled") }

	get stateIndex() { return this._stateIndex }

	// Used in LayerTransition

	get stateChange() { return this._currentStateChange }

	get viewportRect() { return this._player.viewportRect }

	constructor(layerPile, shouldStateLayersCoexistOutsideTransitions = false, player) {
		this._layerPile = layerPile;
		this._shouldStateLayersCoexistOutsideTransitions = shouldStateLayersCoexistOutsideTransitions;
		this._player = player;

		this._type = "stateHandler";

		// this._isLooping = false

		const { layersArray } = layerPile;

		// The _statesArray lists for each state the indices of the layers to add
		// (shouldStateLayersCoexistOutsideTransitions specifies what to do with already present layers)
		this._statesArray = this._createStatesArray(layersArray);

		this._stateIndex = null;
		this._resetStateChange();

		this._stateDeltaForTransitionControl = null;
	}

	_createStatesArray(layersArray) {
		// For a PageNavigator (in particular)
		if (this._shouldStateLayersCoexistOutsideTransitions === false) {
			return layersArray.map((_, i) => ([i]))
		}

		// While for a multi-layer Segment...
		const statesArray = [];
		let newLayerIndicesForState = [];
		for (let i = 0; i < layersArray.length; i += 1) {
			const layer = layersArray[i];
			const { entryForward } = layer || {}; // Strong decision: only those are taken into account
			// (i.e. we're not considering possibly mismatched backwardEntries to build the list)
			if (entryForward && entryForward.isDiscontinuous === true && i !== 0) {
				statesArray.push(newLayerIndicesForState);
				newLayerIndicesForState = [i];
			} else {
				newLayerIndicesForState.push(i);
			}
		}
		statesArray.push(newLayerIndicesForState);
		return statesArray
	}

	_resetStateChange() {
		this._currentStateChange = {
			status: "none",
			isGoingForward: true,
			layerTransitionsArray: [],
			shouldForceToEnd: false,
			endCallback: null,
			newStateIndex: null,
		};
	}

	// Used here and in PageNavigator
	forceChangesToEnd(callback, isGoingForward) {
		// Only run the callback if the movement directions differ
		if (isGoingForward !== this._currentStateChange.isGoingForward) {
			if (this._currentStateChange.status === "none") {
				if (callback) {
					callback();
				}
				return
			} // else
			this._currentStateChange.endCallback = callback;
		}
		this._currentStateChange.shouldForceToEnd = true;
	}

	goToState(stateIndex, isGoingForward, shouldSkipTransition = false, isChangeControlled = false) {
		if (stateIndex < 0 || stateIndex >= this._statesArray.length) {
			return false
		}

		const {
			layerIndicesToAdd, layerIndicesToRemove,
		} = this._createLayerIndicesToAddAndRemove(stateIndex, isGoingForward);

		if (layerIndicesToAdd.length === 0 && layerIndicesToRemove === 0) {
			this._resetStateChange(); // To counter the above shouldForceToEnd = true
			return false
		}

		const layerTransitionsArray = this._createLayerTransitions(layerIndicesToAdd,
			layerIndicesToRemove, isGoingForward);

		if (isChangeControlled === true) {
			let hasControlledTransitions = false;
			layerTransitionsArray.forEach((layerTransition) => {
				const { controlled } = layerTransition;
				if (controlled === true) {
					hasControlledTransitions = true;
				}
			});

			if (hasControlledTransitions === false) {
				return false
			}
		}

		const oldStateIndex = this._stateIndex;
		layerIndicesToAdd.forEach((layerIndex) => {
			const layer = this._layerPile.getLayerAtIndex(layerIndex);
			this._addLayerContent(layer, layerIndex, isGoingForward, oldStateIndex);
		});

		layerTransitionsArray.forEach((layerTransition) => {
			const { slice } = layerTransition;
			if (slice) {
				this._layerPile.addChild(slice);
			}
		});

		this._currentStateChange.status = "initiated";
		this._currentStateChange.isGoingForward = isGoingForward;
		this._currentStateChange.layerTransitionsArray = layerTransitionsArray;
		this._currentStateChange.newStateIndex = stateIndex;

		// If transitions are to be cancelled, force them to end
		if (shouldSkipTransition === true) {
			this._currentStateChange.shouldForceToEnd = true;
		}

		if (this._layerPile.doOnStateChangeStartOrCancel) {
			this._layerPile.doOnStateChangeStartOrCancel(stateIndex, isGoingForward);
		}

		if (isChangeControlled === true) {
			this._currentStateChange.status = "controlled";

		} else {
			this._currentStateChange.status = "looping";

			// Start all layer transitions
			const startTime = Date.now();
			layerTransitionsArray.forEach((layerTransition) => {
				layerTransition.start(startTime);
			});
		}

		return true
	}

	_createLayerIndicesToAddAndRemove(stateIndex, isGoingForward) {
		let layerIndicesToRemove = [];
		let layerIndicesToAdd = [];

		// For page transitions
		if (this._shouldStateLayersCoexistOutsideTransitions === false) {
			if (this._stateIndex !== null) { // No this._stateIndex on first goToState
				layerIndicesToRemove = this._statesArray[this._stateIndex];
			}
			layerIndicesToAdd = this._statesArray[stateIndex];

		// For layer transitions
		} else if (isGoingForward === true
			|| stateIndex === this._statesArray.length - 1) { // Same approach when coming back indeed
			let i = (stateIndex === this._statesArray.length - 1) ? 0 : (this._stateIndex || 0);
			while (i < stateIndex && i < this._statesArray.length) {
				this._statesArray[i].forEach((layerIndex) => {
					const layer = this._layerPile.getLayerAtIndex(layerIndex);
					this._addLayerContent(layer, layerIndex, isGoingForward, this._stateIndex || 0);
					const { content } = layer || {};
					content.setVisibility(true);
					layer.finalizeEntry();
					// Do note that those layers are added right away, and thus will not appear
					// in layerIndicesToAdd, which is only concerned with the final layer,
					// for which an entry layerTransition may play!
				});
				i += 1;
			}
			if (i === stateIndex) {
				layerIndicesToAdd.push(...this._statesArray[i]);
			}
		} else { // Going backward (i.e. stateIndex < this._stateIndex)
			let i = this._statesArray.length - 1;
			while (i > stateIndex && i >= 0) {
				layerIndicesToRemove.push(...this._statesArray[i]);
				i -= 1;
			}
		}

		return { layerIndicesToAdd, layerIndicesToRemove }
	}

	_addLayerContent(layer, layerIndex, isGoingForward, oldStateIndex) {
		// Make content invisible (in case a fade-in has to be run)
		const { content } = layer || {};
		content.setVisibility(false);

		// Add new layer at appropriate depth
		const depth = this._layerPile.getDepthOfNewLayer(oldStateIndex, isGoingForward);
		this._layerPile.addChildAtIndex(content, depth);

		layer.setupForEntry(isGoingForward);
	}

	_createLayerTransitions(layerIndicesToAdd, layerIndicesToRemove, isGoingForward) {
		const layerTransitionsArray = [];

		layerIndicesToAdd.forEach((layerIndex) => {
			const layer = this._layerPile.getLayerAtIndex(layerIndex);
			const { entryForward, entryBackward } = layer || {};
			const entry = (isGoingForward === true) ? entryForward : entryBackward;
			const isExiting = false;
			const layerTransition = new LayerTransition(this, layer, isExiting, entry, this._player);
			layerTransitionsArray.push(layerTransition);
		});

		layerIndicesToRemove.forEach((layerIndex) => {
			const layer = this._layerPile.getLayerAtIndex(layerIndex);
			const { exitForward, exitBackward } = layer || {};
			const exit = (isGoingForward === true) ? exitForward : exitBackward;
			const isExiting = true;
			const layerTransition = new LayerTransition(this, layer, isExiting, exit, this._player);
			layerTransitionsArray.push(layerTransition);
		});

		return layerTransitionsArray
	}

	notifyTransitionEnd() {
		const { layerTransitionsArray } = this._currentStateChange;
		const runningLayerTransitions = layerTransitionsArray.filter(
			({ isRunning }) => (isRunning === true),
		);
		const nbOfRunningLayerTransitions = runningLayerTransitions.length;
		if (nbOfRunningLayerTransitions === 0) {
			this._endStateChange();
		}
	}

	_endStateChange() {
		const { newStateIndex, endCallback } = this._currentStateChange;

		this._stateIndex = newStateIndex;

		this._layerPile.finalizeEntry();
		// Note that, in all rigor, this is not a true entry, since a PageNavigator hasn't
		// actually achieved an "entry" when a transition has ruled a page change (however the
		// recursive nature of the function also allows the slices of a multi-layered segments
		// with a layer transition to play automatically on the transition's end, for instance)

		this._resetStateChange();

		// Run the callback if there was one
		if (endCallback) {
			endCallback();
		}
	}

	_cancelStateChange() {
		const { layerTransitionsArray } = this._currentStateChange;
		layerTransitionsArray.forEach((layerTransition) => {
			layerTransition.cancel();
		});

		this._resetStateChange();

		if (this._layerPile.doOnStateChangeStartOrCancel) {
			this._layerPile.doOnStateChangeStartOrCancel(this.stateIndex);
		}
	}

	// Functions linked to role in LayerPile

	attemptToGoForward(shouldSkipTransition = false, doIfIsUndergoingChanges = null,
		percent = null) {
		// Disable any new change while a controlled state change is under way
		if (this.isUndergoingControlledChanges === true) {
			return true
		}
		const isGoingForward = true;
		// If a (discontinuous) state change is under way
		if (this.isUndergoingChanges === true) {
			// Force it to end if the movement goes the same way
			if (this._currentStateChange.isGoingForward === true) {
				this._currentStateChange.shouldForceToEnd = true;
			// Otherwise cancel it to bring the situation back to the initial state
			} else {
				this._cancelStateChange();
			}
			return true
		}
		if (this._statesArray.length === 0 || this._stateIndex >= this._statesArray.length - 1) {
			return false
		}
		this.goToState(this._stateIndex + 1, isGoingForward, shouldSkipTransition, percent);
		return true
	}

	attemptToGoBackward(shouldSkipTransition = false, doIfIsUndergoingChanges = null,
		percent = null) {
		if (this.isUndergoingControlledChanges === true) {
			return true
		}
		const isGoingForward = false;
		if (this.isUndergoingChanges === true) {
			if (this._currentStateChange.isGoingForward === false) {
				this._currentStateChange.shouldForceToEnd = true;
			} else {
				this._cancelStateChange();
			}
			return true
		}
		if (this._statesArray.length === 0 || this._stateIndex === 0) {
			return false
		}
		this.goToState(this._stateIndex - 1, isGoingForward, shouldSkipTransition, percent);
		return true
	}

	// Go to start or end state depending on whether goes forward or not
	setupForEntry(isGoingForward) {
		this._resetStateChange();

		if (isGoingForward === true) {
			this.goToState(0, isGoingForward);
		} else { // Go to last state
			this.goToState(this._statesArray.length - 1, isGoingForward);
		}
	}

	finalizeExit() {
		this._stateIndex = null;
	}

	resize() {
		if (this.isUndergoingChanges === false) {
			return
		}
		const { layerTransitionsArray } = this._currentStateChange;
		layerTransitionsArray.forEach((layerTransition) => {
			layerTransition.resize();
		});
	}

	handleScroll(scrollData, isWheelScroll) {
		if (this._stateIndex === null) {
			return true
		}

		const layersArray = this._statesArray[this._stateIndex];
		if (layersArray.length === 1) {
			const layerIndex = layersArray[0];
			const layer = this._layerPile.getLayerAtIndex(layerIndex);
			const { content } = layer;
			if (content.handleScroll
				&& content.handleScroll(scrollData, isWheelScroll) === true) {
				return true
			}
		}

		if (isWheelScroll === true) {
			return true
		}

		const { viewportPercent } = scrollData;

		if (!this._stateDeltaForTransitionControl
			|| this.isUndergoingControlledChanges === false) {
			if (viewportPercent > 0) {
				this._stateDeltaForTransitionControl = 1;
			} else if (viewportPercent < 0) {
				this._stateDeltaForTransitionControl = -1;
			}

		} else if (this.isUndergoingControlledChanges === true) {
			let newStateDelta = null;
			if (viewportPercent > 0) {
				newStateDelta = 1;
			} else if (viewportPercent < 0) {
				newStateDelta = -1;
			}
			if (newStateDelta !== this._stateDeltaForTransitionControl) {
				const shouldBeAnimated = false;
				this.endControlledTransition(0, shouldBeAnimated);

				this._stateDeltaForTransitionControl = newStateDelta;
				const isGoingForward = (this._stateDeltaForTransitionControl > 0);
				const shouldSkipTransition = false;
				const isChangeControlled = true;
				return (this.goToState(this._stateIndex + this._stateDeltaForTransitionControl,
					isGoingForward, shouldSkipTransition, isChangeControlled) === true)
			}
		}

		if (this._stateDeltaForTransitionControl === 1
			|| this._stateDeltaForTransitionControl === -1) {

			// Continue controlling changes if controlled changed are under way
			if (this.isUndergoingControlledChanges === true) {
				let percent = viewportPercent * this._stateDeltaForTransitionControl;
				percent = Math.min(Math.max(percent, 0), 1);
				this.goToIntermediateState(percent);
				return true
			}

			// Otherwise attempt to start controlled changes
			const isGoingForward = (this._stateDeltaForTransitionControl > 0);
			const shouldSkipTransition = false;
			const isChangeControlled = true;
			return (this.goToState(this._stateIndex + this._stateDeltaForTransitionControl,
				isGoingForward, shouldSkipTransition, isChangeControlled) === true)
		}

		return false
	}

	goToIntermediateState(percent) {
		const { layerTransitionsArray } = this._currentStateChange;
		layerTransitionsArray.forEach((layerTransition) => {
			layerTransition.goToIntermediateState(percent);
		});
	}

	endControlledTransition(viewportPercent, shouldBeAnimated) {
		if (this._stateIndex === null) {
			return true
		}

		const layersArray = this._statesArray[this._stateIndex];
		if (layersArray.length === 1) {
			const layerIndex = layersArray[0];
			const layer = this._layerPile.getLayerAtIndex(layerIndex);
			const { content } = layer;
			if (content.endControlledTransition
				&& content.endControlledTransition(viewportPercent, shouldBeAnimated) === true) {
				return true
			}
		}

		if (this.isUndergoingControlledChanges === false) {
			return false
		}

		const percent = Math.abs(viewportPercent);
		if (percent >= 0.5) {
			const { layerTransitionsArray } = this._currentStateChange;
			layerTransitionsArray.forEach((layerTransition) => {
				layerTransition.end();
			});

		} else {
			this._cancelStateChange();
		}

		this._stateDeltaForTransitionControl = null;
		return true
	}

}

class Camera {

	get isZoomed() { return (this._zoomFactor !== 1) }

	// When the scene is jumping between two snap points, isAutoScrolling === true
	get isAutoScrolling() {
		return (this._jumpData) ? this._jumpData.isAutoScrolling : false
	}

	// In a scene that is larger than the viewport, isAtStart = true on reaching it going forward
	// (while a scene that is not larger than the viewport is considered to be always at its start)
	get isAtStart() {
		return (this.isZoomed === false && (this._progress === null || this._progress === 0))
	}

	// In a scene larger than the viewport, isAtEnd = true before leaving the scene going forward
	// (while a scene that is not larger than the viewport is considered to be always at its end)
	get isAtEnd() {
		return (this.isZoomed === false && (this._progress === null || this._progress === 1))
	}

	get _hasSpaceToMove() {
		return (Math.abs(this._maxX - this._minX) + Math.abs(this._maxY - this._minY) > 0)
	}

	constructor(scene, overflow, hAlign, vAlign, player) {
		// A scene is just a layerPile (in the Divina case, can only be a page)
		this._scene = scene;
		this._overflow = overflow;
		this._hAlign = hAlign;
		this._vAlign = vAlign;

		// Useful for viewportRect and updateDisplayForZoomFactor (and options just below)
		this._player = player;
		const { eventEmitter } = this._player;
		this._eventEmitter = eventEmitter;

		const { options } = player;
		const {
			allowsPaginatedScroll,
			isPaginationSticky,
			isPaginationGridBased,
		} = options;
		const shouldReturnDefaultValue = true;
		this._allowsPaginatedScroll = returnValidValue("allowsPaginatedScroll", allowsPaginatedScroll,
			shouldReturnDefaultValue);
		this._isPaginationSticky = returnValidValue("isPaginationSticky", isPaginationSticky,
			shouldReturnDefaultValue);
		this._isPaginationGridBased = returnValidValue("isPaginationGridBased", isPaginationGridBased,
			shouldReturnDefaultValue);

		this._inScrollDirection = null;
		this._relativeStart = null;
		this._relativeEnd = null;
		this._referenceDimension = null;

		// The distance to cover can change on a resize (because of the change in viewportRect),
		// but it cannot not change with a change in zoomFactor (the value is the one that applies
		// when zoomFactor === 1; it is always positive)
		this._distanceToCover = 0;

		// The below values can necessarily change on a resize, but also with a zoom change
		this._progress = null; // However if null, progress remains null whatever the zoomFactor
		this._minX = 0; // Minimum value for the camera center's coordinate on the x axis
		this._maxX = 0;
		this._minY = 0;
		this._maxY = 0;
		this._currentPosition = { x: 0, y: 0 }; // Camera center in non-scaled/non-zoomed referential
		this._signedPercent = null; // Signed % of currentPosition x or y over full scene width or height

		this._segmentsInfoArray = [];

		this._snapPointsArray = [];
		this._reset();
		this._possibleError = 0;
		this._paginationProgressStep = null;
		this._lastNonTemporaryProgress = null;

		this._sliceAnimationsArray = null;
		this._soundAnimationsArray = null;

		this._zoomFactor = 1;
		this._zoomTouchPoint = null;
	}

	_reset() {
		this._jumpData = {
			isAutoScrolling: false,
			startDate: null,
			duration: 0,
			startProgress: null,
			targetProgress: null,
			shouldForceToEnd: false,
			endCallback: null,
		};
	}

	setInScrollDirection(inScrollDirection) {
		this._inScrollDirection = inScrollDirection;
		this._setRelativeStartAndEnd(inScrollDirection);
		this._setReferenceDimension(inScrollDirection);
	}

	// Based on the page's inScrollDirection, express the viewport "start"
	// and "end" points in relative coordinates (from the top left corner)
	_setRelativeStartAndEnd(inScrollDirection) {
		this._relativeStart = null;
		this._relativeEnd = null;
		switch (inScrollDirection) {
		case "ltr":
			this._relativeStart = { x: 0, y: 0.5 }; // Start is the middle left point
			this._relativeEnd = { x: 1, y: 0.5 }; // End is the middle right point
			break
		case "rtl":
			this._relativeStart = { x: 1, y: 0.5 };
			this._relativeEnd = { x: 0, y: 0.5 };
			break
		case "ttb":
			this._relativeStart = { x: 0.5, y: 0 };
			this._relativeEnd = { x: 0.5, y: 1 };
			break
		case "btt":
			this._relativeStart = { x: 0.5, y: 1 };
			this._relativeEnd = { x: 0.5, y: 0 };
			break
		}
	}

	_setReferenceDimension(inScrollDirection) {
		if (inScrollDirection === "ltr" || inScrollDirection === "rtl") {
			this._referenceDimension = "width";
		}
		if (inScrollDirection === "ttb" || inScrollDirection === "btt") {
			this._referenceDimension = "height";
		}
	}

	addSnapPoints(indexInLayerPile, snapPointsArray) {
		snapPointsArray.forEach((snapPoint) => {
			const fullSnapPoint = { ...snapPoint, pageSegmentIndex: indexInLayerPile };
			this._snapPointsArray.push(fullSnapPoint);
		});
	}

	addSliceAnimation(indexInLayerPile, slice, animation) {
		this._sliceAnimationsArray = this._sliceAnimationsArray || [];

		const fullAnimation = { ...animation };
		const { type, keyframesArray } = animation;
		if (type === "point") {
			keyframesArray.forEach((keyframe, i) => {
				fullAnimation.keyframesArray[i].key.pageSegmentIndex = indexInLayerPile;
			});
		}
		this._sliceAnimationsArray.push({ slice, animation: fullAnimation });
	}

	addSoundAnimation(indexInLayerPile, animation) {
		this._soundAnimationsArray = this._soundAnimationsArray || [];

		const fullAnimation = { ...animation };
		const { type } = animation;
		if (type === "point") {
			fullAnimation.start.pageSegmentIndex = indexInLayerPile;
			if (fullAnimation.end) {
				fullAnimation.end.pageSegmentIndex = indexInLayerPile;
			}
		} else { // If type === "progress", rewrite start and end to unify notation
			fullAnimation.start = { progress: fullAnimation.start };
			if (fullAnimation.end !== undefined) {
				fullAnimation.end = { progress: fullAnimation.end };
			}
		}
		this._soundAnimationsArray.push(fullAnimation);
	}

	// After an overflowHandler's _positionSegments() operation, so in particular after a resize:
	// - If the total length of all segments together is less than the relevant viewport dimension,
	// then the camera will not have space to move (but beware: this is only true if zoomFactor = 1),
	// so its start and end positions will be set to the center of the whole segment block (= scene)
	// - If not, _distanceToCover !== 0 (which will force _hasSpaceToMove = true) and the camera
	// respective to the first segment (e.g. if ltr: the camera's center is positioned so that the
	// camera's left side corresponds to the first segment's left side, where x = 0)
	// (Also, do note that small pixel errors are accounted for!)
	setBoundsAndUpdateOnResize() {
		const { viewportRect } = this._player;
		const { width, height } = viewportRect;
		const sceneSize = this._scene.size;

		// In the below:
		// - startP is a start progress value - only used on a secondary axis
		// - p0 and p1 are camera center positions for progress = 0 and progress = 1,
		// in the non-zoomed referential (meaning they depend on viewportRect, and are therefore
		// impacted by a resize), while min and max are in the zoomed (i.e. scaled) referential
		this._camCenter = {
			x: {
				p0: 0, p1: 0, isPrimaryAxis: false, startP: 0.5,
			},
			y: {
				p0: 0, p1: 0, isPrimaryAxis: false, startP: 0.5,
			},
		};
		this._distanceToCover = 0;

		let distanceToCover;
		let signFactor;

		if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
			this._camCenter.x.isPrimaryAxis = true;

			distanceToCover = sceneSize.width - width;
			signFactor = (this._inScrollDirection === "rtl") ? -1 : 1;

			if (distanceToCover <= POSSIBLE_PIXEL_ERROR) {
				distanceToCover = 0;
				this._camCenter.x.p0 = signFactor * (sceneSize.width / 2);
			} else {
				this._distanceToCover = distanceToCover;
				this._camCenter.x.p0 = signFactor * (width / 2);
			}
			this._camCenter.x.p1 = this._camCenter.x.p0 + signFactor * distanceToCover;

			// There is no need for a direction on the secondary axis, so we'll define p0 as the
			// value for which y is min (top), and p1 as the value for which y is max (bottom)
			// Remember that, in Page, the height in case of ltr or rtl with more than 1 segment
			// is set to viewport height, so y.p0 and y.p1 are left at 0, and no vAlign applies
			// (meaning it is considered as "center" by default)
			if (sceneSize.height >= height - POSSIBLE_PIXEL_ERROR) {
				this._camCenter.y.p0 = (height - sceneSize.height) / 2;
				this._camCenter.y.p1 = (sceneSize.height - height) / 2;
				if (this._vAlign === "top") {
					this._camCenter.y.startP = 0;
				} else if (this._vAlign === "bottom") {
					this._camCenter.y.startP = 1;
				}
			}

		} else if (this._inScrollDirection === "ttb" || this._inScrollDirection === "btt") {
			this._camCenter.y.isPrimaryAxis = true;

			distanceToCover = sceneSize.height - height;
			signFactor = (this._inScrollDirection === "btt") ? -1 : 1;

			if (distanceToCover <= POSSIBLE_PIXEL_ERROR) {
				distanceToCover = 0;
				this._camCenter.y.p0 = signFactor * (sceneSize.height / 2);
			} else {
				this._distanceToCover = distanceToCover;
				this._camCenter.y.p0 = signFactor * (height / 2);
			}
			this._camCenter.y.p1 = this._camCenter.y.p0 + signFactor * distanceToCover;

			if (sceneSize.width >= width - POSSIBLE_PIXEL_ERROR) {
				this._camCenter.x.p0 = (width - sceneSize.width) / 2;
				this._camCenter.x.p1 = (sceneSize.width - width) / 2;
				if (this._hAlign === "left") {
					this._camCenter.x.startP = 0;
				} else if (this._hAlign === "right") {
					this._camCenter.x.startP = 1;
				}
			}
		}

		const callback = () => {
			// Update snap point-related speeds based on inScrollDirection
			if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
				this._snapJumpSpeed = width * SNAP_JUMP_SPEED_FACTOR;
				this._stickyMoveSpeed = width * STICKY_MOVE_SPEED_FACTOR;
			} else {
				this._snapJumpSpeed = height * SNAP_JUMP_SPEED_FACTOR;
				this._stickyMoveSpeed = height * STICKY_MOVE_SPEED_FACTOR;
			}

			// Force zoomFactor to 1 and recompute x and y bounds
			this._setZoomFactorAndUpdateBounds(1);

			// Recompute progress by segment
			this._updateSegmentInfoArray();

			// If the page is larger than the effective viewport...
			if (this._distanceToCover > 0) {

				// Compute the possible error for progress calculations
				this._possibleError = this._getProgressStepForLength(POSSIBLE_PIXEL_ERROR);

				// Compute the progress delta corresponding to one pagination step forward
				this._paginationProgressStep = this._getPaginationProgressStep();

				this._computeProgressValuesForResourcePoints();
			}

			// Now reposition the camera and update progress (if not null)
			this._updatePositionAndProgressOnResize();
		};

		// If we were actually jumping between snap points, force jump to end
		if (this.isAutoScrolling === true) {
			this._jumpData.shouldForceToEnd = true;
			this._jumpData.endCallback = callback;
		} else {
			callback();
		}
	}

	_getPaginationProgressStep() {
		const { viewportRect } = this._player;
		const { width, height } = viewportRect;
		let progressStep = 0;
		if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
			progressStep = this._getProgressStepForLength(width);
		} else if (this._inScrollDirection === "ttb" || this._inScrollDirection === "btt") {
			progressStep = this._getProgressStepForLength(height);
		}
		return progressStep
	}

	_getProgressStepForLength(length) {
		const progressStep = Math.min(Math.max(length / this._distanceToCover, 0), 1);
		return progressStep
	}

	// Build all relevant points (for snap points and animations)
	// by adding a progress value to their raw information
	// (ensuring that progress always increases in arrays of snap points and keyframes)
	_computeProgressValuesForResourcePoints() {
		// For snap points
		let lastProgress = 0;
		this._snapPointsArray.forEach((point, i) => {
			let progress = this._getProgressForPoint(point);
			progress = Math.max(progress, lastProgress);
			this._snapPointsArray[i].progress = progress;
			lastProgress = progress;
		});

		// For point-based animations
		if (this._sliceAnimationsArray) {
			this._sliceAnimationsArray.forEach(({ animation }, i) => {
				lastProgress = 0;
				const { type, keyframesArray } = animation;
				keyframesArray.forEach(({ key }, j) => {
					let progress = (type === "point") ? this._getProgressForPoint(key) : key;
					progress = Math.max(progress, lastProgress);
					this._sliceAnimationsArray[i].animation.keyframesArray[j].progress = progress;
					lastProgress = progress;
				});
			});
		}
		if (this._soundAnimationsArray) {
			this._soundAnimationsArray.forEach(({ type, start, end }, i) => {
				if (type === "point") {
					let progress = this._getProgressForPoint(start);
					this._soundAnimationsArray[i].start.progress = progress;
					if (end) {
						progress = this._getProgressForPoint(end);
						this._soundAnimationsArray[i].end.progress = progress;
					}
				}
			});
		}
	}

	_getProgressForPoint(point) {
		const {
			pageSegmentIndex,
			viewport,
			x,
			y,
			unit,
		} = point;
		if (pageSegmentIndex >= this._segmentsInfoArray.length) {
			return null
		}

		const segmentInfo = this._segmentsInfoArray[pageSegmentIndex];
		const { size, unscaledSize, positionInSegmentLine } = segmentInfo;

		// Get the center position of the camera for the snap point alignment
		const position = this._getCameraPositionInSegmentForAlignment(viewport, { x, y }, unit, size,
			unscaledSize);
		if (!position) {
			return null
		}

		let progress = null;

		if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {

			// Update the position based on the segment's position in the scene

			if (this._inScrollDirection === "ltr") {
				position.x += positionInSegmentLine;
			} else {
				position.x += -positionInSegmentLine;
			}

			// Compute the distance from the scene container's start point to that new point

			const xDistance = Math.abs(position.x - this._camCenter.x.p0);

			if (xDistance < POSSIBLE_PIXEL_ERROR) {
				progress = 0;
			} else if (Math.abs(this._distanceToCover - xDistance) <= POSSIBLE_PIXEL_ERROR) {
				progress = 1;
			} else {
				progress = Math.min(Math.max(xDistance / this._distanceToCover, 0), 1);
			}

		} else if (this._inScrollDirection === "ttb" || this._inScrollDirection === "btt") {

			if (this._inScrollDirection === "ttb") {
				position.y += positionInSegmentLine;
			} else {
				position.y += -positionInSegmentLine;
			}

			const yDistance = Math.abs(position.y - this._camCenter.y.p0);

			if (yDistance < POSSIBLE_PIXEL_ERROR) {
				progress = 0;
			} else if (Math.abs(this._distanceToCover - yDistance) <= POSSIBLE_PIXEL_ERROR) {
				progress = 1;
			} else {
				progress = Math.min(Math.max(yDistance / this._distanceToCover, 0), 1);
			}
		}

		return progress
	}

	// Get the position of the camera's center point corresponding to a given point alignment
	_getCameraPositionInSegmentForAlignment(viewport, coords, unit, segmentSize,
		unscaledSegmentSize) {
		const sign = (this._inScrollDirection === "rtl" || this._inScrollDirection === "btt") ? -1 : 1;
		let x = null;
		if (coords.x !== undefined) {
			if (unit === "%") {
				x = Math.min(Math.max(0, (coords.x * segmentSize.width) / 100), segmentSize.width);
			} else if (unit === "px") {
				const percent = Math.min(Math.max(0, coords.x / unscaledSegmentSize.width), 1);
				x = Math.min(Math.max(0, percent * segmentSize.width), segmentSize.width);
			}
		} else {
			x = 0;
		}
		let y = null;
		if (coords.y !== undefined) {
			if (unit === "%") {
				y = Math.min(Math.max(0, (coords.y * segmentSize.height) / 100), segmentSize.height);
			} else if (unit === "px") {
				const percent = Math.min(Math.max(0, coords.y / unscaledSegmentSize.height), 1);
				y = Math.min(Math.max(0, percent * segmentSize.height), segmentSize.height);
			}
		} else {
			y = 0;
		}
		if (x === null && y === null) {
			return null
		}

		const { viewportRect } = this._player;
		const { width, height } = viewportRect;
		const position = {
			x: sign * x,
			y: sign * y,
		};
		switch (viewport) {
		case "start":
			position.x -= (this._relativeStart.x - 0.5) * width;
			position.y -= (this._relativeStart.y - 0.5) * height;
			break
		case "end":
			position.x -= (this._relativeEnd.x - 0.5) * width;
			position.y -= (this._relativeEnd.y - 0.5) * height;
			break
		}

		return position
	}

	// Called by a resize or zoom change
	_setZoomFactorAndUpdateBounds(zoomFactor) {
		this._zoomFactor = Math.min(Math.max(zoomFactor, 1), MAX_ZOOM);
		this._scene.setScale(this._zoomFactor); // Reminder: this._scene is a Container

		this._player.updateDisplayForZoomFactor(zoomFactor);

		this._updateMinAndMaxX();
		this._updateMinAndMaxY();
		this._updateOffsetInScaledReferential();
	}

	_updateMinAndMaxX() {
		const { viewportRect, viewportBoundingRect } = this._player;

		if (this._inScrollDirection === "ltr") {
			// If the scene overflows from the start...
			if (this._scene.size.width > viewportRect.width) {
				this._minX = Math.min((viewportRect.width / 2) * this._zoomFactor,
					viewportBoundingRect.width / 2);
				this._maxX = -this._minX + this._scene.size.width * this._zoomFactor;

			// ... otherwise if the zoom makes the scene overflow
			} else if (this._scene.size.width * this._zoomFactor > viewportBoundingRect.width) {
				this._minX = viewportBoundingRect.width / 2;
				this._maxX = -this._minX + this._scene.size.width * this._zoomFactor;

			// ... otherwise
			} else {
				this._minX = (this._scene.size.width / 2) * this._zoomFactor;
				this._maxX = this._minX;
			}

		} else if (this._inScrollDirection === "rtl") {
			if (this._scene.size.width > viewportRect.width) {
				this._maxX = -Math.min((viewportRect.width / 2) * this._zoomFactor,
					viewportBoundingRect.width / 2);
				this._minX = -this._maxX - this._scene.size.width * this._zoomFactor;

			} else if (this._scene.size.width * this._zoomFactor > viewportBoundingRect.width) {
				this._maxX = -viewportBoundingRect.width / 2;
				this._minX = -this._maxX - this._scene.size.width * this._zoomFactor;

			} else {
				this._maxX = -(this._scene.size.width / 2) * this._zoomFactor;
				this._minX = this._maxX;
			}

		} else {
			const { p0, p1 } = this._camCenter.x;

			// Compute a delta depending on whether the segment line is scrollable on its secondary x axis
			const sizeDiff = (p0 === p1) // p0===p1 <=> not scrollable on secondary y axis
				? this._scene.size.width * this._zoomFactor - viewportBoundingRect.width
				: viewportRect.width * this._zoomFactor - viewportBoundingRect.width;
			const delta = (sizeDiff > 0) ? (sizeDiff / 2) : 0;

			this._minX = p0 * this._zoomFactor - delta;
			this._maxX = p1 * this._zoomFactor + delta;
		}
	}

	_updateMinAndMaxY() {
		const { viewportRect, viewportBoundingRect } = this._player;

		if (this._inScrollDirection === "ttb") {
			if (this._scene.size.height > viewportRect.height) {
				this._minY = Math.min((viewportRect.height / 2) * this._zoomFactor,
					viewportBoundingRect.height / 2);
				this._maxY = -this._minY + this._scene.size.height * this._zoomFactor;

			} else if (this._scene.size.height * this._zoomFactor > viewportBoundingRect.height) {
				this._minY = viewportBoundingRect.height / 2;
				this._maxY = -this._minY + this._scene.size.height * this._zoomFactor;

			} else {
				this._minY = (this._scene.size.height / 2) * this._zoomFactor;
				this._maxY = this._minY;
			}

		} else if (this._inScrollDirection === "btt") {
			if (this._scene.size.height > viewportRect.height) {
				this._maxY = -Math.min((viewportRect.height / 2) * this._zoomFactor,
					viewportBoundingRect.height / 2);
				this._minY = -this._maxY - this._scene.size.height * this._zoomFactor;

			} else if (this._scene.size.height * this._zoomFactor > viewportBoundingRect.height) {
				this._maxY = -viewportBoundingRect.height / 2;
				this._minY = -this._maxY - this._scene.size.height * this._zoomFactor;

			} else {
				this._maxY = -(this._scene.size.height / 2) * this._zoomFactor;
				this._minY = this._maxY;
			}

		} else {
			const { p0, p1 } = this._camCenter.y;

			const sizeDiff = (p0 === p1)
				? this._scene.size.height * this._zoomFactor - viewportBoundingRect.height
				: viewportRect.height * this._zoomFactor - viewportBoundingRect.height;
			const delta = (sizeDiff > 0) ? (sizeDiff / 2) : 0;

			this._minY = p0 * this._zoomFactor - delta;
			this._maxY = p1 * this._zoomFactor + delta;
		}
	}

	_updateOffsetInScaledReferential() {
		let distanceInScaledReferential = null;
		if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
			distanceInScaledReferential = this._maxX - this._minX;
		} else if (this._inScrollDirection === "ttb" || this._inScrollDirection === "btt") {
			distanceInScaledReferential = this._maxY - this._minY;
		}
		if (!distanceInScaledReferential) {
			return
		}
		this._offsetInScaledReferential = distanceInScaledReferential;
		this._offsetInScaledReferential -= this._distanceToCover * this._zoomFactor;
		this._offsetInScaledReferential /= 2;
	}

	_updateSegmentInfoArray() {
		if (!this._referenceDimension) {
			return
		}
		const { viewportRect } = this._player;

		this._segmentsInfoArray = [];

		let positionInSegmentLine = 0;
		this._scene.layersArray.forEach((segmentLayer) => {
			const segment = segmentLayer.content;
			const { segmentIndex, unscaledSize } = segment;

			const { href, type } = segmentLayer.getInfo();
			let segmentInfo = {
				segmentIndex,
				href,
				type,
				unscaledSize,
				segment,
			};

			if (this._distanceToCover) {
				const coveredDistance = positionInSegmentLine - viewportRect[this._referenceDimension] / 2;
				const progress = coveredDistance / this._distanceToCover;
				// Note that we don't bound progress between 0 and 1 to allow for correct virtual points
				const { size } = segmentLayer;
				const referenceLength = size[this._referenceDimension];
				segmentInfo = {
					...segmentInfo,
					progress, // Progress when the image touches the center of the viewport (going forward)
					size,
					length: referenceLength,
					positionInSegmentLine, // In non-scaled/zoomed referential
				};

				positionInSegmentLine += referenceLength;
			}

			this._segmentsInfoArray.push(segmentInfo);
		});
	}

	_updatePositionAndProgressOnResize() { // Reminder: this._zoomFactor necessarily is 1

		// If the scene can now entirely fit within the viewport
		if (this._distanceToCover === 0) {
			const startPosition = this._getStartPosition();
			this._setPosition(startPosition);
			const shouldUpdatePosition = true;
			this.setProgress(null, shouldUpdatePosition);

		} else {
			// Keep virtual point fixed (if there is one, otherwise progress was null before)
			const progress = (this._virtualPoint)
				? this._getProgressForVirtualPoint(this._virtualPoint)
				: 0;

			if (this._overflow === "paginated" && this.isAutoScrolling === false) {
				const shouldUpdatePosition = false;
				this.setProgress(progress, shouldUpdatePosition);
				const isTheResultOfADragEnd = false;
				this._moveToClosestSnapPoint(isTheResultOfADragEnd);

			} else {
				const shouldUpdatePosition = true;
				this.setProgress(progress, shouldUpdatePosition);
			}
		}
	}

	_getProgressForVirtualPoint(virtualPoint) {
		if (!virtualPoint) {
			return 0
		}
		const { pageSegmentIndex, percent } = virtualPoint;
		const point = {
			pageSegmentIndex,
			viewport: "center",
			x: 0,
			y: 0,
			unit: "%",
		};
		const coord = percent * 100;
		if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
			point.x = coord;
		} else {
			point.y = coord;
		}
		const progress = this._getProgressForPoint(point);
		return progress
	}

	_getStartPosition() {
		const { x, y } = this._camCenter;
		const startPosition = {};
		if (x.isPrimaryAxis === true) {
			const { p0, p1, startP } = y;
			const startY = p0 + startP * (p1 - p0);
			startPosition.x = x.p0;
			startPosition.y = startY;
		} else {
			const { p0, p1, startP } = x;
			const startX = p0 + startP * (p1 - p0);
			startPosition.x = startX;
			startPosition.y = y.p0;
		}
		return startPosition
	}

	_setPosition({ x, y }) { // Note that x and y correspond to the camera's center position
		this._currentPosition = { x, y };
		this._scene.setPosition({ x: -x, y: -y }); // this._scene is still a Container
		if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
			this._signedPercent = x / (this._scene.size.width * this._zoomFactor);
		} else {
			this._signedPercent = y / (this._scene.size.height * this._zoomFactor);
		}
	}

	_updateProgressForPosition(position = this._currentPosition,
		shouldStoreLastNonTemporaryProgress = false) {
		if (this._progress === null) {
			return
		}
		if (shouldStoreLastNonTemporaryProgress === true
			&& this._lastNonTemporaryProgress === null) {
			this._lastNonTemporaryProgress = this._progress; // Useful for a sticky drag
		}
		const progress = this._getProgressForPosition(position);
		const shouldUpdatePosition = false;
		this.setProgress(progress, shouldUpdatePosition);
	}

	_getProgressForPosition(position) {
		let progress = null;
		if (this._inScrollDirection === "ltr") {
			progress = (position.x - this._minX - this._offsetInScaledReferential);
			progress /= (this._maxX - this._minX - 2 * this._offsetInScaledReferential);
		} else if (this._inScrollDirection === "rtl") {
			progress = (this._maxX - position.x - this._offsetInScaledReferential);
			progress /= (this._maxX - this._minX - 2 * this._offsetInScaledReferential);
		} else if (this._inScrollDirection === "ttb") {
			progress = (position.y - this._minY - this._offsetInScaledReferential);
			progress /= (this._maxY - this._minY - 2 * this._offsetInScaledReferential);
		} else if (this._inScrollDirection === "btt") {
			progress = (this._maxY - position.y - this._offsetInScaledReferential);
			progress /= (this._maxY - this._minY - 2 * this._offsetInScaledReferential);
		}
		progress = Math.min(Math.max(progress, 0), 1);
		return progress
	}

	// Position the scene container to conform to the specified progress value
	setProgress(p = null, shouldUpdatePosition = true) {
		const hasProgressChanged = (p !== this._progress);
		this._progress = p;

		if (p !== null) {
			this._virtualPoint = this._getVirtualPoint();

			const { pageNavigator } = this._player;
			if (pageNavigator.loadingMode === "segment" && pageNavigator.isInAGoTo === false) {
				const forceUpdate = false;
				if (this._virtualPoint) {
					const { segmentIndex } = this._virtualPoint;
					pageNavigator.updateSegmentLoadTasks(segmentIndex, forceUpdate);
				} else if (this._segmentsInfoArray.length > 0 && this._segmentsInfoArray[0]) {
					pageNavigator.updateSegmentLoadTasks(this._segmentsInfoArray[0].segmentIndex,
						forceUpdate);
				}
			}

			// Process progress animations
			if (this._sliceAnimationsArray) {
				this._sliceAnimationsArray.forEach((animationData) => {
					this._playSliceAnimation(animationData);
				});
			}
			if (this._soundAnimationsArray) {
				this._soundAnimationsArray.forEach((soundAnimation) => {
					this._playSoundAnimation(soundAnimation);
				});
			}
		} else {
			this._virtualPoint = null;
		}

		if (hasProgressChanged === true) {
			const { pageNavigator } = this._player;
			const { pageIndex, nbOfSegments, pageNavType } = pageNavigator;
			let locator = null;
			if (this._virtualPoint) {
				const {
					href, type, segmentIndex = 0, percent,
				} = this._virtualPoint || {};
				const totalProgression = Math.min((segmentIndex + 1 + percent) / nbOfSegments, 1);
				const locations = {
					position: pageIndex || 0,
					progression: this._progress,
					totalProgression,
				};
				locator = {
					href, type, locations, text: pageNavType,
				};
			} else {
				locator = pageNavigator.getLocator();
			}
			const data = { locator };
			this._eventEmitter.emit("inpagescroll", data);
		}

		if (shouldUpdatePosition === false) {
			if (hasProgressChanged === true) {
				this._player.refreshOnce();
			}
			return
		}

		if (p === null) {
			const startPosition = this._getStartPosition();
			this._setPosition(startPosition);
			this._player.refreshOnce();

		} else if (hasProgressChanged === true || this._progress === 0 || this._progress === 1) {
			let position = this._currentPosition;
			if (this._inScrollDirection === "ltr") {
				position = {
					x: this._minX + p * (this._camCenter.x.p1 - this._camCenter.x.p0) * this._zoomFactor,
					y: Math.min(Math.max(this._currentPosition.y, this._minY), this._maxY),
				};
			} else if (this._inScrollDirection === "rtl") {
				position = {
					x: this._maxX + p * (this._camCenter.x.p1 - this._camCenter.x.p0) * this._zoomFactor,
					y: Math.min(Math.max(this._currentPosition.y, this._minY), this._maxY),
				};
			} else if (this._inScrollDirection === "ttb") {
				position = {
					x: Math.min(Math.max(this._currentPosition.x, this._minX), this._maxX),
					y: this._minY + p * (this._camCenter.y.p1 - this._camCenter.y.p0) * this._zoomFactor,
				};
			} else if (this._inScrollDirection === "btt") {
				position = {
					x: Math.min(Math.max(this._currentPosition.x, this._minX), this._maxX),
					y: this._maxY + p * (this._camCenter.y.p1 - this._camCenter.y.p0) * this._zoomFactor,
				};
			}
			this._setPosition(position);
			this._player.refreshOnce();
		}
	}

	_playSliceAnimation(animationData) {
		const { slice, animation } = animationData;

		const { variable, keyframesArray } = animation;
		if (!keyframesArray || keyframesArray.length === 0) {
			return
		}
		let i = keyframesArray.length - 1;
		let { progress } = keyframesArray[i];
		while (i >= 0 && progress >= this._progress) {
			i -= 1;
			if (i >= 0) {
				progress = keyframesArray[i].progress;
			}
		}
		i = Math.max(i, 0);

		const previousProgress = keyframesArray[i].progress;
		const previousValue = keyframesArray[i].value;

		if (i === keyframesArray.length - 1) {
			const value = previousValue;
			slice.setVariable(variable, value);

		} else if (keyframesArray[i + 1].progress !== null) {
			const nextProgress = keyframesArray[i + 1].progress;
			const nextValue = keyframesArray[i + 1].value;
			if (nextValue !== previousValue) {
				let value = nextValue;
				if (nextProgress !== previousProgress) { // Linear easing is assumed
					value = (this._progress - previousProgress) / (nextProgress - previousProgress);
					value *= (nextValue - previousValue);
					value += previousValue;
				}
				slice.setVariable(variable, value);
			}

		}
	}

	_playSoundAnimation(animation) {
		const { resourceId, start, end } = animation;
		const { resourceManager } = this._player;
		const resource = resourceManager.getResourceWithId(resourceId);
		if (!resource) {
			return
		}
		if (!end) {
			if (this._progress >= start) {
				resource.playIfNeeded();
			}
		} else if (this._progress >= start.progress && this._progress < end.progress) {
			resource.playIfNeeded();
		} else {
			resource.stopIfNeeded();
		}
	}

	_getVirtualPoint() {
		if (this._progress === null || this._segmentsInfoArray.length < 1
			|| !this._referenceDimension) {
			return null
		}

		let indexOfFirstSegmentInViewport = null;
		let indexOfSegmentAtCenterOfViewport = null;
		let indexOfLastSegmentInViewport = 1;
		let segmentInfo = this._segmentsInfoArray[1];
		const halfViewportProgress = this._paginationProgressStep / 2;

		while (indexOfLastSegmentInViewport < this._segmentsInfoArray.length
			&& segmentInfo.progress <= this._progress + halfViewportProgress) {
			// Note that this._possibleError is not taken into account here
			if (indexOfFirstSegmentInViewport === null
				&& segmentInfo.progress > this._progress - halfViewportProgress) {
				indexOfFirstSegmentInViewport = indexOfLastSegmentInViewport;
			}
			if (indexOfSegmentAtCenterOfViewport === null
				&& segmentInfo.progress > this._progress) {
				indexOfSegmentAtCenterOfViewport = indexOfLastSegmentInViewport;
			}
			indexOfLastSegmentInViewport += 1;
			segmentInfo = this._segmentsInfoArray[indexOfLastSegmentInViewport];
		}
		indexOfLastSegmentInViewport -= 1;
		indexOfSegmentAtCenterOfViewport = (indexOfSegmentAtCenterOfViewport === null)
			? indexOfLastSegmentInViewport
			: indexOfSegmentAtCenterOfViewport - 1;
		indexOfFirstSegmentInViewport = (indexOfFirstSegmentInViewport === null)
			? indexOfLastSegmentInViewport
			: indexOfFirstSegmentInViewport - 1;

		const {
			positionInSegmentLine, length, href, type,
		} = this._segmentsInfoArray[indexOfSegmentAtCenterOfViewport];
		const { viewportRect } = this._player;
		const viewportLength = viewportRect[this._referenceDimension];

		const coveredDistance = this._progress * this._distanceToCover;
		let percent = (coveredDistance - positionInSegmentLine + viewportLength / 2) / length;
		percent = Math.min(Math.max(percent, 0), 1);

		const { segmentIndex } = this._segmentsInfoArray[indexOfSegmentAtCenterOfViewport];
		const virtualPoint = {
			segmentIndex,
			pageSegmentIndex: indexOfSegmentAtCenterOfViewport,
			href,
			type,
			percent, // percent in segment (not in page!)
			indexOfFirstSegmentInViewport,
			indexOfLastSegmentInViewport,
		};

		this._segmentsInfoArray.forEach(({ segment }, k) => {
			const isVisible = (k >= indexOfFirstSegmentInViewport && k <= indexOfLastSegmentInViewport);
			segment.setIsInViewport(isVisible);
		});

		return virtualPoint
	}

	setPercent(percent) {
		if (this._progress === null || percent < 0 || percent > 1) {
			return
		}
		const shouldUpdatePosition = true;
		this.setProgress(percent, shouldUpdatePosition);
	}

	_moveToClosestSnapPoint(isTheResultOfADragEnd = true) {
		let nextProgress = this._lastNonTemporaryProgress;
		let previousProgress = this._lastNonTemporaryProgress;

		let allowsSameProgress = false;
		// For a sticky drag...
		if (isTheResultOfADragEnd === true) {
			if (this._lastNonTemporaryProgress === null) {
				return
			}
			if (this._progress >= this._lastNonTemporaryProgress) {
				nextProgress = this._getNextSnapPointProgress(allowsSameProgress,
					this._lastNonTemporaryProgress);
			} else {
				previousProgress = this._getPreviousSnapPointProgress(allowsSameProgress,
					this._lastNonTemporaryProgress);
			}

		// ...whereas after a resize or dezoom
		} else {
			allowsSameProgress = true;
			const lastNonTemporaryProgress = null;
			nextProgress = this._getNextSnapPointProgress(allowsSameProgress,
				lastNonTemporaryProgress);
			previousProgress = this._getPreviousSnapPointProgress(allowsSameProgress,
				lastNonTemporaryProgress);
		}

		const progressDifferenceToNext = nextProgress - this._progress;
		const progressDifferenceToPrevious = this._progress - previousProgress;
		let targetProgress = this._progress;
		if (progressDifferenceToNext <= progressDifferenceToPrevious) {
			targetProgress = nextProgress;
		} else if (progressDifferenceToNext > progressDifferenceToPrevious) {
			targetProgress = previousProgress;
		}

		if (isTheResultOfADragEnd === true) {
			const isUpdate = false;
			this._startSnapPointJump(targetProgress, isUpdate);

		} else { // Move instantly
			const shouldUpdatePosition = true;
			this.setProgress(targetProgress, shouldUpdatePosition);
		}
		this._lastNonTemporaryProgress = null;
	}

	// Get the progress value of the next snap point in the list (1 if there is none)
	_getNextSnapPointProgress(allowsSameProgress = false, lastNonTemporaryProgress) {

		// If lastNonTemporaryProgress is defined, then a step forward
		// (via a discontinuous gesture or a sticky drag) is under way
		const referenceProgress = (lastNonTemporaryProgress !== null)
			? lastNonTemporaryProgress
			: this._progress;

		let i = 0;
		while (i < this._snapPointsArray.length
			&& this._isSnapProgressInferior(allowsSameProgress, referenceProgress, i) === true) {
			i += 1;
		}

		let nextProgress = 1; // Will ensure a jump to the end of the page at least
		if (i < this._snapPointsArray.length) {
			nextProgress = this._snapPointsArray[i].progress;
		}

		// Select the closest value between that one and the one corresponding to one pagination away
		if (this._paginationProgressStep && this._allowsPaginatedScroll === true) {
			let nextPaginatedProgress = nextProgress;

			if (lastNonTemporaryProgress !== null && this._isPaginationGridBased === false) {
				nextPaginatedProgress = lastNonTemporaryProgress + this._paginationProgressStep;

			} else {
				nextPaginatedProgress = (allowsSameProgress === true)
					? Math.ceil((this._progress - this._possibleError) / this._paginationProgressStep)
					: Math.floor((this._progress + this._possibleError) / this._paginationProgressStep + 1);
				nextPaginatedProgress *= this._paginationProgressStep;
			}
			nextPaginatedProgress = Math.min(Math.max(nextPaginatedProgress, 0), 1);

			nextProgress = Math.min(nextProgress, nextPaginatedProgress);
		}

		return nextProgress
	}

	_isSnapProgressInferior(allowsSameProgress, referenceProgress, i) {
		if (allowsSameProgress === true) { // A kind of "isSnapProgressStrictlyInferior"
			return (this._snapPointsArray[i].progress < referenceProgress - this._possibleError)
		}
		return (this._snapPointsArray[i].progress <= referenceProgress + this._possibleError)
	}

	// Get the progress value of the previous snap point in the list (0 if there is none)
	_getPreviousSnapPointProgress(allowsSameProgress = false, lastNonTemporaryProgress) {

		// If lastNonTemporaryProgress is defined, then a step backward
		// (via a discontinuous gesture or a sticky drag) is under way
		const referenceProgress = (lastNonTemporaryProgress !== null)
			? lastNonTemporaryProgress
			: this._progress;

		let i = this._snapPointsArray.length - 1;
		while (i >= 0
			&& this._isSnapProgressSuperior(allowsSameProgress, referenceProgress, i) === true) {
			i -= 1;
		}

		let previousProgress = 0; // Will ensure a jump to the start of the page at least
		if (i >= 0) {
			previousProgress = this._snapPointsArray[i].progress;
		}

		// Select the closest value between that one and the one corresponding to one pagination away
		if (this._paginationProgressStep && this._allowsPaginatedScroll === true) {
			let previousPaginatedProgress = previousProgress;

			if (lastNonTemporaryProgress !== null && this._isPaginationGridBased === false) {
				previousPaginatedProgress = lastNonTemporaryProgress - this._paginationProgressStep;
			} else {
				previousPaginatedProgress = (allowsSameProgress === true)
					? Math.floor((this._progress + this._possibleError) / this._paginationProgressStep)
					: Math.ceil((this._progress - this._possibleError) / this._paginationProgressStep - 1);
				previousPaginatedProgress *= this._paginationProgressStep;
			}
			previousPaginatedProgress = Math.min(Math.max(previousPaginatedProgress, 0), 1);

			previousProgress = Math.max(previousProgress, previousPaginatedProgress);
		}
		return previousProgress
	}

	_isSnapProgressSuperior(allowsSameProgress, referenceProgress, i) {
		if (allowsSameProgress === true) { // A kind of "isSnapProgressStrictlySuperior"
			return (this._snapPointsArray[i].progress > referenceProgress + this._possibleError)
		}
		return (this._snapPointsArray[i].progress >= referenceProgress - this._possibleError)
	}

	zoom(zoomData) {
		// Prevent camera from zooming if is undergoing changes (i.e. jumping between points)
		if (this.isAutoScrolling === true) {
			return
		}

		const {
			isContinuous,
			touchPoint,
			delta,
			multiplier,
		} = zoomData;
		if (!touchPoint) {
			return
		}
		const { viewportRect } = this._player;

		let zoomFactor = this._zoomFactor;
		let zoomFixedPoint = this._currentPosition;

		// For a "quick change" (toggle between min = 1 and maxZoomFactor value)
		if (isContinuous === false) {

			// Compute zoom factor
			zoomFactor = (this._zoomFactor !== 1) ? 1 : MAX_ZOOM;

			// Compute camera's fixed point
			zoomFixedPoint = this._computeFixedPoint(touchPoint, viewportRect);

		} else {
			if (!delta && !multiplier) {
				return
			}

			// Compute zoom factor
			if (delta) {
				const { height } = viewportRect;
				const zoomSensitivity = ZOOM_SENSITIVITY / height;
				zoomFactor = Math.min(Math.max(this._zoomFactor - delta * zoomSensitivity, 1),
					MAX_ZOOM);
			} else {
				zoomFactor = this._zoomFactor * multiplier;
			}

			// Compute camera's fixed point (only update it if the touch point has changed)
			zoomFixedPoint = (touchPoint !== this._zoomTouchPoint)
				? this._computeFixedPoint(touchPoint, viewportRect)
				: this._currentPosition;

			this._zoomTouchPoint = touchPoint;
		}

		// Compute zoomChange difference now, before setting the new zoomFactor
		const zoomChange = zoomFactor - this._zoomFactor;

		this._setZoomFactorAndUpdateBounds(zoomFactor, zoomFixedPoint);

		this._updatePositionAndProgressOnZoomChange(zoomChange, zoomFixedPoint);
	}

	_computeFixedPoint(point, viewportRect) {
		const {
			x, y, width, height,
		} = viewportRect;

		// Express the point's coordinates in the non-scaled (i.e. non-zoomed) referential
		// centered on the scene container's center (from which resources are positioned)
		const topLeftCameraPointInSceneReferential = {
			x: this._currentPosition.x - width / 2,
			y: this._currentPosition.y - height / 2,
		}; // Reminder: this._currentPosition is the opposite of the position of the scene's container

		const fixedPoint = {
			x: (topLeftCameraPointInSceneReferential.x + point.x - x) / this._zoomFactor,
			y: (topLeftCameraPointInSceneReferential.y + point.y - y) / this._zoomFactor,
		};

		return fixedPoint
	}

	_updatePositionAndProgressOnZoomChange(zoomChange, zoomFixedPoint) {
		// Change currentPosition so that zoomFixedPoint remains visually fixed
		const position = {
			x: Math.min(Math.max(this._currentPosition.x + zoomChange * zoomFixedPoint.x,
				this._minX), this._maxX),
			y: Math.min(Math.max(this._currentPosition.y + zoomChange * zoomFixedPoint.y,
				this._minY), this._maxY),
		};
		this._setPosition(position);

		// Update progress to conform to that new position
		const shouldStoreLastNonTemporaryProgress = (this._overflow === "paginated"
			&& this._isPaginationSticky === true);
		this._updateProgressForPosition(this._currentPosition, shouldStoreLastNonTemporaryProgress);

		// If reverting to normal zoomFactor=1 value when overflow=paginated, snap to closest snap point
		if (this._hasSpaceToMove === true
			&& this._zoomFactor === 1 && this._overflow === "paginated") {
			const isTheResultOfADragEnd = false;
			this._moveToClosestSnapPoint(isTheResultOfADragEnd);
		}
	}

	moveToNextSnapPoint() {
		if (this.isAutoScrolling === true) {
			const { startProgress, targetProgress } = this._jumpData;
			const isJumpGoingForward = (targetProgress - startProgress >= 0);
			if (isJumpGoingForward === true) {
				this._jumpData.shouldForceToEnd = true;
				return
			}
		}
		const allowsSameProgress = false;
		const targetProgress = this._getNextSnapPointProgress(allowsSameProgress, this._progress);
		if (targetProgress === null) {
			return
		}
		const isUpdate = false;
		this._startSnapPointJump(targetProgress, isUpdate);
	}

	moveToPreviousSnapPoint() {
		if (this.isAutoScrolling === true) {
			const { startProgress, targetProgress } = this._jumpData;
			const isJumpGoingForward = (targetProgress - startProgress >= 0);
			if (isJumpGoingForward === false) {
				this._jumpData.shouldForceToEnd = true;
				return
			}
		}
		const allowsSameProgress = false;
		const targetProgress = this._getPreviousSnapPointProgress(allowsSameProgress, this._progress);
		if (targetProgress === null) {
			return
		}
		const isUpdate = false;
		this._startSnapPointJump(targetProgress, isUpdate);
	}

	_startSnapPointJump(targetProgress, isUpdate = false) {
		this._jumpData.isAutoScrolling = true;
		this._jumpData.startDate = Date.now();
		this._jumpData.duration = this._getJumpDuration(this._progress, targetProgress);
		this._jumpData.startProgress = this._progress;
		this._jumpData.targetProgress = targetProgress;

		// If a jump was not under way, start one
		if (isUpdate === false) {
			requestAnimationFrame(this._autoProgress.bind(this));
		}
	}

	_getJumpDuration(startProgress, targetProgress) {
		if (this._distanceToCover === 0) {
			return 0
		}
		const distance = Math.abs((targetProgress - startProgress) * this._distanceToCover);
		const duration = (this._isPaginationSticky === true)
			? distance / this._stickyMoveSpeed
			: distance / this._snapJumpSpeed;
		return duration
	}

	_autoProgress() {
		if (this.isAutoScrolling === false) {
			return
		}

		const {
			startDate,
			duration,
			startProgress,
			targetProgress,
			shouldForceToEnd,
			endCallback,
		} = this._jumpData;

		const percent = (Date.now() - startDate) / (duration || 1);

		const shouldUpdatePosition = true;

		if (duration === 0 || percent >= 1 || shouldForceToEnd === true) {
			this.setProgress(targetProgress, shouldUpdatePosition);
			this._reset();
			if (endCallback) {
				endCallback();
			}

		} else {
			let forcedProgress = startProgress + (targetProgress - startProgress) * percent;
			forcedProgress = Math.min(Math.max(forcedProgress, 0), 1);
			this.setProgress(forcedProgress, shouldUpdatePosition);
			requestAnimationFrame(this._autoProgress.bind(this));
		}
	}

	attemptStickyStep() {
		if (this._hasSpaceToMove === false || this.isZoomed === true) {
			return false
		}
		const isTheResultOfADragEnd = true;
		this._moveToClosestSnapPoint(isTheResultOfADragEnd);
		return true
	}

	attemptToMoveSideways(way) {
		if (this._allowsPaginatedScroll === false && this._overflow === "scrolled") {
			return false
		}
		const { viewportRect } = this._player;
		const { width, height } = viewportRect;
		const currentPosition = { ...this._currentPosition };
		switch (way) {
		case "left":
			if (currentPosition.x > this._camCenter.x.p0 + POSSIBLE_PIXEL_ERROR) {
				currentPosition.x = Math.max(this._camCenter.x.p0, currentPosition.x - width);
			}
			break
		case "right":
			if (currentPosition.x < this._camCenter.x.p1 - POSSIBLE_PIXEL_ERROR) {
				currentPosition.x = Math.min(this._camCenter.x.p1, currentPosition.x + width);
			}
			break
		case "up":
			if (currentPosition.y > this._camCenter.y.p0 + POSSIBLE_PIXEL_ERROR) {
				currentPosition.y = Math.max(this._camCenter.y.p0, currentPosition.y - height);
			}
			break
		case "down":
			if (currentPosition.y < this._camCenter.y.p1 - POSSIBLE_PIXEL_ERROR) {
				currentPosition.y = Math.min(this._camCenter.y.p1, currentPosition.y + height);
			}
			break
		default:
			return false
		}
		if (currentPosition.x !== this._currentPosition.x
			|| currentPosition.y !== this._currentPosition.y) {
			this._setPosition(currentPosition);
			return true
		}
		return false
	}

	// Apply the amount of user scrolling to the scene container's position via the camera
	// by computing what new progress value the delta corresponds to
	handleScroll(scrollData, isWheelScroll) {
		if (this._hasSpaceToMove === false
			|| (this.isZoomed === false && (this._overflow === "paginated"
				&& (this._isPaginationSticky === false || isWheelScroll === true)))) {
			return false
		}

		const { deltaX, deltaY } = scrollData;
		const currentPosition = { ...this._currentPosition };

		// Entirely disallow sideways scroll for a sideways gesture when pagination should be sticky
		if (this.isZoomed === false && this._overflow === "paginated"
			&& this._isPaginationSticky === true) {
			if (this._camCenter.x.isPrimaryAxis === true) {
				currentPosition.x -= deltaX;
			} else {
				currentPosition.y -= deltaY;
			}
		} else {
			currentPosition.x -= deltaX;
			currentPosition.y -= deltaY;
		}

		currentPosition.x = Math.min(Math.max(currentPosition.x, this._minX), this._maxX);
		currentPosition.y = Math.min(Math.max(currentPosition.y, this._minY), this._maxY);
		this._setPosition(currentPosition);

		const shouldStoreLastNonTemporaryProgress = (this._overflow === "paginated"
			&& this._isPaginationSticky === true);
		this._updateProgressForPosition(this._currentPosition, shouldStoreLastNonTemporaryProgress);

		// What images are visible?

		return true
	}

	// Used in a goTo
	moveToSegmentIndex(pageSegmentIndex, isGoingForward) {
		// If the scene is not larger than the viewport, just display it
		if (this._hasSpaceToMove === false) {
			return
		}

		// If a pageSegmentIndex is specified and progress is defined,
		// then get the progress value to which the segment corresponds
		if (pageSegmentIndex !== null && this._progress !== null) {
			const progress = this._getProgressForSegmentIndex(pageSegmentIndex);
			const shouldUpdatePosition = true;
			this.setProgress(progress, shouldUpdatePosition);

		// Otherwise just go to the start or end of the scene
		} else {
			this.moveToStartOrEnd(isGoingForward);
		}
	}

	_getProgressForSegmentIndex(pageSegmentIndex) {
		// The progress value is computed for the "start" viewport point in the case
		// the inScrollDirection is ltr or btt, and for the "end" point otherwise
		const point = {
			pageSegmentIndex,
			viewport: "start",
			x: 0,
			y: 0,
			unit: "%",
		};
		const progress = this._getProgressForPoint(point);
		return progress
	}

	moveToStartOrEnd(isGoingForward = true) {
		if (this._distanceToCover === 0) {
			return
		}

		this._reset();
		const progress = (isGoingForward === true) ? 0 : 1;
		const shouldUpdatePosition = true;
		this.setProgress(progress, shouldUpdatePosition);

		if (isGoingForward === true) {
			this._signedPercent = 0;
		} else {
			this._signedPercent = (this._inScrollDirection === "rtl"
				|| this._inScrollDirection === "btt")
				? -1
				: 1;
		}
	}

	getCurrentHref() {
		if (this._virtualPoint) {
			return this._virtualPoint.href
		}
		if (this._segmentsInfoArray.length > 0 && this._segmentsInfoArray[0]) {
			return this._segmentsInfoArray[0].href
		}
		return null
	}

}

class OverflowHandler {

	get type() { return this._type }

	// Used in LayerPile

	get activeLayersArray() { return (this._layerPile) ? this._layerPile.layersArray : [] }

	get isAtStart() { return (this._camera) ? this._camera.isAtStart : true }

	get isAtEnd() { return (this._camera) ? this._camera.isAtEnd : true }

	get isUndergoingChanges() { return (this._camera.isAutoScrolling === true) }

	get inScrollDirection() { return this._inScrollDirection }

	// Constructor

	constructor(layerPile, overflow, hAlign, vAlign, player) {
		this._layerPile = layerPile;

		// An overflowHandler necessarily has a camera
		this._camera = new Camera(layerPile, overflow, hAlign, vAlign, player);

		this._type = "overflowHandler";

		this._inScrollDirection = null;
	}

	setInScrollDirection(inScrollDirection) {
		this._inScrollDirection = inScrollDirection;
		this._camera.setInScrollDirection(inScrollDirection);
	}

	// Snap points
	addSnapPoints(indexInLayerPile, snapPointsArray) {
		const segmentsArray = this._layerPile.layersArray.map((layer) => (layer.content));
		if (indexInLayerPile >= segmentsArray.length) {
			return
		}
		this._camera.addSnapPoints(indexInLayerPile, snapPointsArray);
	}

	// Animations

	addSliceAnimation(indexInLayerPile, slice, animation) {
		this._camera.addSliceAnimation(indexInLayerPile, slice, animation);
	}

	addSoundAnimation(indexInLayerPile, animation) {
		this._camera.addSoundAnimation(indexInLayerPile, animation);
	}

	// Functions linked to segments

	goToSegmentIndex(indexInLayerPile, isGoingForward) {
		this._camera.moveToSegmentIndex(indexInLayerPile, isGoingForward);
	}

	setupForEntry(isGoingForward) {
		if (this._camera.isZoomed === true) { // Should never hapen
			return
		}
		this._camera.moveToStartOrEnd(isGoingForward);
	}

	// Functions linked to LayerPile

	attemptToGoForward(shouldGoInstantly = false) { // Step forward
		if (this._camera.isZoomed === true) { // Block all interactions
			return true
		}
		if (this._camera.isAtEnd === true) {
			return false
		}
		this._camera.moveToNextSnapPoint(shouldGoInstantly);
		return true
	}

	attemptToGoBackward(shouldGoInstantly = false) { // Step backward
		if (this._camera.isZoomed === true) { // Block all interactions
			return true
		}
		if (this._camera.isAtStart === true) {
			return false
		}
		this._camera.moveToPreviousSnapPoint(shouldGoInstantly);
		return true
	}

	attemptToGoSideways(way) {
		return this._camera.attemptToMoveSideways(way)
	}

	// Functions to deal with continuous gestures and zoom

	handleScroll(scrollData, isWheelScroll) {
		if (this.isUndergoingChanges === true) {
			return true
		}
		return this._camera.handleScroll(scrollData, isWheelScroll)
	}

	attemptStickyStep() {
		return (this.isUndergoingChanges === false && this._camera.attemptStickyStep())
	}

	zoom(zoomData) {
		if (this.isUndergoingChanges === true) {
			return
		}
		this._camera.zoom(zoomData);
	}

	setPercent(percent) {
		if (this.isUndergoingChanges === true) {
			return
		}
		this._camera.setPercent(percent);
	}

	getCurrentHref() {
		return this._camera.getCurrentHref()
	}

	// Functions to deal with inner changes (jumps) and resize

	resize() {
		// After all segments have been resized, (re)position them
		this._positionSegments();

		// Update camera and possible snap points (note that zoomFactor will be forced to 1)
		this._camera.setBoundsAndUpdateOnResize();
	}

	_positionSegments() {
		let sumOfPreviousSegmentDimensions = 0;

		// Translate all segment containers in the page by half their size plus the sum
		// of all previous segment dimensions (so that the first one is translated only
		// half its size and all others are then glued next to it, one after the other)
		this._layerPile.layersArray.forEach((layer) => {
			const segment = layer.content;
			const { size } = segment;
			const { width, height } = size;
			if (!width || !height) {
				return
			}

			switch (this._inScrollDirection) {
			case "ltr":
				segment.setPosition({
					x: sumOfPreviousSegmentDimensions + width / 2,
					y: 0,
				});
				sumOfPreviousSegmentDimensions += width;
				break
			case "rtl":
				segment.setPosition({
					x: -sumOfPreviousSegmentDimensions - width / 2,
					y: 0,
				});
				sumOfPreviousSegmentDimensions += width;
				break
			case "ttb":
				segment.setPosition({
					x: 0,
					y: sumOfPreviousSegmentDimensions + height / 2,
				});
				sumOfPreviousSegmentDimensions += height;
				break
			case "btt":
				segment.setPosition({
					x: 0,
					y: -sumOfPreviousSegmentDimensions - height / 2,
				});
				sumOfPreviousSegmentDimensions += height;
				break
			}
		});
	}

}

class LayerPile extends Container {

	// Used in Slideshow, PageNavigator and below
	get layersArray() { return this._layersArray }

	// Used in Page
	get handler() { return this._handler }

	// Used in Page and Layer
	get loadStatus() { return this._loadStatus }

	// Used below

	get activeLayersArray() {
		return this._layersArray.filter((layer) => (layer.isActive === true))
	}

	get isAtStart() { return (this._handler) ? this._handler.isAtStart : true }

	get isAtEnd() { return (this._handler) ? this._handler.isAtEnd : true }

	get isUndergoingChanges() { return (this._handler) ? this._handler.isUndergoingChanges : false }

	// Note that isAtStart, isAtEnd and isUndergoingChanges are not recursive!

	get resourcePath() { // Return the resourcePath of the first slice if there is one
		if (this._layersArray.length === 0 || !this._layersArray[0]) {
			return null
		}
		return this._layersArray[0].resourcePath
	}

	get size() { // Note that Page overrides this function

		// If a Segment with multiple layers
		if (this._parentSlice) {
			return this._parentSlice.size
		}

		if (this._layersArray.length > 0) {
			return this._layersArray[0].size
		}

		// All cases must have been covered already, but just in case
		return { width: 0, height: 0 }
	}

	constructor(type, name, parent = null, layersArray = [], isFirstSliceAParentSlice = false) {
		super(type, name, parent);

		// Build layers
		this._layersArray = [];
		// Note that the parent slice is added too, although its texture will be hidden
		if (layersArray) {
			layersArray.forEach((layer) => {
				this.addLayer(layer);
				layer.setParent(this);
			});
		}

		const parentSliceLayer = (isFirstSliceAParentSlice === true && layersArray.length > 0)
			? layersArray[0]
			: null;
		this._parentSlice = (parentSliceLayer) ? parentSliceLayer.content : null;

		this._loadStatus = 0;

		this._handler = null;
	}

	addLayer(layer) {
		this._layersArray.push(layer);
	}

	addStateHandler(shouldStateLayersCoexistOutsideTransitions, player) {
		this._handler = new StateHandler(this, shouldStateLayersCoexistOutsideTransitions,
			player);
	}

	_addOverflowHandler(overflow, hAlign, vAlign, player) {
		this._handler = new OverflowHandler(this, overflow, hAlign, vAlign, player);
	}

	getLayerAtIndex(layerIndex) {
		if (this._layersArray.length === 0
			|| layerIndex < 0 || layerIndex >= this._layersArray.length) {
			return null
		}
		const layer = this._layersArray[layerIndex];
		return layer
	}

	// Used in StateHandler
	getDepthOfNewLayer() {
		return this._layersArray.length
	}

	// Following a discontinuous gesture

	attemptToGoForward(shouldSkipTransition = false, doIfIsUndergoingChanges = null) {
		// If a change is under way, end it
		if (this._handler && this.isUndergoingChanges === true) {
			return (this._handler.attemptToGoForward(shouldSkipTransition,
				doIfIsUndergoingChanges) === true)
		}
		// If not, try to go forward in the first layer (child)
		if (this.activeLayersArray.length > 0) {
			const layer = this.activeLayersArray[0];
			if (layer.attemptToGoForward(shouldSkipTransition, doIfIsUndergoingChanges) === true) {
				return true
			}
		}
		// Otherwise try go forward via the handler if there is one
		return (this._handler
			&& this._handler.attemptToGoForward(shouldSkipTransition, doIfIsUndergoingChanges) === true)
	}

	attemptToGoBackward(shouldSkipTransition = false, doIfIsUndergoingChanges = null) {
		// If a change is under way, end it then go backward
		if (this._handler && this.isUndergoingChanges === true) {
			return (this._handler.attemptToGoBackward(shouldSkipTransition,
				doIfIsUndergoingChanges) === true)
		}
		// If not, try to go backward in the last layer (child)
		if (this.activeLayersArray.length > 0) {
			const layer = this.activeLayersArray[this.activeLayersArray.length - 1];
			if (layer.attemptToGoBackward(shouldSkipTransition, doIfIsUndergoingChanges) === true) {
				return true
			}
		}
		// Otherwise try go backward via the handler if there is one
		return (this._handler
			&& this._handler.attemptToGoBackward(shouldSkipTransition,
				doIfIsUndergoingChanges) === true)
	}

	attemptToGoSideways(way) {
		if (this.isUndergoingChanges === true) {
			return true
		}
		if (this.activeLayersArray.length > 0) {
			const layer = this.activeLayersArray[this.activeLayersArray.length - 1];
			if (layer.attemptToGoSideways(way) === true) {
				return true
			}
		}
		return (this._handler && this._handler.attemptToGoSideways
			&& this._handler.attemptToGoSideways(way) === true)
	}

	// Following a continuous gesture

	handleScroll(scrollData, isWheelScroll) {
		if (!this._handler) {
			return false
		}
		if (this._handler.type === "overflowHandler"
			&& this._handler.handleScroll(scrollData, isWheelScroll) === true) {
			return true
		}
		if (this._handler.type === "stateHandler"
			&& this._handler.handleScroll(scrollData, isWheelScroll) === true) {
			return true
		}
		return false
	}

	endControlledTransition(viewportPercent, shouldBeAnimated = true) {
		if (!this._handler) {
			return false
		}

		if (this._handler.type === "overflowHandler") {
			if (this._layersArray.length === 1) {
				const layer = this._layersArray[0]; // Check only the first Segment in a Page
				const { content } = layer;
				if (content.endControlledTransition(viewportPercent, shouldBeAnimated) === true) {
					return true
				}
			}
		}

		return (this._handler.type === "stateHandler"
			&& this._handler.endControlledTransition(viewportPercent, shouldBeAnimated) === true)
	}

	resize() {
		this.activeLayersArray.forEach((layer) => layer.resize());
		this._resizeMyself();
	}

	_resizeMyself() {
		if (this._parentSlice) { // If this is a Segment with multiple layers
			this._parentSlice.resize();
			this._layersArray.forEach((layer) => { layer.setScale(this._parentSlice.scale); });
		}
		if (this._handler && this._handler.resize) {
			this._handler.resize();
		}
	}

	setupForEntry(isGoingForward = true) {
		this._layersArray.forEach((layer) => {
			// If the LayerPile is a Segment with a unique Slice (or a basic LayerPile)
			if (!this._handler) {
				const slice = layer.content;
				this.addChild(slice);
			}
			layer.setupForEntry(isGoingForward);
		});

		this._resizeMyself();

		// If the LayerPile has a StateHandler (i.e. it is a PageNavigator or a multi-layered
		// Segment with layer transitions) or an OverflowHandler (i.e. it is a Page)
		if (this._handler) {
			this._handler.setupForEntry(isGoingForward);
		}
	}

	finalizeEntry() {
		this.activeLayersArray.forEach((layer) => { layer.finalizeEntry(); });
	}

	finalizeExit() {
		this.activeLayersArray.forEach((layer) => { layer.finalizeExit(); });

		// If a Segment with multiple states
		if (this._handler && this._handler.type === "stateHandler") {
			this._handler.finalizeExit();
		}
	}

	setIsInViewport(isInViewport) {
		this._layersArray.forEach((layer) => {
			layer.setIsInViewport(isInViewport);
		});
	}

	getResourceIdsToLoad(recursive, force) {
		const resourceIdsArray = [];
		this._layersArray.forEach((layer) => {
			const idsArray = layer.getResourceIdsToLoad(recursive, force);
			resourceIdsArray.push(...idsArray);
		});
		return resourceIdsArray
	}

	destroyResourcesIfPossible() {
		this._layersArray.forEach((layer) => { layer.destroyResourcesIfPossible(); });
	}

	// Used in Layer (in a Segment, the first layer only will be considered)
	getInfo() {
		if (this._layersArray.length < 1 || !this._layersArray[0].getInfo) {
			return null
		}
		return this._layersArray[0].getInfo()
	}

	// Slice functions

	resizePage() {
		if (!this.parent || !this.parent.resizePage) {
			return
		}
		this.parent.resizePage();
	}

	updateLoadStatus() {
		const oldLoadStatus = this._loadStatus;

		let nbOfLoadedLayers = 0;
		let hasAtLeastOneLoadingLayer = false;
		let hasAtLeastOnePartiallyLoadedLayer = false;

		this._layersArray.forEach((layer) => {
			if (hasAtLeastOneLoadingLayer === false
				&& hasAtLeastOnePartiallyLoadedLayer === false) {
				const { loadStatus } = layer;
				switch (loadStatus) {
				case 2:
					nbOfLoadedLayers += 1;
					break
				case 1:
					hasAtLeastOneLoadingLayer = true;
					break
				case -1:
					hasAtLeastOnePartiallyLoadedLayer = true;
					break
				}
			}
		});
		if (hasAtLeastOnePartiallyLoadedLayer === true
			|| (nbOfLoadedLayers > 0 && nbOfLoadedLayers < this._layersArray.length)) {
			this._loadStatus = -1;
		} else if (hasAtLeastOneLoadingLayer === true) {
			this._loadStatus = 1;
		} else if (nbOfLoadedLayers > 0 && nbOfLoadedLayers === this._layersArray.length) {
			this._loadStatus = 2;
		} else {
			this._loadStatus = 0;
		}

		if (this._loadStatus !== oldLoadStatus && this.parent && this.parent.updateLoadStatus) {
			this.parent.updateLoadStatus();
		}
	}

}

class PageNavigator extends LayerPile {

	// Used in Player, Page and Slice
	get pageNavType() { return this._pageNavType }

	// Used below and in Camera
	get loadingMode() { return this._resourceManager.loadingMode }

	// Used in Camera (for segment loading mode, when using a target goTo
	get isInAGoTo() { return (this._targetPageSegmentIndex !== null) }

	// Used in StateHandler
	get doOnStateChangeStartOrCancel() {
		return (stateIndex, isGoingForward) => this._updatePageLoadTasks(stateIndex, isGoingForward)
	}

	// Used below, in Player and in ResourceManager
	get pageIndex() {
		const pageIndex = (this.handler && this.handler.type === "stateHandler")
			? this.handler.stateIndex
			: 0;
		return pageIndex
	}

	// Used in InteractionManager and Camera
	get currentPage() { return this._currentPage }

	// Used in InteractionManager
	get direction() { return this._direction }

	// Used in Slice

	get metadata() { return this._metadata }

	get segmentRange() { return this._segmentRange }

	// Used below and in Slideshow
	get nbOfPages() { return this.layersArray.length }

	// Used in Slideshow
	get interactionManager() { return this._interactionManager }

	// Used in Camera
	get nbOfSegments() { return this._allSegmentLayersArray.length }

	constructor(pageNavType, metadata, pageLayersArray, player) {
		const name = `${pageNavType}PageNav`;
		const parent = null;
		super("pageNavigator", name, parent, pageLayersArray);

		this._pageNavType = pageNavType;
		this._metadata = metadata;
		this._player = player;

		this._direction = null;

		const {
			eventEmitter, interactionManager, resourceManager, timeAnimationManager,
		} = player;
		this._eventEmitter = eventEmitter;
		this._interactionManager = interactionManager;
		this._resourceManager = resourceManager;
		this._timeAnimationManager = timeAnimationManager;

		const shouldStateLayersCoexistOutsideTransitions = false;
		this.addStateHandler(shouldStateLayersCoexistOutsideTransitions, player);

		// Pages and segments have been fully populated by the time we create the PageNavigator
		const allSegmentLayersArray = [];
		this.layersArray.forEach((layer) => {
			const page = layer.content;
			const { layersArray } = page || {};
			if (layersArray) {
				allSegmentLayersArray.push(...layersArray);
			}
		});
		this._allSegmentLayersArray = allSegmentLayersArray;

		this._currentPage = null; // The current page will be the page pointed to by pageIndex

		this._targetPageSegmentIndex = null; // A segment index in the considered page

		// Segments for which resources are required to be loaded
		this._segmentRange = {
			startIndex: null,
			endIndex: null,
			segmentIndex: null,
		};

		this._pageDeltaForTransitionControl = null;

		this._soundsDataArray = null;
	}

	// Used in StoryBuilder
	addSoundData(soundData) {
		if (!this._soundsDataArray) {
			this._soundsDataArray = [];
		}
		this._soundsDataArray.push(soundData);
	}

	// Used in Slideshow and Player (targetSegmentIndex can be null in the case of a tag change)
	updateLoadTasks(targetPageIndex, targetSegmentIndex) {
		// Kill tasks in the async task queue
		this._resourceManager.killPendingLoads();

		// Create async tasks for destroying and loading resources (i.e. force an update of load tasks
		// within the segment range even if the range's start and end indices have not changed)
		const forceUpdate = true;
		if (this.loadingMode === "segment") {
			this.updateSegmentLoadTasks(targetSegmentIndex, forceUpdate);
		} else {
			const pageIndex = (targetPageIndex !== null) ? targetPageIndex : (this.pageIndex || 0);
			const isGoingForward = ((pageIndex - (this.pageIndex || 0)) >= 0);
			this._updatePageLoadTasks(pageIndex, isGoingForward, forceUpdate);
		}
	}

	// Used just above and in Camera
	updateSegmentLoadTasks(segmentIndex, forceUpdate) {
		if (segmentIndex === null) { // In the case of a tag change, keep current segmentRange
			this._updateLoadTasksForSegmentRange(this.pageIndex, this._segmentRange.segmentIndex,
				this._segmentRange, forceUpdate);

		} else {
			const segmentRange = this._getPageOrSegmentRange("segment", segmentIndex);
			segmentRange.segmentIndex = segmentIndex;

			// Note that pageIndex is not affected by a scroll (and is initially null)
			this._updateLoadTasksForSegmentRange(this.pageIndex || 0, segmentIndex, segmentRange,
				forceUpdate);
		}
	}

	// Used above (on starting a page change or after a goTo or tag change in page loading mode)
	_updatePageLoadTasks(targetPageIndex, isGoingForward, forceUpdate = false) {
		const targetSegmentIndex = (isGoingForward === true)
			? this.getIndexOfFirstSegmentInPage(targetPageIndex)
			: this.getIndexOfFirstSegmentInPage(targetPageIndex + 1) - 1;

		let segmentRange = {};
		if (this.loadingMode === "page") {
			const pageRange = this._getPageOrSegmentRange("page", targetPageIndex);
			segmentRange = this._getSegmentRangeFromPageRange(pageRange);
		} else {
			segmentRange = this._getPageOrSegmentRange("segment", targetSegmentIndex);
		}
		segmentRange.segmentIndex = targetSegmentIndex;

		this._updateLoadTasksForSegmentRange(targetPageIndex, targetSegmentIndex, segmentRange,
			forceUpdate);
	}

	_updateLoadTasksForSegmentRange(targetPageIndex = 0, targetSegmentIndex, segmentRange,
		forceUpdate = false) {
		// Update priorities for load tasks (if some tasks are still pending)
		this._resourceManager.updatePriorities(targetPageIndex, targetSegmentIndex);

		// Determine which pages have been added or removed
		const { startIndex, endIndex } = segmentRange;
		if (forceUpdate === false // forceUpdate = true on a reading mode or tag change, false otherwise
			&& (startIndex === null || endIndex === null
			|| (startIndex === this._segmentRange.startIndex // start and end indices have not changed
				&& endIndex === this._segmentRange.endIndex))) {
			return
		}

		const segmentsToAddIndices = [];
		const segmentsToRemoveIndices = [];
		// Determine added page indices
		for (let i = startIndex; i <= endIndex; i += 1) {
			if (forceUpdate === true || this._segmentRange.startIndex === null
				|| (i < this._segmentRange.startIndex || i > this._segmentRange.endIndex)
				|| this._allSegmentLayersArray[i].loadStatus === 0) {
				segmentsToAddIndices.push(i);
			}
		}
		// Determine removed page indices
		if (forceUpdate === false // No need to populate the list on a reading mode or tag change
			&& this._segmentRange.startIndex !== null && this._segmentRange.endIndex !== null) {
			for (let i = this._segmentRange.startIndex;
				i <= this._segmentRange.endIndex; i += 1) {
				if (i < startIndex || i > endIndex) {
					segmentsToRemoveIndices.push(i);
				}
			}
		}
		// Store active page range for next time (i.e. next page change)
		this._segmentRange = segmentRange;

		// Load relevant resources
		const newResourceIdsSet = new Set(); // Used to list all *individual* resource ids
		segmentsToAddIndices.forEach((segmentIndex) => {
			const segmentLayer = this._getSegmentLayerWithIndex(segmentIndex);
			if (segmentLayer) {
				const arrayOfSliceResourceDataArray = [];

				// Get ids for resources in transitions (which are stored at page layer level)
				const segment = segmentLayer.content;
				const { pageSegmentIndex, pageIndex } = segment;
				if (pageSegmentIndex === 0 && pageIndex < this.layersArray.length) {
					const pageLayer = this.layersArray[pageIndex];
					const recursive = false;
					const array = pageLayer.getResourceIdsToLoad(recursive, forceUpdate);
					arrayOfSliceResourceDataArray.push(...array);
				}

				// Get ids for resources in slices (including child layers/slices)
				const recursive = true;
				const array = segmentLayer.getResourceIdsToLoad(recursive, forceUpdate);
				arrayOfSliceResourceDataArray.push(...array);

				arrayOfSliceResourceDataArray.forEach((sliceResourceDataArray) => {
					this._resourceManager.loadResources(sliceResourceDataArray, pageIndex, segmentIndex);
					sliceResourceDataArray.forEach(({ resourceId }) => {
						newResourceIdsSet.add(resourceId);
					});
				});

				// Handle sound resources
				if (this._soundsDataArray) {
					this._soundsDataArray.forEach((soundData) => {
						const { resourceId, segmentIndicesArray } = soundData;
						if (!segmentIndicesArray) { // For a global sound
							this._resourceManager.loadResources([{ resourceId }], pageIndex, segmentIndex);
							newResourceIdsSet.add(resourceId);
						} else {
							let result = false;
							segmentsToAddIndices.forEach((index) => {
								if (segmentIndicesArray.includes(index) === true) {
									result = true;
								}
							});
							if (result === true) {
								this._resourceManager.loadResources([{ resourceId }], pageIndex, segmentIndex);
								newResourceIdsSet.add(resourceId);
							}
						}
					});
				}
			}
		});

		// Destroy relevant resources
		if (this._resourceManager.allowsDestroy === true) {

			if (forceUpdate === true) {
				// Destroy all resources except those whose ids are in newResourceIdsSet
				const newResourceIdsArray = [];
				newResourceIdsSet.forEach((resourceId) => {
					newResourceIdsArray.push(resourceId);
				});
				this._resourceManager.forceDestroyAllResourcesExceptIds(newResourceIdsArray);
			}

			segmentsToRemoveIndices.forEach((segmentIndex) => {
				const segmentLayer = this._getSegmentLayerWithIndex(segmentIndex);
				if (segmentLayer) {
					// Destroy resources in transitions and sound animations
					// (which are stored at page layer level)
					const segment = segmentLayer.content;
					const { pageSegmentIndex, pageIndex } = segment;
					if (pageSegmentIndex === 0 && pageIndex < this.layersArray.length) {
						const pageLayer = this.layersArray[pageIndex];
						pageLayer.destroyResourcesIfPossible();
					}
					segmentLayer.destroyResourcesIfPossible();
				}
			});
		}
	}

	// Used in Slideshow
	getLastPageSegmentIndexForPage(pageIndex) {
		const page = this.layersArray[pageIndex].content;
		const pageSegmentIndex = page.getLastPageSegmentIndex();
		return pageSegmentIndex
	}

	// Used above, in Slideshow and in Player
	getIndexOfFirstSegmentInPage(targetPageIndex) {
		let i = 0;
		let nbOfSegments = 0;
		while (i < this.nbOfPages && i !== targetPageIndex) {
			const layer = this.layersArray[i];
			const page = layer.content;
			const { layersArray } = page;
			nbOfSegments += layersArray.length;
			i += 1;
		}
		return nbOfSegments
	}

	_getPageOrSegmentRange(type, index) {
		let maxIndex = null;

		switch (type) {
		case "segment":
			maxIndex = (this._allSegmentLayersArray.length > 0)
				? (this._allSegmentLayersArray.length - 1)
				: null;
			break
		default: // "page"
			maxIndex = (this.nbOfPages > 0) ? (this.nbOfPages - 1) : null;
			break
		}
		if (maxIndex === null) {
			return { startIndex: null, endIndex: null }
		}

		const { maxNbOfUnitsToLoadAfter, maxNbOfUnitsToLoadBefore } = this._resourceManager;

		let startIndex = 0;
		let endIndex = maxIndex;
		if (maxNbOfUnitsToLoadAfter !== null) {
			startIndex = (maxNbOfUnitsToLoadBefore === null)
				? 0
				: Math.max(0, index - maxNbOfUnitsToLoadBefore);
			endIndex = (maxNbOfUnitsToLoadAfter === null)
				? maxIndex
				: Math.min(maxIndex, index + maxNbOfUnitsToLoadAfter);
		}

		return { startIndex, endIndex }
	}

	_getSegmentRangeFromPageRange(pageRange) {
		let startIndex = 0;
		let endIndex = 0;
		let currentNbOfSegments = 0;
		let hasEndBeenReached = false;
		let i = 0;
		while (i < this.nbOfPages && hasEndBeenReached === false) {
			if (i === pageRange.startIndex) {
				startIndex = currentNbOfSegments;
			}
			const layer = this.layersArray[i];
			const page = layer.content;
			const { layersArray } = page;
			const nbOfSegmentsInPage = layersArray.length;
			currentNbOfSegments += nbOfSegmentsInPage;
			if (i === pageRange.endIndex) {
				endIndex = currentNbOfSegments - 1;
				hasEndBeenReached = true;
			}
			i += 1;
		}
		if (hasEndBeenReached === false) {
			endIndex = currentNbOfSegments - 1;
		}
		if (endIndex < 0) {
			return { startIndex: null, endIndex: null }
		}
		return { startIndex, endIndex }
	}

	_getSegmentLayerWithIndex(segmentIndex) { // Which is an absolute segment index
		if (this._allSegmentLayersArray.length > 0
			&& segmentIndex >= 0 && segmentIndex < this._allSegmentLayersArray.length) {
			const layer = this._allSegmentLayersArray[segmentIndex];
			return layer
		}
		return null
	}

	// On a successful page change (post-transition), when this.pageIndex (= stateIndex) has changed
	// (note that it's not the page navigator itself that has achieved an entry, but this function
	// is triggered by StateHandler's _endStateChange on a page transition's end nonetheless)
	finalizeEntry() {
		if (this.pageIndex < this.nbOfPages) {
			const pageLayer = this.layersArray[this.pageIndex];
			this._currentPage = pageLayer.content;
		} else {
			return
		}
		if (!this._currentPage) {
			return
		}

		// Signal the page change (to be done before goToSegmentIndex for better event management)
		const locator = this.getLocator();
		const data = { locator, nbOfPages: this.nbOfPages };
		this._eventEmitter.emit("pagechange", data);

		// If the pageNavigator has sounds to play, and they haven't started playing yet, do it
		if (this._timeAnimationManager) { // DO NOT CREATE IT IF NO ANIMATIONS!!!
			this._timeAnimationManager.initializeAnimations(this.pageIndex);
		}

		// If _doOnStateChangeEnd has been called by a goTo, go to the relevant segment directly
		if (this._targetPageSegmentIndex !== null) { // In a normal page change, this will be null, yes!
			const targetPageSegmentIndex = this._targetPageSegmentIndex;
			this._targetPageSegmentIndex = null; // To ensure segmentRange update in "segment" loading mode
			this._currentPage.goToSegmentIndex(targetPageSegmentIndex);
		}
	}

	getLocator() {
		const { href, type } = this._currentPage.getInfo(); // Will get info from first slice in page
		const segmentIndex = this.getIndexOfFirstSegmentInPage(this.pageIndex);
		const totalProgression = (segmentIndex + 1) / this.nbOfSegments;
		const locations = {
			position: this.pageIndex,
			totalProgression,
		};
		const locator = {
			href, type, locations, text: this._pageNavType,
		};
		return locator
	}

	// Used in StateHandler
	getDepthOfNewLayer(oldPageIndex, isGoingForward) {
		if (oldPageIndex < 0 || oldPageIndex >= this.layersArray.length
			|| !this.layersArray[oldPageIndex]) {
			return 1
		}
		const { exitForward, exitBackward } = this.layersArray[oldPageIndex];
		if ((isGoingForward === true && exitForward && exitForward.type === "slide-out")
			|| (isGoingForward === false && exitBackward
				&& (exitBackward.type === "fade-out" || exitBackward.type === "slide-out"))) {
			return 0
		}
		return 1
	}

	attemptStickyStep() {
		if (!this._currentPage || this.isUndergoingChanges === true
			|| this._metadata.overflow !== "paginated") {
			return false
		}
		return this._currentPage.attemptStickyStep()
	}

	zoom(zoomData) {
		if (!this._currentPage || this.isUndergoingChanges === true) {
			return
		}
		this._currentPage.zoom(zoomData);
	}

	// Player functions

	// Also called in Slideshow
	goToPageWithIndex(pageIndex, pageSegmentIndex, progress = 0, shouldSkipTransition = false,
		isChangeControlled = false) {
		let isGoingForward = true;
		this._targetPageSegmentIndex = pageSegmentIndex;
		if (pageSegmentIndex === null) {
			const targetPage = this.layersArray[pageIndex].content;
			this._targetPageSegmentIndex = targetPage.layersArray.length - 1;
		}
		if (!this.handler || this.handler.type !== "stateHandler") {
			return
		}

		const callback = () => {
			// If changing pages
			if (pageIndex !== this.pageIndex) {
				if (this.pageIndex !== null) { // isGoingForward remains true otherwise
					isGoingForward = (pageIndex - this.pageIndex > 0);
				}
				this.handler.goToState(pageIndex, isGoingForward, shouldSkipTransition, isChangeControlled);
				// And then the finalizeEntry above will ensure that
				// we go to _targetPageSegmentIndex directly via goToSegmentIndex

			// Or if staying on the same page but changing segments
			// (in this case, we only need to do the goToSegmentIndex)
			} else {
				this._currentPage.goToSegmentIndex(this._targetPageSegmentIndex, isGoingForward);
				this._targetPageSegmentIndex = null;
			}

			if (progress) {
				this.setPercentInPage(progress);
			}
		};

		// If forcing a page change (e.g. via ToC while a transition is running)
		if (this.handler.isUndergoingChanges === true) {
			this.handler.forceChangesToEnd(callback);
		} else {
			callback();
		}
	}

	setPercentInPage(percent) {
		if (!this._currentPage) {
			return
		}
		this._currentPage.setPercent(percent);
	}

	// On changing PageNavigators

	getCurrentHref() {
		if (!this._currentPage) {
			return null
		}
		return this._currentPage.getCurrentHref()
	}

	finalizeExit() {
		super.finalizeExit();
		this._currentPage = null;
		this.removeFromParent();
	}

	setIsMuted(isMuted) {
		if (!this._soundsDataArray) {
			return
		}
		this._soundsDataArray.forEach(({ resourceId }) => {
			const audioResource = this._resourceManager.getResourceWithId(resourceId);
			if (audioResource) {
				if (isMuted === true) {
					audioResource.mute();
				} else {
					audioResource.unmute();
				}
			}
		});
	}

	destroy() {
		this.removeFromParent();
	}

}

class Slideshow extends PageNavigator {

	constructor(pageNavType, metadata, pageLayersArray, player) {
		super(pageNavType, metadata, pageLayersArray, player);

		const { direction } = metadata || {};
		if (direction) {
			this._setDirection(direction);
		}
	}

	_setDirection(direction) {
		this._direction = direction;

		this.layersArray.forEach((layer) => {
			const page = layer.content;
			page.setInScrollDirection(direction);

			switch (direction) {
			case "ltr":
				page.setHitZoneToPrevious("left");
				page.setHitZoneToNext("right");
				page.setSecondaryAxis("y");
				break
			case "rtl":
				page.setHitZoneToPrevious("right");
				page.setHitZoneToNext("left");
				page.setSecondaryAxis("y");
				break
			case "ttb":
				page.setHitZoneToPrevious("top");
				page.setHitZoneToNext("bottom");
				page.setSecondaryAxis("x");
				break
			case "btt":
				page.setHitZoneToPrevious("bottom");
				page.setHitZoneToNext("top");
				page.setSecondaryAxis("x");
				break
			}
		});
	}

	go(way, shouldGoToMax) {
		if (!this._direction
			|| ((way === "right" || way === "left")
				&& (this._direction === "ttb" || this._direction === "btt"))
			|| ((way === "down" || way === "up")
				&& (this._direction === "rtl" || this._direction === "ltr"))) {
			return
		}

		if (shouldGoToMax === true) {
			let targetPageIndex = 0;
			let targetPageSegmentIndex = 0;
			if (((way === "right" || way === "down")
				&& (this._direction === "ltr" || this._direction === "ttb"))
				|| ((way === "left" || way === "up")
					&& (this._direction === "rtl" || this._direction === "btt"))) {
				targetPageIndex = this.nbOfPages - 1;
				targetPageSegmentIndex = this.getLastPageSegmentIndexForPage(targetPageIndex);
			}
			if (targetPageIndex >= 0) {
				let targetSegmentIndex = this.getIndexOfFirstSegmentInPage(targetPageIndex);
				targetSegmentIndex += targetPageSegmentIndex;
				this.updateLoadTasks(targetPageIndex, targetSegmentIndex);

				const shouldSkipTransition = true;
				const progress = ((way === "right" && this._direction === "ltr")
					|| (way === "left" && this._direction === "rtl")
					|| (way === "down" && this._direction === "ttb")
					|| (way === "up" && this._direction === "btt"))
					? 1
					: 0;
				this.goToPageWithIndex(targetPageIndex, targetPageSegmentIndex, progress,
					shouldSkipTransition);
			}

		} else {
			switch (way) {
			case "right":
				this.interactionManager.goRight();
				break
			case "left":
				this.interactionManager.goLeft();
				break
			case "down":
				this.interactionManager.goDown();
				break
			case "up":
				this.interactionManager.goUp();
				break
			}
		}
	}

	goForward() {
		const shouldSkipTransition = false;
		this.attemptToGoForward(shouldSkipTransition);
	}

	goBackward() {
		const shouldSkipTransition = false;
		this.attemptToGoBackward(shouldSkipTransition);
	}

	goSidewaysIfPossible(way) {
		return this.attemptToGoSideways(way) // A return is needed here (see InteractionManager)
	}

}

class Layer {

	get type() { return this._type }

	get content() { return this._content } // A Container in any case

	get entryForward() { return this._entryForward }

	get exitForward() { return this._exitForward }

	get entryBackward() { return this._entryBackward }

	get exitBackward() { return this._exitBackward }

	get loadStatus() { return (this._content) ? this._content.loadStatus : 0 }

	get size() {
		if (!this._content) {
			return { width: 0, height: 0 }
		}
		return this._content.size
	}

	get resourcePath() {
		if (this._type !== "slice" || !this._content) {
			return null
		}
		return this._content.resourcePath
	}

	// Used in LayerPile: only a layer can be active, and it basically means that its content
	// could be displayed on screen right now (i.e. it is an on-screen page, an on-screen page's
	// on-screen or out-of-screen segment, or such a segment's slice - however slice transitions,
	// which never form the content of a layer, will not be concerned by this property)
	get isActive() { return this._isActive }

	constructor(type, content) {
		this._type = type;
		this._content = content;
		if (this._content.setParentLayer) {
			this._content.setParentLayer(this);
		}

		this._soundAnimationsArray = null;

		this._isActive = false;
	}

	setParent(parent) {
		if (!this._content) {
			return
		}
		this._content.setParent(parent);
	}

	// Used in StoryBuilder
	setHalfTransition(type, value) {
		switch (type) {
		case "entryForward":
			this._entryForward = value;
			break
		case "exitForward":
			this._exitForward = value;
			break
		case "entryBackward":
			this._entryBackward = value;
			break
		case "exitBackward":
			this._exitBackward = value;
			break
		}
	}

	addSoundAnimations(soundAnimationsArray) {
		this._soundAnimationsArray = this._soundAnimationsArray || [];
		this._soundAnimationsArray.push(...soundAnimationsArray);
	}

	attemptToGoForward(shouldCancelTransition, doIfIsUndergoingChanges) {
		if (!this._content || !this._content.attemptToGoForward) {
			return false
		}
		return this._content.attemptToGoForward(shouldCancelTransition, doIfIsUndergoingChanges)
	}

	attemptToGoBackward(shouldCancelTransition, doIfIsUndergoingChanges) {
		if (!this._content || !this._content.attemptToGoBackward) {
			return false
		}
		return this._content.attemptToGoBackward(shouldCancelTransition, doIfIsUndergoingChanges)
	}

	attemptToGoSideways(way) {
		if (!this._content || !this._content.attemptToGoSideways) {
			return false
		}
		return this._content.attemptToGoSideways(way)
	}

	setScale(scale) {
		if (!this._content) {
			return
		}
		this._content.setScale(scale);
	}

	// Recursive functions (used in LayerPile)

	resize() {
		if (!this._content) {
			return
		}
		this._content.resize();
	}

	setupForEntry(isGoingForward) {
		this._isActive = true;
		this.setIsInViewport(true);
		if (!this._content) {
			return
		}
		this._content.setupForEntry(isGoingForward);
	}

	setIsInViewport(isInViewport) {
		if (!this._content) {
			return
		}
		this._content.setIsInViewport(isInViewport);
	}

	finalizeEntry() {
		if (!this._content) {
			return
		}
		this._content.finalizeEntry();
	}

	finalizeExit() {
		this._isActive = false;
		this.setIsInViewport(false);
		if (!this._content) {
			return
		}
		this._content.finalizeExit();
	}

	// Used in PageNavigator
	getResourceIdsToLoad(recursive = true, force) {
		if (!this._content) {
			return []
		}

		const resourceIdsArray = [];

		if (recursive === true) {
			const idsArray = this._content.getResourceIdsToLoad(recursive, force);
			resourceIdsArray.push(...idsArray);
		}

		if (this._entryForward) {
			const idsArray = Layer.getResourceIdsForLayerTransition(this._entryForward, force);
			resourceIdsArray.push(...idsArray);
		}
		if (this._exitForward) {
			const idsArray = Layer.getResourceIdsForLayerTransition(this._exitForward, force);
			resourceIdsArray.push(...idsArray);
		}
		if (this._entryBackward) {
			const idsArray = Layer.getResourceIdsForLayerTransition(this._entryBackward, force);
			resourceIdsArray.push(...idsArray);
		}
		if (this._exitBackward) {
			const idsArray = Layer.getResourceIdsForLayerTransition(this._exitBackward, force);
			resourceIdsArray.push(...idsArray);
		}

		if (this._soundAnimationsArray) {
			this._soundAnimationsArray.forEach((soundAnimation) => {
				const { resourceId } = soundAnimation || {};
				if (resourceId !== undefined) {
					resourceIdsArray.push([{ resourceId }]);
				}
			});
		}

		return resourceIdsArray
	}

	static getResourceIdsForLayerTransition(layerTransition, force) {
		const { slice } = layerTransition;
		if (!slice) {
			return []
		}
		return slice.getResourceIdsToLoad(force)
	}

	destroyResourcesIfPossible() {
		if (!this._content) {
			return
		}
		this._content.destroyResourcesIfPossible();

		if (this._entryForward) {
			Layer.destroyResourcesIfPossibleForHalfTransition(this._entryForward);
		}
		if (this._exitForward) {
			Layer.destroyResourcesIfPossibleForHalfTransition(this._exitForward);
		}
		if (this._entryBackward) {
			Layer.destroyResourcesIfPossibleForHalfTransition(this._entryBackward);
		}
		if (this._exitBackward) {
			Layer.destroyResourcesIfPossibleForHalfTransition(this._exitBackward);
		}
	}

	static destroyResourcesIfPossibleForHalfTransition(halfTransition) {
		const { slice } = halfTransition;
		if (!slice) {
			return
		}
		slice.destroyResourcesIfPossible();
	}

	// Used in Camera for virtual points
	getInfo() {
		if (!this._content || !this._content.getInfo) {
			return null
		}
		return this._content.getInfo()
	}

}

class Page extends LayerPile {

	get isAtStart() {
		return (this.handler && this.handler.type === "overflowHandler"
			&& this.handler.isAtStart === true)
	}

	get isAtEnd() {
		return (this.handler && this.handler.type === "overflowHandler"
			&& this.handler.isAtEnd === true)
	}

	// Used in PageNavigator
	get doesOverflow() { return (this.isAtStart === false || this.isAtEnd === false) }

	// Used in Segment
	get pageIndex() { return this._pageIndex }

	// Used in InteractionManager

	get inScrollDirection() { return this._inScrollDirection }

	get hitZoneToPrevious() { return this._hitZoneToPrevious }

	get hitZoneToNext() { return this._hitZoneToNext }

	get secondaryAxis() { return this._secondaryAxis }

	get size() {
		let width = 0;
		let height = 0;
		// The size is derived from the sizes of all segments
		this.layersArray.forEach((layer) => {
			const segment = layer.content;
			const { size } = segment;
			if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
				width += size.width;
				height = Math.max(height, size.height);
			} else {
				height += size.height;
				width = Math.max(width, size.width);
			}
		});
		if (this._layersArray.length > 1) {
			const { viewportRect } = this._player;
			if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
				height = Math.min(height, viewportRect.height);
			} else if (this._inScrollDirection === "ttb" || this._inScrollDirection === "btt") {
				width = Math.min(width, viewportRect.width);
			}
			// Note that the above will prevent scrolling on the secondary axis
			// in a page that has more than one segment
		}
		return { width, height }
	}

	constructor(pageIndex, overflow, hAlign, vAlign, player) {
		const name = `page${pageIndex}`;
		super("page", name);

		this._pageIndex = pageIndex;
		this._player = player;

		this._hitZoneToPrevious = null;
		this._hitZoneToNext = null;
		this._inScrollDirection = null;

		this._addOverflowHandler(overflow, hAlign, vAlign, player);

		this._timeAnimationsArray = [];
	}

	setInScrollDirection(inScrollDirection) {
		this._inScrollDirection = inScrollDirection;
		if (!this.handler || this.handler.type !== "overflowHandler") {
			return
		}
		this.handler.setInScrollDirection(inScrollDirection);
	}

	setHitZoneToPrevious(quadrant) {
		this._hitZoneToPrevious = quadrant;
	}

	setHitZoneToNext(quadrant) {
		this._hitZoneToNext = quadrant;
	}

	setSecondaryAxis(axis) {
		this._secondaryAxis = axis;
	}

	addSegment(segment) {
		// Add the segment to the layer pile
		const segmentLayer = new Layer("segment", segment);
		this.addLayer(segmentLayer);
	}

	addSnapPoints(pageSegmentIndex, snapPointsArray) {
		if (!this.handler || this.handler.type !== "overflowHandler") {
			return
		}
		this.handler.addSnapPoints(pageSegmentIndex, snapPointsArray);
	}

	addSliceAnimation(pageSegmentIndex, slice, animation) {
		if (this.handler && this.handler.type === "overflowHandler") {
			this.handler.addSliceAnimation(pageSegmentIndex, slice, animation);
		}
	}

	addSoundAnimation(pageSegmentIndex, animation) {
		if (!this.handler || this.handler.type !== "overflowHandler") {
			return
		}
		this.handler.addSoundAnimation(pageSegmentIndex, animation);
	}

	// Used in PageNavigator
	goToSegmentIndex(pageSegmentIndex, isGoingForward = true) {
		if (!this.handler || this.handler.type !== "overflowHandler") {
			return
		}
		this.handler.goToSegmentIndex(pageSegmentIndex, isGoingForward);
	}

	// Used in PageNavigator
	getLastPageSegmentIndex() {
		return (this.layersArray.length - 1)
	}

	attemptStickyStep() {
		if (!this.handler || this.handler.type !== "overflowHandler") {
			return false
		}
		return this.handler.attemptStickyStep()
	}

	zoom(zoomData) {
		if (!this.handler || this.handler.type !== "overflowHandler") {
			return
		}
		this.handler.zoom(zoomData);
	}

	setPercent(percent) {
		if (!this.handler || this.handler.type !== "overflowHandler") {
			return
		}
		this.handler.setPercent(percent);
	}

	// Used in PageNavigator
	getCurrentHref() {
		if (!this.handler || this.handler.type !== "overflowHandler") {
			return null
		}
		return this.handler.getCurrentHref()
	}

	resizePage() {
		const pageNavigator = this.parent;
		if (!pageNavigator) {
			return
		}
		pageNavigator.layersArray.forEach((layer) => {
			const { content, isActive } = layer; // content is a Page
			if (content === this && isActive === true) {
				this.resize();
			}
		});
	}

	updateLoadStatus() {
		const oldStatus = this.loadStatus;

		super.updateLoadStatus();

		if (this.loadStatus !== oldStatus) {
			const { eventEmitter } = this._player;
			const data = { pageIndex: this._pageIndex, loadStatus: this.loadStatus };
			eventEmitter.emit("pageloadstatusupdate", data);
		}
	}

	getInfo() {
		const pageNavigator = this.parent;
		if (!pageNavigator) {
			return {}
		}
		const { pageNavType } = pageNavigator;
		if (pageNavType !== "double") {
			return super.getInfo()
		}
		// For a double page, if the first (half) page is empty, then the second one may be considered
		const result = this.layersArray[0].getInfo();
		if (result.href === "" && this.layersArray.length === 2) {
			return this.layersArray[1].getInfo()
		}
		return result
	}

}

class Segment extends LayerPile {

	// Used in StoryBuilder and PageNavigator
	get pageSegmentIndex() { return this._pageSegmentIndex }

	// Used in PageNavigator
	get pageIndex() { return this._pageIndex }

	// Used in Camera and Slice
	get segmentIndex() { return this._segmentIndex }

	// Used in Camera
	get unscaledSize() {
		return (this.layersArray.length > 0)
			? this.layersArray[0].content.unscaledSize
			: { width: 0, height: 0 }
	}

	constructor(pageSegmentIndex, segmentIndex, page, sliceLayersArray, player) {
		const { pageIndex } = page;
		const name = `page${pageIndex}Segment${pageSegmentIndex}`;
		const isFirstSliceAParentSlice = (sliceLayersArray.length > 1);
		super("segment", name, page, sliceLayersArray, isFirstSliceAParentSlice);

		this._pageIndex = pageIndex;
		this._pageSegmentIndex = pageSegmentIndex; // Segment index in page
		this._segmentIndex = segmentIndex;

		// Add a StateHandler to the Segment if it has multiple layers
		if (sliceLayersArray.length > 1) {
			const shouldStateLayersCoexistOutsideTransitions = true;
			this.addStateHandler(shouldStateLayersCoexistOutsideTransitions, player);
		}

		// It is useful to do the following right away for (double page) empty slices,
		// so that their loadStatus equal 2
		this.updateLoadStatus();
	}

	resize() {
		super.resize();

		// If the segment has multiple layers, clip it to its actual size
		if (this.layersArray.length > 1) {
			this.clipToSize(this.size);
		}
	}

}

class StoryBuilder {

	static createPageNavigator(pageNavType, pageNavData, sharedMetadata, slices, player) {
		const { metadata, globalSoundsArray } = pageNavData; // Note that this metadata is specific
		const fullMetadata = { ...sharedMetadata, ...metadata };

		const pageLayersArray = StoryBuilder.buildPageLayersArray(pageNavType, pageNavData,
			fullMetadata, slices, player);
		const pageNavigator = new Slideshow(pageNavType, fullMetadata, pageLayersArray, player);

		if (globalSoundsArray) { // Global sounds are necessarily time animations
			globalSoundsArray.forEach(({ resourceId }) => {
				pageNavigator.addSoundData({ resourceId }); // No segment indices will mean all pages!
			});

			// Add to TimeAnimationsManager
			const pageIndex = null;
			player.timeAnimationManager.addSoundAnimations(globalSoundsArray, pageIndex);
		}

		// Scan all sound animations, storing sound data on the one hand (see just below),
		// and adding time animations to the time animation manager on the other
		let segmentIndex = 0;
		const soundDataByResourceId = {};
		const { pagesDataArray } = pageNavData;
		pagesDataArray.forEach((pageData, i) => {
			const { segmentsDataArray } = pageData;
			segmentsDataArray.forEach((segmentData) => {
				const { soundAnimationsArray } = segmentData;
				if (soundAnimationsArray) {
					soundAnimationsArray.forEach((animation) => {
						const { type, resourceId } = animation;
						if (!soundDataByResourceId[resourceId]) {
							soundDataByResourceId[resourceId] = [];
						}
						const { length } = soundDataByResourceId[resourceId];
						if (length === 0
							|| soundDataByResourceId[resourceId][length - 1] !== i) {
							soundDataByResourceId[resourceId].push(segmentIndex);
						}
						if (type === "time") {
							player.timeAnimationManager.addSoundAnimations([animation], i);
						} // Progress and point animations are dealt with below
					});
				}
				segmentIndex += 1;
			});
		});

		// Store all sound data in the page navigator to allow for related load tasks
		Object.entries(soundDataByResourceId).forEach(([resourceId, segmentIndicesArray]) => {
			pageNavigator.addSoundData({ resourceId, segmentIndicesArray });
		});

		return pageNavigator
	}

	static buildPageLayersArray(pageNavType, pageNavData, metadata, slices, player) {
		const { pagesDataArray } = pageNavData;
		const { overflow, hAlign, vAlign } = metadata;

		const pagesArray = [];
		let segmentIndex = 0;

		// For double pages
		let emptySlice = null;
		let lastSlice = null;

		pagesDataArray.forEach((pageData, i) => {

			const actualHAlign = pageData.hAlign || hAlign;
			const actualVAlign = pageData.vAlign || vAlign;

			const page = new Page(i, overflow, actualHAlign, actualVAlign, player);

			const { segmentsDataArray } = pageData;
			segmentsDataArray.forEach((segmentData, j) => {
				const {
					sliceId, childrenArray, snapPointsArray, soundAnimationsArray,
				} = segmentData;
				const sliceLayersArray = [];

				// If an empty slice (in a double page)
				if (sliceId === undefined) {
					emptySlice = Slice.createEmptySlice(player);
					const emptySliceLayersArray = [new Layer("slice", emptySlice)];
					const emptySegment = new Segment(j, segmentIndex, page, emptySliceLayersArray,
						player);
					page.addSegment(emptySegment);

					if (j === 1) {
						emptySlice._neighbor = lastSlice;
						emptySlice = null;
						lastSlice = null;
					}

				// Otherwise, for a normal page
				} else {
					const slice = slices[sliceId];
					const sliceLayer = new Layer("slice", slice);
					sliceLayersArray.push(sliceLayer);

					// For double pages
					if (emptySlice) { // If emptySlice was in the first position in the page
						emptySlice._neighbor = slice;
						emptySlice = null;
					}
					lastSlice = slice;

					// If there are child layers, add them (the parent one is used to define a reference size)
					if (childrenArray && childrenArray.length > 0) {
						childrenArray.forEach((child) => {
							const childSlice = slices[child.sliceId];
							const childSliceLayer = new Layer("slice", childSlice);

							// Add layer transitions, except for a continuous = true story
							if (pageNavType !== "scroll") {
								const {
									entryForward, exitForward, entryBackward, exitBackward,
								} = child;
								if (entryForward) {
									StoryBuilder._setHalfTransition("entryForward", entryForward,
										childSliceLayer);
								}
								if (exitForward) {
									StoryBuilder._setHalfTransition("exitForward", exitForward,
										childSliceLayer);
								}
								if (entryBackward) {
									StoryBuilder._setHalfTransition("entryBackward", entryBackward,
										childSliceLayer);
								}
								if (exitBackward) {
									StoryBuilder._setHalfTransition("exitBackward", exitBackward,
										childSliceLayer);
								}
							}

							sliceLayersArray.push(childSliceLayer);

							if (child.visualAnimationsArray) {
								child.visualAnimationsArray.forEach((animation) => {
									const { type } = animation;
									if (type === "progress" || type === "point") {
										page.addSliceAnimation(j, childSlice, animation);
									} else { // type === "time"
										player.timeAnimationManager.addSliceAnimation(childSlice,
											animation, i);
									}
								});
							}
						});
					}

					const segment = new Segment(j, segmentIndex, page, sliceLayersArray, player);
					page.addSegment(segment);

					if (soundAnimationsArray) { // Non-global sounds are linked to a page
						soundAnimationsArray.forEach((animation) => {
							const { type } = animation;
							// However time animations will be directly handled by timeAnimationManager
							if (type === "progress" || type === "point") {
								page.addSoundAnimation(j, animation);
							}
						});
					}

					lastSlice = slice;
				}

				if (snapPointsArray) {
					page.addSnapPoints(j, snapPointsArray);
				}

				segmentIndex += 1;
			});

			pagesArray.push(page);
		});

		// Create pageLayersArray
		const pageLayersArray = pagesArray.map((page) => (new Layer("page", page)));

		// Now assign entry and exit half transitions
		// (if forcedTransitionType="cut", don't add transitions at all)
		const { forcedTransitionType } = metadata;
		if (!forcedTransitionType || forcedTransitionType !== "cut") {
			pagesDataArray.forEach((pageData, i) => {
				const {
					entryForward, exitForward, entryBackward, exitBackward,
				} = pageData;
				const pageLayer = pageLayersArray[i];
				if (entryForward) {
					StoryBuilder._setHalfTransition("entryForward", entryForward, pageLayer);
				}
				if (exitForward) {
					StoryBuilder._setHalfTransition("exitForward", exitForward, pageLayer);
				}
				if (entryBackward) {
					StoryBuilder._setHalfTransition("entryBackward", entryBackward, pageLayer);
				}
				if (exitBackward) {
					StoryBuilder._setHalfTransition("exitBackward", exitBackward, pageLayer);
				}
			});
		}

		return pageLayersArray
	}

	static _setHalfTransition(type, value, pageLayer) {
		const { slice } = value;
		if (slice) {
			const page = pageLayer.content;
			slice.setParent(page);
		}
		pageLayer.setHalfTransition(type, value);
	}

}

class Player {

	// Size of the effective viewport (i.e. once viewport ratio constraint is applied),
	// used in TextureElement, InteractionManager, StateHandler, PageNavigator and Camera
	get viewportRect() { return this._viewportRect }

	// Used in Camera
	get viewportBoundingRect() { return this._renderer.size }

	// Used in Camera
	get options() { return this._options }

	// Used in TextureElement
	get readingMode() { return (this._pageNavigator) ? this._pageNavigator.pageNavType : null }

	// Used in PageNavigator
	get interactionManager() { return this._interactionManager }

	// Used in SliceResource, TextureElement, PageNavigator and TagManager
	get resourceManager() { return this._resourceManager }

	// Used in StoryBuilder
	get timeAnimationManager() { return this._timeAnimationManager }

	// Used in ResourceManager and TagManager
	get slices() { return this._slices }

	// Used in Slice and InteractionManager
	get pageNavigator() { return this._pageNavigator }

	// Used below and in InteractionManager
	get canConsiderInteractions() {
		return (this._pageNavigator && this._resourceManager.haveFirstResourcesLoaded === true)
	}

	// Used in outside app and PageNavigator
	get eventEmitter() { return this._eventEmitter }

	// Used in AudioResource
	get isMuted() { return this._isMuted }

	// The rootElement is the parent DOM element (HTML page's body)
	constructor(rootElement, backgroundColor = null) {
		this._rootElement = rootElement;

		// Create the player's renderer
		this._renderer = new Renderer(rootElement, backgroundColor, this);

		// Size the player for the first time
		this._viewportRect = {
			x: 0, y: 0, width: 0, height: 0,
		};
		this.resize();

		// Create the container that will hold the loading message
		this._textManager = new TextManager(this._renderer.mainContainer, this);

		// Create the interaction manager (which will deal with user gestures)
		this._interactionManager = new InteractionManager(this, rootElement);

		// Initialize story data
		this._minRatio = null;
		this._maxRatio = null;
		const shouldReturnDefaultValue = true;
		this._spread = returnValidValue("spread", null, shouldReturnDefaultValue);

		this._tagManager = null;
		this._options = {};

		this._target = { pageIndex: 0, pageSegmentIndex: 0, segmentIndex: 0 };
		this._resourceManager = new ResourceManager(this);

		this._isMuted = true;

		this._timeAnimationManager = new TimeAnimationManager(this);

		this._storyData = {};
		this._slices = {};
		this._pageNavigatorsData = {};
		this._pageNavigator = null;
		this._wasDoublePageReadingModeAvailable = false;

		// Add a resize event listener
		this.resize = this.resize.bind(this);
		window.addEventListener("resize", this.resize);
		window.addEventListener("orientationchange", this._doOnOrientationChange);
		this._timeout = null;

		this._eventEmitter = new EventEmitter();

		// Create DivinaParser
		this._divinaParser = new DivinaParser(this);
	}

	refreshOnce() {
		if (!this._renderer) {
			return
		}
		this._renderer.refreshOnce();
	}

	// The resize function is called on creating the Player, at the end of _setRatioConstraint
	// and whenever a "resize" event is detected (e.g. after an orientation change)
	resize() {
		if (this._timeout) {
			clearTimeout(this._timeout);
		}
		requestAnimationFrame(() => {
			// Size the renderer based on the rootElement's size
			const { width, height } = this._rootElement.getBoundingClientRect();
			this._renderer.setSize(width, height);

			this._sizeViewport(width, height); // The list of available page navigators may be updated
		});
	}

	// This function sizes the viewport based on the rootElement's size and possible ratio constraints
	_sizeViewport(width, height) {
		let viewportWidth = width;
		let viewportHeight = height;

		// Get the (target) ratio value that conforms to the viewport ratio constraints
		const applicableRatio = this._getApplicableRatio(width, height);
		const boundingRectRatio = width / height;

		const topLeftPoint = { x: 0, y: 0 };

		if (boundingRectRatio >= applicableRatio) {
			// The _rootElement's height becomes the viewport's and constrains the viewport's width
			viewportWidth = height * applicableRatio;
			topLeftPoint.x = (width - viewportWidth) / 2;

		} else {
			// The _rootElement's width becomes the viewport's and constrains the viewport's height
			viewportHeight = width / applicableRatio;
			topLeftPoint.y = (height - viewportHeight) / 2;
		}

		// Store the viewport's rectangle
		this._viewportRect = {
			x: topLeftPoint.x, // NOTE THAT x AND y VALUES ARE ONLY USED IN CAMERA, FOR ZOOM!
			y: topLeftPoint.y,
			width: viewportWidth,
			height: viewportHeight,
		};

		// Update the renderer's display (note that zoomFactor is forced to 1 on a resize)
		this.updateDisplayForZoomFactor(1, this._viewportRect);

		// Now resize the current pageNavigator if there is one
		if (this._pageNavigator) {
			this._pageNavigator.resize();
		}

		// Update availability of double reading mode if necessary
		if (this._pageNavigator
			&& this._isDoublePageReadingModeAvailable() !== this._wasDoublePageReadingModeAvailable) {

			const data = { readingMode: this._pageNavigator.pageNavType };
			const actualReadingModes = { ...this._pageNavigatorsData };
			delete actualReadingModes.metadata;
			if (this._wasDoublePageReadingModeAvailable === true) {
				delete actualReadingModes.double;
				this.setReadingMode("single");
			}
			data.readingModesArray = Object.keys(actualReadingModes);
			this._eventEmitter.emit("readingmodesupdate", data);

			this._wasDoublePageReadingModeAvailable = !this._wasDoublePageReadingModeAvailable;
		}
	}

	// Called above and externally
	setReadingMode(readingMode) {
		if (!this._pageNavigator || !readingMode || readingMode === this._pageNavigator.pageNavType) {
			return
		}
		this._setPageNavigator(readingMode);
	}

	// _getApplicableRatio computes the (target) ratio that conforms to viewportRatio constraints
	// Reminder: viewportRatio = { min, max } where both min and max are written as "width:height"
	_getApplicableRatio(width, height) {
		// The default ratio is that of the rootElement's dimensions
		const currentRatio = width / height;

		// If there are no viewportRatio constraints, then keep the rootElement's ratio
		if (!this._minRatio && !this._maxRatio) {
			return currentRatio
		}

		// If there's only a min, or only a max, then apply the constraint
		if (this._minRatio && !this._maxRatio) {
			return Math.max(this._minRatio, currentRatio)
		}
		if (this._maxRatio && !this._minRatio) {
			return Math.min(this._maxRatio, currentRatio)
		}

		// If both a min and max are defined, then apply both constraints
		return Math.min(Math.max(currentRatio, this._minRatio), this._maxRatio)
	}

	// Used in _sizeViewport above (after a resize) and in Camera (when changing zoom)
	updateDisplayForZoomFactor(zoomFactor, viewportRect = this._viewportRect) {
		this._renderer.updateDisplay(zoomFactor, viewportRect);
	}

	// If an orientation change is detected, trigger a resize event after half a second
	// (an awkward hack to deal with orientation changes on iOS devices...)
	_doOnOrientationChange() {
		if (this._timeout) {
			clearTimeout(this._timeout);
		}
		this._timeout = setTimeout(this.resize, 500);
	}

	zoom(zoomData) {
		this._pageNavigator.zoom(zoomData);
	}

	_isDoublePageReadingModeAvailable() {
		return (this._spread === "both"
			|| (this._spread === "landscape" && this._viewportRect.width >= this._viewportRect.height))
	}

	// For loading the divina data from a folder path
	openDivinaFromFolderPath(path, locator = null, options = null) {
		const resourceSource = { folderPath: path };
		const asyncLoadFunction = () => (this._divinaParser.loadFromPath(path, "folder"));
		this._loadDataAndBuildStory(asyncLoadFunction, locator, options, resourceSource);
	}

	// For loading the divina data from a manifest path
	openDivinaFromManifestPath(path, locator = null, options = null) {
		const resourceSource = { folderPath: getFolderPathFromManifestPath(path) };
		const asyncLoadFunction = () => (this._divinaParser.loadFromPath(path, "manifest"));
		this._loadDataAndBuildStory(asyncLoadFunction, locator, options, resourceSource);
	}

	// For loading the divina data from a json and folder path
	openDivinaFromJsonAndFolderPath(json, path, locator = null, options = null) {
		const resourceSource = { folderPath: path };
		const asyncLoadFunction = () => (this._divinaParser.loadFromJson(json));
		this._loadDataAndBuildStory(asyncLoadFunction, locator, options, resourceSource);
	}

	// For loading the divina data from a json
	openDivinaFromJson(json, locator = null, options = null) {
		const path = null;
		this.openDivinaFromJsonAndFolderPath(json, path, locator, options);
	}

	// For loading the divina data from data = { json, base64DataByHref }
	openDivinaFromData(data, locator = null, options = null) {
		const resourceSource = { data };
		const json = (data && data.json) ? data.json : null;
		const asyncLoadFunction = () => (this._divinaParser.loadFromJson(json));
		this._loadDataAndBuildStory(asyncLoadFunction, locator, options, resourceSource);
	}

	_loadDataAndBuildStory(asyncLoadFunction, locator, options, resourceSource) {
		asyncLoadFunction()
			.then((result) => {
				if (!result || result.error) {
					this._showErrorMessage((result) ? result.error : null);
				} else {
					const { folderPath, pageNavigatorsData } = result;
					this._buildStory(locator, options, resourceSource, folderPath, pageNavigatorsData);
				}
			})
			.catch((error) => {
				if (this._textManager) {
					this._showErrorMessage(error);
				} else {
					throw error
				}
			});
	}

	_showErrorMessage(error) {
		if (!this._textManager || !error || !error.message) {
			return
		}
		this._textManager.showMessage({ type: "error", data: error.message });
	}

	_buildStory(locator = null, options = null, resourceSource, folderPath, pageNavigatorsData) {
		this._options = options || {};

		// Set allowed story interactions based on options
		this._interactionManager.setStoryInteractions(this._options);

		// Configure resource manager
		const actualResourceSource = resourceSource;
		if (folderPath) {
			actualResourceSource.folderPath = folderPath;
		}
		this._resourceManager.setResourceSourceAndOptions(actualResourceSource, options);

		const doWithLoadPercentChange = (loadPercent) => {
			if (this._textManager) {
				const { loadingMessage } = this._options;
				this._textManager.showMessage({ type: "loading", data: loadPercent, loadingMessage });
			}
		};
		this._resourceManager.setDoWithLoadPercentChange(doWithLoadPercentChange);

		this._buildStoryFromPageNavigatorsData(pageNavigatorsData, locator);
	}

	// Used in Slice (on creating the Slice)
	addSlice(id, slice) {
		this._slices[id] = slice;
	}

	_buildStoryFromPageNavigatorsData(pageNavigatorsData, locator) {
		this._pageNavigatorsData = pageNavigatorsData;

		const { metadata } = this._pageNavigatorsData; // Common/shared metadata
		const {
			direction, continuous, spread, viewportRatio, languagesArray,
		} = metadata || {};

		// Set spread (used to check whether the double reading mode is available)
		this._spread = spread;

		// Update HTML canvas size to conform to viewportRatio constraints (will trigger a resize)
		this._setRatioConstraint(viewportRatio);

		// Create TagManager to store all tags
		// (note that this._slices has been populated thanks to the Slice's constructor)
		this._tagManager = new TagManager(languagesArray, this._slices, this._resourceManager);

		// If required, do something with the information on available reading modes and languages
		const actualReadingModes = { ...this._pageNavigatorsData };
		delete actualReadingModes.metadata;

		if (this._pageNavigatorsData.double) {
			if (this._isDoublePageReadingModeAvailable() === true) {
				this._wasDoublePageReadingModeAvailable = true;
			} else {
				this._wasDoublePageReadingModeAvailable = false;
				delete actualReadingModes.double;
			}
		}

		const data = {
			readingProgression: direction,
			continuous,
			readingModesArray: Object.keys(actualReadingModes),
			languagesArray,
		};
		this._eventEmitter.emit("dataparsing", data);

		// Now build (and set) the page navigator to start with
		if (this._pageNavigatorsData.single) {
			this._setPageNavigator("single", locator);
		} else if (this._pageNavigatorsData.scroll) {
			this._setPageNavigator("scroll", locator);
		}
	}

	_setRatioConstraint(viewportRatio) {
		if (!viewportRatio) {
			this._minRatio = null;
			this._maxRatio = null;
			return
		}

		// Parse viewportRatio properties to compute the applicable min and max ratio
		let minRatio = null;
		let maxRatio = null;
		const { aspectRatio, constraint } = viewportRatio;
		const ratio = parseAspectRatio(aspectRatio);
		if (!ratio) {
			return
		}
		switch (constraint) {
		case "min":
			minRatio = ratio;
			break
		case "max":
			maxRatio = ratio;
			break
		case "exact":
			minRatio = ratio;
			maxRatio = ratio;
			break
		default:
			return
		}

		// If the min and max values are contradictory, then discard them
		if (minRatio && maxRatio && minRatio > maxRatio) {
			return
		}

		// Now store those min and max values and resize the viewport
		this._minRatio = minRatio;
		this._maxRatio = maxRatio;
		this.resize();
	}

	// Set the pageNavigator, load its first resources and start playing the story
	_setPageNavigator(pageNavType, locator = null) {
		const oldPageNavigator = this._pageNavigator;

		let actualLocator = locator;
		if (!actualLocator && oldPageNavigator) {
			const href = oldPageNavigator.getCurrentHref();
			actualLocator = { href };
		}
		if (actualLocator) {
			const canUseShortenedHref = true;
			this._setTargetBasedOnLocator(locator, pageNavType, oldPageNavigator,
				canUseShortenedHref);
		}

		// Now clean old page navigator
		if (oldPageNavigator) {
			oldPageNavigator.finalizeExit(); // Will also remove its container from its parent
		}

		// Create the page navigator
		const pageNavData = this._pageNavigatorsData[pageNavType];
		const sharedMetadata = this._pageNavigatorsData.metadata;
		this._pageNavigator = StoryBuilder.createPageNavigator(pageNavType,
			pageNavData, sharedMetadata, this._slices, this);

		// Repopulate the main container
		this._renderer.mainContainer.addChild(this._pageNavigator);

		// Set language if none has been defined yet (otherwise keep it)
		const { tags } = this._tagManager;
		const { index, array } = tags.language;
		if (index === null) {
			let languageIndex = 0; // The language array is always at least ["unspecified"]
			if (this._options.language) {
				const { language } = this._options;
				const foundLanguageIndex = array.indexOf(language);
				if (foundLanguageIndex >= 0) {
					languageIndex = foundLanguageIndex;
				}
			}
			const currentLanguage = array[languageIndex];
			const shouldUpdateLoadTasks = false; // Since the first ones haven't been created yet
			this.setLanguage(currentLanguage, shouldUpdateLoadTasks);
		}

		// Do any required updates on the calling app side (e.g. color loadViewer cells differently)
		const data = {
			readingMode: pageNavType,
			nbOfPages: this._pageNavigator.nbOfPages,
			hasSounds: (this._pageNavigator.metadata.hasSounds === true),
			isMuted: this._isMuted,
		};
		this._eventEmitter.emit("readingmodechange", data);

		this._updateLoadTasks(this._target);

		// If the story navigator change occurred before the first resources were loaded
		if (this._resourceManager.haveFirstResourcesLoaded === false) {

			// Add a last task to trigger doAfterInitialLoad and start async queue
			// (if not already running)

			const doAfterRunningInitialLoadTasks = () => {

				// Signal the end of the initial load
				this._eventEmitter.emit("initialload", {});

				// Remove the _textManager
				if (this._textManager) {
					this._textManager.destroy();
					this._textManager = null;
				}

				this._renderer.applyViewportConstraints(); // Before that, would have impacted textManager

				// Now go to the required resource in the current page navigator
				this._goToTarget(this._target);
			};

			const { initialNbOfResourcesToLoad } = this._options;
			const forcedNb = (initialNbOfResourcesToLoad !== undefined
				&& isANumber(initialNbOfResourcesToLoad) && initialNbOfResourcesToLoad > 0)
				? initialNbOfResourcesToLoad
				: null;
			this._resourceManager.runInitialTasks(doAfterRunningInitialLoadTasks, forcedNb);

		// Otherwise determine what page the new story navigator should start on by getting the href
		// of the first resource in the page (in the old story navigator)
		} else {
			this._goToTarget(this._target);
		}
	}

	_setTargetBasedOnLocator(locator, pageNavType = null, oldPageNavigator = null,
		canUseShortenedHref = false) {
		if (!locator) {
			return
		}

		// Get target page and segment indices

		let { href } = locator;
		const { locations, text } = locator;
		let readingMode = pageNavType || text;
		if (!readingMode) {
			readingMode = (locations && locations.progression !== undefined) ? "scroll" : "single";
		}
		if (this._resourceManager.haveFirstResourcesLoaded === true && oldPageNavigator) {
			href = oldPageNavigator.getCurrentHref();
		}

		if (href) {
			this._target = this._getTargetFromHref(readingMode, href, canUseShortenedHref);

		} else if (locations) {
			const { position, progression } = locations;
			if (position !== undefined) {
				const segmentIndex = position;
				this._target = this._getTargetFromSegmentIndex(readingMode, segmentIndex);
				if (progression !== undefined) {
					this._target.progress = progression;
				}
			}
		}
	}

	// For reaching a specific resource directly in the story (typically via a table of contents,
	// however it is also used as the first step into the story navigation)
	_getTargetFromHref(readingMode, targetHref, canUseShortenedHref = false) {
		if (!targetHref) {
			return { pageIndex: 0, pageSegmentIndex: 0, segmentIndex: 0 }
		}

		const targetPath = (canUseShortenedHref === true)
			? getShortenedHref(targetHref) // Which is actually the resource path
			: null;

		let hardTarget = null;
		let softTarget = null;

		Object.values(this._slices).forEach((slice) => {
			const { pageNavInfo } = slice;
			const info = pageNavInfo[readingMode];
			if (info) {
				const { href, path } = slice.getInfo() || {};
				if (hardTarget === null && targetHref === href) {
					hardTarget = info;
				} else if (softTarget === null && targetPath === path) {
					softTarget = info;
				}
			}
		});

		if (hardTarget) {
			return hardTarget
		}
		if (softTarget) {
			return softTarget
		}
		return { pageIndex: 0, pageSegmentIndex: 0, segmentIndex: 0 }
	}

	_getTargetFromSegmentIndex(readingMode, segmentIndex) {
		let target = { pageIndex: 0, pageSegmentIndex: 0, segmentIndex: 0 };
		if (segmentIndex === undefined) {
			return target
		}

		Object.values(this._slices).forEach((slice) => {
			const { pageNavInfo } = slice;
			const info = pageNavInfo[readingMode];
			const { pageIndex, pageSegmentIndex } = info || {};
			if (info && info.segmentIndex === segmentIndex) {
				target = { pageIndex, pageSegmentIndex, segmentIndex };
			}
		});

		return target
	}

	_updateLoadTasks(target) {
		const { pageIndex = null, segmentIndex = null } = target || {};
		this._pageNavigator.updateLoadTasks(pageIndex, segmentIndex);
	}

	// Used above or externally (in the latter case the change will be validated here,
	// and note that shouldUpdateLoadTasks is false on first language set)
	setLanguage(language, shouldUpdateLoadTasks = true) {
		this.setTag("language", language, shouldUpdateLoadTasks);
	}

	setTag(tagName, tagValue, shouldUpdateLoadTasks = true) {
		const hasSucceeded = this._tagManager.setTag(tagName, tagValue);
		if (hasSucceeded === false) {
			return
		}

		// For text slices
		Object.values(this._slices).forEach((slice) => {
			if (tagName === "language" && slice.setLanguage) {
				slice.setLanguage(tagValue);
			}
			this.refreshOnce();
		});

		// For resource slices
		if (shouldUpdateLoadTasks === true) { // False only on first set
			this._updateLoadTasks(null);
		}

		if (tagName === "language") {
			const data = { language: tagValue };
			this._eventEmitter.emit("languagechange", data);
		}
	}

	_goToTarget(target) {
		const { pageIndex = 0, pageSegmentIndex = 0, progress = 0 } = target || {};
		this._target = null;
		const shouldSkipTransition = true;
		this._pageNavigator.goToPageWithIndex(pageIndex, pageSegmentIndex, progress,
			shouldSkipTransition);
	}

	// Used in VideoTexture (for fallbacks) and Slice (for alternates)
	getBestMatchForCurrentTags(idPathFragmentAndTagsArray) {
		return this._tagManager.getBestMatchForCurrentTags(idPathFragmentAndTagsArray)

	}

	goTo(locator) {
		this._setTargetBasedOnLocator(locator);

		if (!this._pageNavigator) {
			return
		}
		this._updateLoadTasks(this._target);

		if (this.canConsiderInteractions === true) {
			this._goToTarget(this._target);
		}
	}

	goToPageWithIndex(pageIndex) {
		if (!this._pageNavigator) {
			return
		}
		const actualPageIndex = pageIndex || 0;
		const segmentIndex = this._pageNavigator.getIndexOfFirstSegmentInPage(actualPageIndex);
		this._target = { pageIndex: actualPageIndex, pageSegmentIndex: 0, segmentIndex };

		this._updateLoadTasks(this._target);

		if (this.canConsiderInteractions === true) {
			this._goToTarget(this._target);
		}
	}

	goRight() {
		if (this.canConsiderInteractions === false) {
			return
		}
		const shouldGoToMax = false;
		this._pageNavigator.go("right", shouldGoToMax);
	}

	goLeft() {
		if (this.canConsiderInteractions === false) {
			return
		}
		const shouldGoToMax = false;
		this._pageNavigator.go("left", shouldGoToMax);
	}

	goDown() {
		if (this.canConsiderInteractions === false) {
			return
		}
		const shouldGoToMax = false;
		this._pageNavigator.go("down", shouldGoToMax);
	}

	goUp() {
		if (this.canConsiderInteractions === false) {
			return
		}
		const shouldGoToMax = false;
		this._pageNavigator.go("up", shouldGoToMax);
	}

	goToMaxRight() {
		if (this.canConsiderInteractions === false) {
			return
		}
		const shouldGoToMax = true;
		this._pageNavigator.go("right", shouldGoToMax);
	}

	goToMaxLeft() {
		if (this.canConsiderInteractions === false) {
			return
		}
		const shouldGoToMax = true;
		this._pageNavigator.go("left", shouldGoToMax);
	}

	goToMaxDown() {
		if (this.canConsiderInteractions === false) {
			return
		}
		const shouldGoToMax = true;
		this._pageNavigator.go("down", shouldGoToMax);
	}

	goToMaxUp() {
		if (this.canConsiderInteractions === false) {
			return
		}
		const shouldGoToMax = true;
		this._pageNavigator.go("up", shouldGoToMax);
	}

	setPercentInPage(percent) {
		if (this.canConsiderInteractions === false) {
			return
		}
		this._pageNavigator.setPercentInPage(percent);
	}

	unmute() {
		this._isMuted = false;
		if (this._pageNavigator) {
			this._pageNavigator.setIsMuted(false);
		}
	}

	mute() {
		this._isMuted = true;
		if (this._pageNavigator) {
			this._pageNavigator.setIsMuted(true);
		}
	}

	// For exiting the application
	destroy() {
		window.removeEventListener("resize", this.resize);
		window.removeEventListener("orientationchange", this._doOnOrientationChange);
		if (this._timeout) {
			clearTimeout(this._timeout);
		}

		if (this._timeAnimationManager) {
			this._timeAnimationManager.destroy();
			this._timeAnimationManager = null;
		}

		// Remove textures and event listeners from slices
		Object.values(this._slices).forEach((slice) => {
			slice.stop();
			slice.destroy();
		});

		if (this._pageNavigator) {
			this._pageNavigator.destroy();
			this._pageNavigator = null;
		}

		if (this._resourceManager) {
			this._resourceManager.destroy();
			this._resourceManager = null;
		}

		if (this._interactionManager) {
			this._interactionManager.destroy();
			this._interactionManager = null;
		}

		if (this._textManager) {
			this._textManager.destroy();
			this._textManager = null;
		}

		if (this._renderer) {
			this._renderer.destroy();
			this._renderer = null;
		}
	}

}

/*! divinaPlayer
 *
 * Copyright (c) 2021 Florian Dupas (Kwalia);
 * Licensed under the MIT license */

module.exports = Player;
//# sourceMappingURL=divina.cjs.js.map
