'use strict';

var pixi_js = require('pixi.js');
var Hammer = require('hammerjs');

class Container {

	// Used in TextureElement
	get name() { return this._name }

	// Used in LayerPile (note that parent below is a Container, not a PIXIContainer)
	get parent() { return this._parent }

	// Used in Camera
	get positionInSegmentLine() { return this._positionInSegmentLine }

	// Used below
	get pixiContainer() { return this._pixiContainer }

	constructor(name = null, parent = null, pixiContainer = null) {
		this._pixiContainer = pixiContainer || new pixi_js.Container();
		this._setName(name);

		if (parent) {
			parent.addChild(this);
		}

		this._maskingPixiContainer = null;
		this._mask = null;

		this._position = { x: 0, y: 0 };
		this._positionInSegmentLine = { x: 0, y: 0 };

		this._scale = 1;

		this._isXPositionUpdating = false;
		this._isYPositionUpdating = false;
	}

	_setName(name, suffix = null) {
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
		// The mask is recreated with each resize (it works better)

		// Remove the mask and create it again
		this._maskingPixiContainer.removeChildren();
		this._mask = new pixi_js.Graphics();
		this._setMaskName();
		this._maskingPixiContainer.addChild(this._mask);
		this._pixiContainer.mask = this._mask;

		// Redraw the mask at the right size
		this._mask.beginFill(0x000000);
		this._mask.drawRect(x, y, w, h);
		this._mask.endFill();
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
		// First store child PIXI containers above index value away
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
		// Finally put child PIXI containers back
		const childrenToPutBack = [...tmpPixiContainer.children].reverse();
		childrenToPutBack.forEach((child) => {
			this._pixiContainer.addChild(child);
		});
	}

	// Functions used in OverflowHandler to layout segments

	setPositionInSegmentLine(positionInSegmentLine) {
		this._positionInSegmentLine = positionInSegmentLine;
	}

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

	setAlpha(alpha) {
		this._pixiContainer.alpha = alpha;
	}

	setVisibility(shouldBeVisible) {
		this._pixiContainer.visible = shouldBeVisible;
	}

	// Used in Layer to handle (a multi-layered segment's) slice layers
	setScale(scale) {
		if (!scale) {
			return
		}
		this._pixiContainer.scale.set(scale);
		this._scale = scale;
	}

}

class Renderer {

	// Used in Player

	get mainContainer() { return this._contentContainer }

	get size() {
		const { width, height } = this._app.renderer;
		return { width, height }
	}

	constructor(rootElement, backgroundColor) {

		// Create the PIXI application with a default background color
		this._app = new pixi_js.Application({
			backgroundColor,
			resolution: /*window.devicePixelRatio ||*/ 1, // Will improve resolution on Retina displays
		});
		this._app.renderer.autoDensity = true;

		// Add the PIXI app's canvas to the DOM
		rootElement.appendChild(this._app.view);

		// Create root container
		const parent = null;
		this._rootContainer = new Container("stage", parent, this._app.stage);

		// Create the container that will hold content (i.e. the current pageNavigator's pages)
		this._contentContainer = new Container("content", this._rootContainer);

		// Add a global mask (which will be used to express viewportRatio constraints)
		this._rootContainer.addMask();
	}

	// Used in Player on a resize
	setSize(width, height) {
		// Resize the canvas using PIXI's built-in function
		this._app.renderer.resize(width, height);
		this._app.render(); // To avoid flickering
	}

	// Used in Player on a resize or as a consequence of a zoomFactor change
	updateDisplay(viewportRect, zoomFactor = 1) {
		const { width, height } = this.size;
		const actualWidth = Math.min(Math.max(viewportRect.width * zoomFactor, 0), width);
		const actualHeight = Math.min(Math.max(viewportRect.height * zoomFactor, 0), height);
		const x = (width - actualWidth) / 2;
		const y = (height - actualHeight) / 2;
		this._rootContainer.setMaskRect(x, y, actualWidth, actualHeight);

		// Update the pivot used to center containers by default
		this._contentContainer.setPivot({
			x: -width / 2,
			y: -height / 2,
		});
	}

	// Used in Player
	destroy() {
		this._rootContainer = null;
		this._contentContainer = null;

		this._app.view.remove();

		const shouldRemoveView = true;
		this._app.destroy(shouldRemoveView);
		this._app = null;
	}

}

// General
const possiblePixelError = 0.5; // Margin of error for pixel computations
const defaultManifestFilename = "manifest.json"; // Title of the JSON file in a divina folder
const defaultBackgroundColor = 0x000000; // Black to ensure the loading message is visible
const defaultDummyColor = 0x333333;
const possibleTagNames = ["language", "resolution"]; // List of allowed tags

// Resources
const acceptableVideoExtensions = ["mp4"];
//export const acceptableImageExtensions = ["png", "jpg"] // Not used

// Loading message
const textFontFamily = "Arial";
const textFontSize = 24;
const textFillColor = 0xFFFFFF; // White to ensure the message is visible
const wordWrapWidth = 275; // Maximum line width

// Loading parameters
const defaultAllowsDestroy = true;
const defaultAllowsParallel = false;
// Nb of pages after the current one for which slice textures should be stored in memory
const defaultMaxNbOfPagesAfter = 1;
// Nb of pages before the current one for which slice textures should be stored in memory,
// as a share of defaultMaxNbOfPagesAfter
const maxShareOfPagesBefore = 1 / 3;
// Timeout to cancel video load (only in non-parallel loading mode)
const defaultVideoLoadTimeout = 2000;

// Story
const defaultReadingProgression = "ltr"; // If no value is specified or if the value is invalid
const defaultContinuous = true; // If no value is specified or if the value is invalid
const defaultFit = "contain"; // If no value is specified or if the value is invalid
const defaultOverflow = "scrolled"; // If no value is specified or if the value is invalid or "auto"
const defaultClipped = false; // If no value is specified or if the value is invalid
const defaultSpread = "none"; // If no value is specified or if the value is invalid or "auto"
const defaultDuration = 750; // In milliseconds (used for transitions and snap point jumps)

// User controls
const defaultAllowsZoom = true;
const defaultAllowsSwipe = true;
const defaultAllowsWheelScroll = true;
// To allow discontinuous gestures to trigger pagination jumps (when overflow === "scrolled")
const defaultAllowsPaginatedScroll = true;
// To make pagination sticky (only when overflow === "paginated")
const defaultIsPaginationSticky = true;
// To compute automatically-computed snap points from the page start (vs. from the current position)
const defaultIsPaginationGridBased = true;

// Interactions
// Percentage of the relevant viewport dimension (width or height, depending on the story's
// reading direction) defining an "active" hit zone (to detect forward/backward clicks/taps)
const referencePercent = 0.3;
const velocityFactor = 10; // For a kinetic scroll
const timeConstant = 325; // For a kinetic scroll
const maxZoomFactor = 3; // Maximum zoom
const zoomSensitivityConstant = 3; // To compute zoom based on scroll
// Percentage of the relevant dimension to scroll to trigger a valid controlled transition
const viewportDimensionPercent = 0.5;

// Snap point speeds: speeds are computed such that the viewport will move by 1 relevant dimension
// (= the viewport's width or height in pixels) in defaultDuration milliseconds
const snapJumpSpeedFactor = 1 / defaultDuration;
// (with the above, duration of a snap point jump = distance in px / speed,
// where speed is defaultDuration * snapJumpSpeedFactor (used in Camera))
const stickyMoveSpeedFactor = 1 / defaultDuration;
// (with the above, duration of a sticky snap point move = distance in px / speed,
// where speed is defaultDuration * stickyMoveSpeedFactor (used in Camera))

var constants = /*#__PURE__*/Object.freeze({
	__proto__: null,
	possiblePixelError: possiblePixelError,
	defaultManifestFilename: defaultManifestFilename,
	defaultBackgroundColor: defaultBackgroundColor,
	defaultDummyColor: defaultDummyColor,
	possibleTagNames: possibleTagNames,
	acceptableVideoExtensions: acceptableVideoExtensions,
	textFontFamily: textFontFamily,
	textFontSize: textFontSize,
	textFillColor: textFillColor,
	wordWrapWidth: wordWrapWidth,
	defaultAllowsDestroy: defaultAllowsDestroy,
	defaultAllowsParallel: defaultAllowsParallel,
	defaultMaxNbOfPagesAfter: defaultMaxNbOfPagesAfter,
	maxShareOfPagesBefore: maxShareOfPagesBefore,
	defaultVideoLoadTimeout: defaultVideoLoadTimeout,
	defaultReadingProgression: defaultReadingProgression,
	defaultContinuous: defaultContinuous,
	defaultFit: defaultFit,
	defaultOverflow: defaultOverflow,
	defaultClipped: defaultClipped,
	defaultSpread: defaultSpread,
	defaultDuration: defaultDuration,
	defaultAllowsZoom: defaultAllowsZoom,
	defaultAllowsSwipe: defaultAllowsSwipe,
	defaultAllowsWheelScroll: defaultAllowsWheelScroll,
	defaultAllowsPaginatedScroll: defaultAllowsPaginatedScroll,
	defaultIsPaginationSticky: defaultIsPaginationSticky,
	defaultIsPaginationGridBased: defaultIsPaginationGridBased,
	referencePercent: referencePercent,
	velocityFactor: velocityFactor,
	timeConstant: timeConstant,
	maxZoomFactor: maxZoomFactor,
	zoomSensitivityConstant: zoomSensitivityConstant,
	viewportDimensionPercent: viewportDimensionPercent,
	snapJumpSpeedFactor: snapJumpSpeedFactor,
	stickyMoveSpeedFactor: stickyMoveSpeedFactor
});

// All functions are used in TextManager

class TextElement extends Container {

	constructor(name, parent) {
		const {
			textFontFamily,
			textFontSize,
			textFillColor,
			wordWrapWidth,
		} = constants;
		const pixiTextContainer = new pixi_js.Text("", {
			fontFamily: textFontFamily,
			fontSize: textFontSize,
			fill: textFillColor,
			wordWrap: true,
			wordWrapWidth,
		});
		pixiTextContainer.anchor.set(0.5);

		super(name, parent, pixiTextContainer);
	}

	setText(text) {
		this._pixiContainer.text = text;
	}

	destroy() {
		this._pixiContainer.destroy({ children: true, texture: true, baseTexture: true });
		this.removeFromParent();
	}

}

class TextureElement extends Container {

	// Used in Slice

	get role() { return this._role }

	get resourceManager() {
		return (this._player) ? this._player.resourceManager : null
	}

	get texture() { // Not relevant to a sequence slice
		if (this._playableSprite && this._playableSprite.texture) {
			return this._playableSprite.texture
		}
		return this._sprite.texture
	}

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
		// Otherwise just return the actual size of the sprite in the viewport
		return {
			width: this._width * this._scale,
			height: this._height * this._scale,
		}
	}

	// Used below
	get unclippedSize() {
		if (this._clipped === false) {
			return this.size
		}
		return {
			width: this._width * this._scale,
			height: this._height * this._scale,
		}
	}

	constructor(resource, player, parentInfo = null, neighbor = null) {
		super();

		this._role = (resource) ? resource.role : null;
		this._player = player;
		this._parentInfo = parentInfo;
		this._neighbor = neighbor;

		this._sprite = new pixi_js.Sprite();
		this._sprite.anchor.set(0.5);
		this._pixiContainer.addChild(this._sprite);

		this._playableSprite = null;
		this._namePrefix = null;

		this._width = 0;
		this._height = 0;
		this._scale = 1;

		this._clipped = false;

		this._duration = 0;

		// Set a (surely temporary) size
		const { viewportRect } = player;
		const { width, height } = resource || {};
		const actualWidth = (width > 0) ? width : viewportRect.width;
		const actualHeight = (height > 0) ? height : viewportRect.height;
		this._setSize({ width: actualWidth, height: actualHeight });

		if (this._role === "layersParent") {
			this._sprite.visible = false;
		}
	}

	_setSize(size) {
		const { width, height } = size;

		this._width = width;
		this._height = height;

		this._sprite.width = width;
		this._sprite.height = height;

		if (this._playableSprite) {
			this._playableSprite.width = this._width;
			this._playableSprite.height = this._height;
		}
	}

	_assignDummyTexture() {
		this._setTexture(pixi_js.Texture.WHITE);
		this._setTint(defaultDummyColor);
	}

	_setTexture(texture) {
		// No need to add a texture to a parent slice
		if (this._role === "layersParent") {
			return
		}
		if (!texture) {
			this._assignDummyTexture();
		} else {
			this._sprite.texture = texture;
			this._setTint(0xFFFFFF);
		}
	}

	_setTint(tint) {
		this._sprite.tint = tint;
	}

	_assignEmptyTexture() {
		this._setTexture(pixi_js.Texture.WHITE);
		this._setTint(defaultBackgroundColor);
	}

	_setVideoTexture(texture) {
		this._sprite.texture = null;
		if (!this._playableSprite) {
			this._addPlayableSprite();
		}
		this._playableSprite.texture = texture;
	}

	_addPlayableSprite(texturesArray = null) {
		if (texturesArray && texturesArray.length > 0) { // For a sequence slice
			this._playableSprite = new pixi_js.AnimatedSprite(texturesArray);
		} else { // For a video slice
			this._playableSprite = new pixi_js.Sprite();
		}
		this._playableSprite.anchor.set(0.5);

		const spriteName = `${this._name}PlayableSprite`;
		this._playableSprite.name = spriteName;

		this._pixiContainer.addChild(this._playableSprite);

		if (this._maskingPixiContainer) {
			this._pixiContainer.addChild(this._maskingPixiContainer);
		}
	}

	// Used in SequenceSlice (since clipped forced to true, a mask will necessarily be created)
	setTexturesArray(texturesArray) {
		this._sprite.texture = null;
		// PixiJS does not allow for a direct assignement (playableSprite.textures = texturesArray),
		// so remove the sequence sprite before recreating it
		if (this._playableSprite) {
			this._pixiContainer.removeChild(this._playableSprite);
			this._playableSprite = null;
		}
		this._addPlayableSprite(texturesArray);
	}

	// Used in Container (called with parent = null) and LayerPile (via Slice)
	// Bear in mind that the parent of a layersLayer slice is a segment (not the parentSlice!)
	setParent(parent = null) {
		super.setParent(parent);

		// Keep the existing name for a transition slice
		if (!parent || (this._name && this._role === "transition")) {
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
		this._setName(name, suffix);
	}

	resize(fit, clipped) {
		this._clipped = clipped;

		this._applyFit(fit);
		if (clipped === true) {
			this._applyClip();
		}

		// If the slice has a parent slice, position it respective to that parent slice
		if (this._role === "layersLayer" && this._parentInfo) {
			// Used unclippedSize since to ensure that the position is based
			// on the top left point of the parent slice (instead of the effective viewport)
			const { unclippedSize } = this._parentInfo.slice;
			this._sprite.position = {
				x: (this.size.width - unclippedSize.width) / (2 * this._scale),
				y: (this.size.height - unclippedSize.height) / (2 * this._scale),
			};
			if (this._playableSprite) {
				this._playableSprite.position = this._sprite.position;
			}
			if (this._maskingPixiContainer) {
				this._maskingPixiContainer.position = this._sprite.position;
			}
		}
	}

	_applyFit(fit) {
		if (!this._width || !this._height
			|| this._role === "layersLayer") { // Scale will remain at 1 for a child
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
			if (this._scale !== scale) { // To prevent triggering an infinite loop
				this.setScale(scale);
				if (this._parent) {
					this._parent.resizePage();
				}
			}
		} else {
			this.setScale(scale);
		}
	}

	_getWidthForHalfSegmentSlice(width) {
		let actualWidth = width;
		if (this._neighbor) {
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
		if (!this._maskingPixiContainer) {
			this.addMask();
		}
		const { viewportRect } = this._player;
		const { width, height } = viewportRect;
		this.setMaskRect((-width / this._scale) / 2, (-height / this._scale) / 2,
			width / this._scale, height / this._scale);
	}

	// Used in Slice on final destroy
	destroy() {
		this._sprite.texture = null;
		if (this._playableSprite) {
			this._playableSprite.texture = null;
		}
	}

}

// Note that the Loader will necessarily store and handle PIXI Textures
// All functions are used in ResourceManager

class Loader {

	get hasTasks() { return (Object.values(this._pathsToLoad).length > 0) }

	constructor() {
		this._pathsToLoad = {};

		this._loader = new pixi_js.Loader();
		this._loader.onError.add((error, loader, resource) => {
			const { name } = resource;
			this._pathsToLoad[name] = false;
		});
	}

	// Kill the ongoing loading operation (if there is one)
	reset() {
		this._pathsToLoad = {};
		this._loader.reset();
	}

	// Add a sourcePath to the list of source paths to load
	add(name, sourcePath) {
		this._pathsToLoad[name] = true;
		this._loader.add(name, sourcePath);
	}

	// Load stored source paths
	load() {
		this._loader.load();
	}

	// For each array of resources (source paths) that have been correctly loaded...
	onComplete(doWithTextureDataArray) {
		if (!doWithTextureDataArray) {
			return
		}
		this._loader.onComplete.add((_, resources) => {
			const textureDataArray = [];
			Object.values(resources).forEach((resource) => {
				const { name, texture } = resource;
				if (this._pathsToLoad[name] === true && texture && texture.baseTexture) {
					const textureData = {
						name,
						baseTexture: texture.baseTexture,
						texture,
					};
					textureDataArray.push(textureData);
				}
			});
			doWithTextureDataArray(textureDataArray);
		});
	}

}

const hasAScheme = (url) => {
	const regExp = new RegExp("^(?:[a-z]+:)?//", "i");
	return (regExp.test(url) === true)
};

const getFolderPathFromManifestPath = (manifestPath) => {
	if (!manifestPath || manifestPath.split("/").length === 1) {
		return ""
	}
	const folderPath = manifestPath.split(`/${defaultManifestFilename}`)[0];
	return folderPath
};

// For type checking (used below)

const isAString = (value) => ( // Used below
	(typeof value === "string" || value instanceof String)
);

const isANumber = (value) => (Number.isFinite(value)); // Used below

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

const isAVideo = (path) => (
	isOfType(path, "video", acceptableVideoExtensions)
);

/*const isAnImage = (path) => (
	isOfType(path, "image", constants.acceptableImageExtensions)
)*/

// For parsing the aspect ratio value written as a string in the divina's viewportRatio property
const parseAspectRatio = (ratio) => {
	if (!ratio) {
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
	const hrefParts = (href && href.split) ? href.split("#") : [];
	const path = hrefParts[0];
	const mediaFragment = (hrefParts.length > 1) ? hrefParts[1] : null;
	return { path, mediaFragment }
};

// For parsing a media fragment string
const parseMediaFragment = (mediaFragment) => {
	if (!mediaFragment) {
		return null
	}
	const mediaFragmentParts = mediaFragment.split("=");
	if (mediaFragmentParts.length !== 2) {
		return null
	}

	let unit = "pixel";
	let xywh = null;
	let fragmentInfo = mediaFragmentParts[1];
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
		unit, x, y, w, h,
	}
};

const getRectForMediaFragmentAndSize = (mediaFragment, { width, height }) => {
	if (!mediaFragment) {
		return null
	}
	const parsedString = parseMediaFragment(mediaFragment);

	if (!parsedString
		|| (parsedString.unit !== "percent" && parsedString.unit !== "pixel")) {
		return null
	}

	const { unit } = parsedString;
	let {
		x, y, w, h,
	} = parsedString;
	if (isANumber(x) === false
		|| isANumber(y) === false
		|| isANumber(w) === false
		|| isANumber(h) === false) {
		return null
	}

	if (unit === "percent") {
		x *= width / 100;
		y *= height / 100;
		w *= width / 100;
		h *= height / 100;
	}

	// Correct potential mistakes in the way the media fragment was written
	// by limiting the fragment to the natural dimensions of the resource
	x = Math.min(Math.max(x, 0), width);
	y = Math.min(Math.max(y, 0), height);
	w = Math.min(Math.max(w, 0), width - x);
	h = Math.min(Math.max(h, 0), height - y);

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

// For parsing and computing the coordinate of a relative resource point
const parseCoordinate = (value, dimensionLength) => {
	if (!value) {
		return null
	}
	if (isAString(value) === false) {
		return null
	}
	let valueParts = value.split("%");
	let relValue = valueParts[0];
	if (valueParts.length !== 2) {
		return null
	}
	if (Number.isNaN(Number(relValue)) === false) {
		return (Number(relValue) * dimensionLength) / 100
	}
	valueParts = relValue.split("px");
	relValue = Number(valueParts[0]);
	if (valueParts.length === 2 && Number.isNaN(Number(relValue)) === false) {
		return Number(relValue)
	}
	return null
};

// For measuring a distance between 2 points (used for snap points and pinch)
const getDistance = (point1, point2) => (
	Math.sqrt((point2.x - point1.x) ** 2 + (point2.y - point1.y) ** 2)
);

// A texture stored in the Loader will need to have the following properties:
// - If it corresponds to an image: .frame.width and .frame.height
// - If it corresponds to a video: .video (the video itself will need to be a videoElement,
//   i.e. it should include videoWidth, videoHeight and duration properties)

class Texture {

	// Used in TextureResource
	static createVideoTexture(videoPath) {
		const texture = pixi_js.Texture.from(videoPath);
		// Prevent autoplay at start
		texture.baseTexture.resource.autoPlay = false;
		// Store a reference to video at texture level for convenience
		const video = texture.baseTexture.resource.source;
		texture.baseTexture.video = video;
		texture.video = video;
		return texture
	}

	// Used in TextureResource
	static cropToFragment(uncroppedTexture, mediaFragment) {
		const texture = uncroppedTexture.clone();

		const rect = getRectForMediaFragmentAndSize(mediaFragment, texture);
		if (rect) {
			const {
				x, y, width, height,
			} = rect;
			const frame = new pixi_js.Rectangle(x, y, width, height);
			texture.frame = frame;
			texture.updateUvs();
		}

		return texture
	}

}

class TextManager extends Container {

	constructor(mainContainer) {
		super("textManager", mainContainer);

		this._textElement = new TextElement("textElement", this);
	}

	showMessage(message) { // Where message should be = { type, data }
		// Beware: we can have message.text = 0 (when divina loading starts)
		if (!message || !message.type || message.data === undefined) {
			return
		}

		// Write full text based on message type
		const { type, data } = message;
		let text = null;
		switch (type) {
		case "loading":
			text = `Loading... ${data}%`;
			break
		case "error":
			text = `ERROR!\n${data}`;
			break
		}

		if (!this._textElement || !text) {
			return
		}
		this._textElement.setText(text);
	}

	destroy() {
		// Since this destroy function already runs after all first resources have loaded,
		// ensure the Player's ultimate call to it does not try and achieve the same
		if (!this._textElement) {
			return
		}
		this._textElement.destroy();
		this._textElement = null;

		this.removeFromParent();
	}

}

class InteractionManager {

	constructor(player, rootElement) {
		this._player = player; // Useful only to get viewportRect below
		this._rootElement = rootElement;

		// Create Hammer object to handle user gestures
		this._mc = new Hammer.Manager(rootElement);

		// Implement single and double tap detection
		const singleTap = new Hammer.Tap({ event: "singletap" });
		const doubleTap = new Hammer.Tap({ event: "doubletap", taps: 2 });
		this._mc.add([doubleTap, singleTap]);
		singleTap.requireFailure(doubleTap);
		doubleTap.recognizeWith(singleTap);

		// Only finalize the implementation of single tap detection at this stage
		this._handleSingleTap = this._handleSingleTap.bind(this);
		this._mc.on("singletap", this._handleSingleTap);

		this._pageNavigator = null;
		this._doOnCenterTap = null;
		this._percentFunction = null; // For (non-wheel scroll) viewport drags
		this._initialTouchPoint = null; // For non-wheel scroll zoom
		this._lastScrollEvent = null; // For non-wheel scroll in general
		this._wasLastEventPanend = false; // For (non-wheel scroll) viewport drags
	}

	_handleSingleTap(e) {
		// If story not loaded yet, only allow a center tap
		if (!this._pageNavigator) {
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
		const { referencePercent } = constants;
		const referenceXLength = topLeftCanvasPoint.x + viewportRect.width * referencePercent;
		const referenceYLength = topLeftCanvasPoint.y + viewportRect.height * referencePercent;

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
		if (!this._pageNavigator) {
			return
		}

		const { currentPage } = this._pageNavigator;
		const { hitZoneToPrevious, hitZoneToNext } = currentPage || {};

		let { goForward, goBackward } = this._pageNavigator;
		goForward = goForward.bind(this._pageNavigator);
		goBackward = goBackward.bind(this._pageNavigator);

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
		} else if (doOtherwise) {
			doOtherwise();
		}
	}

	setStoryInteractions(options) {
		const {
			doOnCenterTap,
			allowsZoom,
			allowsSwipe,
			allowsWheelScroll,
			isPaginationSticky,
		} = options;
		this._doOnCenterTap = doOnCenterTap;
		this._allowsZoom = (allowsZoom === true || allowsZoom === false)
			? allowsZoom
			: defaultAllowsZoom;
		this._allowsSwipe = (allowsSwipe === true || allowsSwipe === false)
			? allowsSwipe
			: defaultAllowsSwipe;
		this._allowsWheelScroll = (allowsWheelScroll === true || allowsWheelScroll === false)
			? allowsWheelScroll
			: defaultAllowsWheelScroll;
		this._isPaginationSticky = (isPaginationSticky === true || isPaginationSticky === false)
			? isPaginationSticky
			: defaultIsPaginationSticky;
	}

	setPageNavigator(pageNavigator) {
		if (!pageNavigator) {
			return
		}

		// If this is a pageNavigator change, no need to recreate gesture handlers
		if (this._pageNavigator) {
			this._pageNavigator = pageNavigator;
			return
		}

		// The first time a pageNavigator is set however, gesture handlers neet to be set up

		this._pageNavigator = pageNavigator;

		// Implement key press handling
		this._handleKeyUp = this._handleKeyUp.bind(this);
		window.addEventListener("keyup", this._handleKeyUp);

		// Implement zoom handling if relevant

		if (this._allowsZoom === true) {

			// Finalize the implementation of double tap detection
			this._handleDoubleTap = this._handleDoubleTap.bind(this);
			this._mc.on("doubletap", this._handleDoubleTap);

			// Implement pinch detection for touch devices
			const pinch = new Hammer.Pinch();
			this._mc.add(pinch);
			this._handlePinch = this._handlePinch.bind(this);
			this._mc.on("pinch", this._handlePinch);

			// Zooming will also be possible via ctrl/alt + scroll
		}

		// Implement swipe detection if relevant
		if (this._allowsSwipe === true) {
			const swipe = new Hammer.Swipe({
				direction: Hammer.DIRECTION_ALL,
				velocity: 0.3, // Default value is 0.3
			});
			this._mc.add(swipe);
			this._handleSwipe = this._handleSwipe.bind(this);
			this._mc.on("swipeleft swiperight swipeup swipedown", this._handleSwipe);
		}

		// Implement non-wheel (= pan) scroll detection

		const pan = new Hammer.Pan({ direction: Hammer.DIRECTION_ALL });
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
	// between the values of 1 and maxZoomFactor - the value defined in constants.js)
	_handleDoubleTap(e) {
		if (!this._pageNavigator) {
			return
		}
		const touchPoint = e.center;
		const zoomData = { isContinuous: false, touchPoint };
		this._pageNavigator.zoom(zoomData);
	}

	_handlePinch(e) {
		if (!this._pageNavigator) {
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
				this._pageNavigator.zoom(zoomData);
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
			if (!this._pageNavigator) {
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
			if ((srcEvent.ctrlKey || srcEvent.altKey) && this._allowsZoom === true) {

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
					this._pageNavigator.zoom(zoomData);
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

				if (this._pageNavigator.endControlledTransition(viewportPercent) === false
					&& (this._isPaginationSticky === false
					|| this._pageNavigator.attemptStickyStep() === false)) {
					this._releaseScroll(e);
				}

				this._resetScroll();
				this._wasLastEventPanend = true;

			// For normal non-wheel scroll
			} else {
				const { currentPage } = this._pageNavigator;
				const { inScrollDirection } = currentPage;

				const { viewportRect } = this._player;
				const { width, height } = viewportRect;
				const { viewportDimensionPercent } = constants;

				switch (inScrollDirection) {
				case "ltr":
					this._percentFunction = (dx) => (-dx / (width * viewportDimensionPercent));
					break
				case "rtl":
					this._percentFunction = (dx) => (dx / (width * viewportDimensionPercent));
					break
				case "ttb":
					this._percentFunction = (_, dy) => (-dy / (height * viewportDimensionPercent));
					break
				case "btt":
					this._percentFunction = (_, dy) => (dy / (height * viewportDimensionPercent));
					break
				}

				const scrollEvent = {
					deltaX: deltaX - this._lastScrollEvent.deltaX,
					deltaY: deltaY - this._lastScrollEvent.deltaY,
					viewportPercent: Math.min(Math.max(this._percentFunction(deltaX, deltaY), -1), 1),
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
			x: -e.velocityX * velocityFactor,
			y: -e.velocityY * velocityFactor,
		};
		const releaseDate = Date.now();
		this._autoScroll(velocity, releaseDate, e);
	}

	// Apply kinetic scrolling formula after drag end (i.e. on scroll release)
	_autoScroll(velocity, releaseDate) {
		const elapsedTime = Date.now() - releaseDate;
		let deltaX = -velocity.x * Math.exp(-elapsedTime / timeConstant);
		let deltaY = -velocity.y * Math.exp(-elapsedTime / timeConstant);

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
		if (!this._pageNavigator) {
			return
		}
		const { deltaX, deltaY, viewportPercent } = e;
		this._pageNavigator.handleScroll({ deltaX, deltaY, viewportPercent }, isWheelScroll);
	}

	// For mouse and trackpad scroll events
	_onWheelScroll(e) {
		e.preventDefault();
		requestAnimationFrame(() => {
			if (!this._pageNavigator) {
				return
			}
			if (e.ctrlKey || e.altKey) {
				const zoomData = {
					isContinuous: true,
					touchPoint: { x: e.x, y: e.y },
					delta: e.deltaY,
				};
				this._pageNavigator.zoom(zoomData);
			} else {
				// There is no end to a wheel event, so no viewportPercent information
				// can be constructed to attempt a sticky page change
				const isWheelScroll = true;
				this._scroll({ deltaX: -e.deltaX, deltaY: -e.deltaY }, isWheelScroll);
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

class Slice extends TextureElement {

	// Used in Segment
	get resource() { return this._resource }

	// Used in StoryBuilder
	get pageNavInfo() { return this._pageNavInfo }

	// Used in StateHandler
	get canPlay() { return (this._duration > 0) }

	// Used in Layer and ResourceManager
	get loadStatus() { return this._loadStatus }

	// Used in Segment (and below)
	get href() { return (this._resource) ? this._resource.href : null }

	// Used in Player
	get id() { return this._id }

	// Used below
	static get counter() {
		Slice._counter = (Slice._counter === undefined)
			? 0
			: (Slice._counter + 1);
		return Slice._counter
	}

	// Note that resource is really a SliceResource, not a (Texture)Resource
	constructor(resource = null, player, parentInfo = null, neighbor = null) {
		super(resource, player, parentInfo, neighbor);

		this._id = Slice.counter;

		this._resource = resource;

		this._type = `${(resource) ? resource.type : "untyped"}Slice`;

		// Add a dummy texture to begin with
		this._hasLoadedOnce = false;
		if (this.role === "empty") {
			this._assignEmptyTexture();
			this._loadStatus = 2;
		} else {
			this._assignDummyTexture();
			this._loadStatus = 0;
		}

		this._pageNavInfo = {};
	}

	// Used in StoryBuilder
	setPageNavInfo(type, pageNavInfo) {
		this._pageNavInfo[type] = pageNavInfo;
	}

	// Used in StoryBuilder (for transition slices) and Layer
	setParent(parent) {
		super.setParent(parent);
	}

	// Used in Layer
	getPathsToLoad() {
		if (this._loadStatus !== 0) {
			return []
		}

		const { path } = this._getRelevantPathAndMediaFragment(this._resource);

		this._loadStatus = (!path) ? 0 : 1;
		this._updateParentLoadStatus();

		return (path) ? [{ pathsArray: [path], sliceId: this._id }] : []
	}

	_getRelevantPathAndMediaFragment(resource) {
		let path = (resource) ? resource.path : null;
		let mediaFragment = (resource) ? resource.mediaFragment : null;

		const { tags = {} } = this._player; // Note that this._player actually comes from TextureElement
		if (resource && resource.alternate) {
			const { alternate } = resource;
			Object.entries(tags).forEach(([tagName, tagData]) => {
				const { array, index } = tagData;
				if (array && index < array.length) {
					const tagValue = array[index];
					if (alternate[tagName] && alternate[tagName][tagValue]) {
						path = alternate[tagName][tagValue].path;
						mediaFragment = alternate[tagName][tagValue].mediaFragment;
					}
				}
			});
		}

		return { path, mediaFragment }
	}

	_updateParentLoadStatus() {
		if (!this._parent || !this._parent.updateLoadStatus) {
			return
		}
		this._parent.updateLoadStatus();
	}

	// Once the associated texture has been created, it can be applied to the slice
	updateTextures(texture, isAFallback) {

		if (!texture) {
			this._loadStatus = 0;
			this._assignDummyTexture();

		} else if (texture !== this.texture) {
			this._loadStatus = (isAFallback === true) ? -1 : 2;

			const { video } = texture;

			// If the texture is a video
			if (video && video.duration) {
				this._video = video;

				this._setVideoTexture(texture);

				if (this._hasLoadedOnce === false) {
					this._duration = video.duration;

					// The dimensions are now correct and can be kept
					this._setSizeFromActualTexture(texture.frame.width, texture.frame.height);
					this._hasLoadedOnce = true;
				}

				this._doOnEnd = null;

				if (this._shouldPlay === true) {
					this.play();
				}

			// Otherwise the texture is a normal image or fallback image
			} else {
				this._setTexture(texture);
				if (this._hasLoadedOnce === false) {
					// The dimensions are now correct and can be kept
					this._setSizeFromActualTexture(texture.frame.width, texture.frame.height);
					this._hasLoadedOnce = true;
				}
			}
		} else { // texture === this.texture
			this._loadStatus = (isAFallback === true) ? -1 : 2;
		}

		this._updateParentLoadStatus();
	}

	// On the first successful loading of the resource's texture
	_setSizeFromActualTexture(width, height) {
		if (width === this.size.width && height === this.size.height) {
			return
		}
		this._setSize({ width, height });

		// Now only resize the page where this slice appears (if that page is indeed active)
		if (this._parent) {
			this._parent.resizePage();
		}
	}

	cancelTextureLoad() {
		this._loadStatus = 0;
		this._updateParentLoadStatus();
	}

	play() {
		this._shouldPlay = true;
		if (this._video) {
			const playPromise = this._video.play();
			if (playPromise !== undefined) {
				playPromise
					.then(() => {
						// Play
					}, () => {
						// Caught error prevents play
					});
			}
		}
	}

	// Stop a video by pausing it and returning to its first frame
	stop() {
		this._shouldPlay = false;
		if (this._video) {
			this._video.pause();
			this._video.currentTime = 0;
			this._video.loop = true;
		}
		// Since changing pages will force a stop (on reaching the normal end of a transition
		// or forcing it), now is the appropriate time to remove the "ended" event listener
		if (this._doOnEnd) {
			this._video.removeEventListener("ended", this._doOnEnd);
			this._doOnEnd = null;
		}
	}

	setDoOnEnd(doOnEnd) {
		if (!this._video) {
			return
		}
		this._video.loop = false;
		this._doOnEnd = doOnEnd.bind(this);
		this._video.addEventListener("ended", this._doOnEnd);
	}

	resize(sequenceFit) {
		if (sequenceFit) {
			const sequenceClipped = true;
			super.resize(sequenceFit, sequenceClipped);
			return
		}

		const { pageNavigator } = this._player;

		const fit = pageNavigator.metadata.forcedFit || this._resource.fit || pageNavigator.metadata.fit;

		let clipped = false;
		if (pageNavigator.metadata.forcedClipped === true
			|| pageNavigator.metadata.forcedClipped === false) {
			clipped = pageNavigator.metadata.forcedClipped;
		} else if (this._resource.clipped === true || this._resource.clipped === false) {
			clipped = this._resource.clipped;
		} else {
			clipped = pageNavigator.metadata.clipped;
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

	destroyTexturesIfPossible() {
		const pathsArray = this.unlinkTexturesAndGetPaths();

		this._updateParentLoadStatus();

		if (!pathsArray) {
			return
		}
		pathsArray.forEach((path) => {
			this.resourceManager.notifyTextureRemovalFromSlice(path);
		});
	}

	// Used above and in Player
	unlinkTexturesAndGetPaths() {
		if (this._loadStatus === 0 || this.role === "empty") {
			return []
		}

		this._loadStatus = 0;
		// Note that we don't add this._setTexture(null): we're actually keeping the texture

		const { path } = this._getRelevantPathAndMediaFragment(this._resource);
		return (path) ? [path] : []
	}

	// Used in Layer, ultimately linked to PageNavigator's getFirstHrefInCurrentPage
	getFirstHref() {
		return this.href
	}

	// Called by Player on final destroy
	destroy() {
		// Clear textures
		super.destroy();

		// Remove event listeners
		if (this._video) {
			if (this._doOnEnd) {
				this._video.removeEventListener("ended", this._doOnEnd);
				this._doOnEnd = null;
			}
			this._video = null;
		}
	}

	// Used in StoryBuilder
	static createEmptySlice(player, neighbor) {
		const resource = { role: "empty" };
		const parentInfo = null;
		const slice = new Slice(resource, player, parentInfo, neighbor);
		return slice
	}

}

class SequenceSlice extends Slice {

	// Used below and in Player
	get resourcesArray() {
		const { resourcesArray } = this._resourcesInfo || {};
		return resourcesArray || []
	}

	// Used in StateHandler
	get canPlay() { return (this._duration > 0 && this._texturesArray.length > 0) }

	constructor(resourcesInfo, player) {
		super(resourcesInfo, player);

		this._resourcesInfo = resourcesInfo;
		const { duration } = resourcesInfo;
		this._duration = (isANumber(duration) === true && duration > 0) ? duration : 0;

		this._type = "sequenceSlice";

		this._hasLoadedOnce = false;
		this._texturesArray = [];
		this._nbOfFrames = 0;
		this._nbOfLoadedFrameTextures = 0;
	}

	getPathsToLoad() {
		if (this._loadStatus === 1 || this._loadStatus === 2) {
			return []
		}

		const pathsArray = [];
		this.resourcesArray.forEach((resource) => {
			const { path } = this._getRelevantPathAndMediaFragment(resource);
			if (path) {
				pathsArray.push(path);
			}
		});

		this._loadStatus = 1;

		return [{ pathsArray, sliceId: this._id }]
	}

	updateTextures() {
		if (!this._duration) {
			return
		}

		this._texturesArray = this._createTexturesArray();
		if (this._texturesArray.length === 0) {
			this._loadStatus = 0;
			return
		}

		if (this._texturesArray.length < this.resourcesArray.length) {
			this._loadStatus = -1;
		}

		this._loadStatus = 2;
		this.setTexturesArray(this._texturesArray);
	}

	_createTexturesArray() {
		let texturesArray = [];

		if (this.resourcesArray.length > 0) {

			// Build texturesList
			const texturesList = [];
			this.resourcesArray.forEach((resource) => {
				const texture = this._getLoadedTexture(resource);

				if (texture) {
					// Get natural dimensions from the first valid texture in the list
					if (this._hasLoadedOnce === false) {
						this._setSizeFromActualTexture(texture.frame.width, texture.frame.height);
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
				const time = this._duration / texturesList.length;
				texturesArray = texturesList.map((texture) => ({ texture, time }));
			}

		}
		return texturesArray
	}

	// The associated texture can either come from an image or fallback image
	_getLoadedTexture(resource) {
		if (!resource || !this.resourceManager) {
			return null
		}
		const { path, mediaFragment } = this._getRelevantPathAndMediaFragment(resource);
		const texture = this.resourceManager.getTextureWithPath(path, mediaFragment);
		return texture
	}

	play() {
		if (!this._playableSprite) {
			return
		}
		this._playableSprite.gotoAndPlay(0);
	}

	stop() {
		if (!this._playableSprite) {
			return
		}
		this._playableSprite.gotoAndStop(0);
	}

	pauseAtPercent(percent) {
		if (!this._playableSprite || this._nbOfFrames < 1) {
			return
		}
		const frameIndex = Math.min(Math.floor(percent * this._nbOfFrames), this._nbOfFrames - 1);
		this._playableSprite.gotoAndStop(frameIndex);
	}

	resize() {
		const { pageNavigator } = this._player;
		const fit = pageNavigator.metadata.forcedFit || this._resourcesInfo.fit
			|| pageNavigator.metadata.fit;
		super.resize(fit);
	}

	destroyTexturesIfPossible() {
		const pathsArray = this.unlinkTexturesAndGetPaths();
		this.setTexturesArray(null);

		if (this._parent && this._parent.updateLoadStatus) {
			this._parent.updateLoadStatus();
		}

		pathsArray.forEach((path) => {
			this.resourceManager.notifyTextureRemovalFromSlice(path);
		});
	}

	// Used above and in Player
	unlinkTexturesAndGetPaths() {
		if (this._loadStatus === 0) {
			return []
		}

		this._loadStatus = 0;

		const pathsArray = [];
		this.resourcesArray.forEach((resource) => {
			const { path } = this._getRelevantPathAndMediaFragment(resource);
			if (path) {
				pathsArray.push(path);
			}
		});
		return pathsArray
	}

}

class SliceResource {

	get role() { return this._role }

	get fit() { return this._fit }

	get clipped() { return this._clipped }

	get pageSide() { return this._pageSide }

	get type() { return this._type }

	get href() { return this._href }

	get path() { return this._path }

	get mediaFragment() { return this._mediaFragment }

	get width() { return this._width }

	get height() { return this._height }

	// Note that fallback and each alternate[tag] objects will have
	// the same structure = { type, path, mediaFragment, href }

	get fallback() { return this._fallback }

	get alternate() { return this._alternate }

	// Used in Player to list a story's tags
	get usedTags() {
		const tags = {};
		Object.entries(this._alternate || {}).forEach(([tagName, tagData]) => {
			tags[tagName] = Object.keys(tagData);
		});
		return tags
	}

	constructor(object, role, fit, clipped = true, pageSide = null) {
		this._role = role;
		this._fit = fit;
		this._clipped = clipped;
		this._pageSide = pageSide;

		const {
			href,
			type,
			width,
			height,
			fallbackHref,
			alternate,
		} = object || {};

		this._type = type;
		this._href = href;
		this._width = width;
		this._height = height;

		// If no href is specified, at least dimensions have already been stored
		// to allow for correctly-sized dummy slices (i.e. slices with dummy textures)
		if (!href) {
			return
		}

		const { path, mediaFragment } = getPathAndMediaFragment(href);
		this._path = path;
		this._mediaFragment = mediaFragment;

		let resourceType = null;
		// To assign a general resourceType, first check the specified value for type
		if (type) {
			const generalType = type.split("/")[0];
			if (generalType === "image" || generalType === "video") {
				resourceType = generalType;
			}
		}
		// If the specified value did not provide a relevant resourceType, check the path's extension
		if (!resourceType) {
			resourceType = (isAVideo(path) === true) ? "video" : "image";
			/*// Other possibility (to allow the image resourceType on allowed extensions only)
			if (isAVideo(path) === true) {
				resourceType = "video"
			} else if (isAnImage(path) === true) {
				resourceType = "image"
			} else {
				return
			}*/
		}
		// Note that the "image" resourceType is thus favored (by default)

		this._type = resourceType;

		if (fallbackHref) {
			const fallbackInfo = getPathAndMediaFragment(fallbackHref);
			this._fallback = {
				...fallbackInfo,
				href: fallbackHref,
			};
		}

		this._alternate = null;
		if (alternate) {
			alternate.forEach((alternateObject) => {
				if (alternateObject.href) {
					possibleTagNames.forEach((possibleTagName) => {
						const tagValue = alternateObject[possibleTagName];
						if (tagValue !== undefined) { // Assumption: same type and dimensions
							if (!this._alternate) {
								this._alternate = {};
							}
							if (!this._alternate[possibleTagName]) {
								this._alternate[possibleTagName] = {};
							}
							const alternateInfo = getPathAndMediaFragment(alternateObject.href);
							this._alternate[possibleTagName][tagValue] = {
								...alternateInfo,
								type: resourceType,
								href: alternateObject.href,
							};
						}
					});
				}
			});
		}
	}

}

class Transition {

	get type() { return this._type }

	get controlled() { return this._controlled }

	get duration() { return this._duration }

	get direction() { return this._direction }

	get sliceType() { return this._sliceType }

	get slice() { return this._slice }

	constructor(transition, player) {
		const {
			type, controlled, duration, direction, file, sequence,
		} = transition || {};

		this._type = type;
		this._controlled = controlled;
		this._duration = duration;

		this._direction = direction;
		this._sliceType = null;
		this._slice = null;

		if (type === "animation") {

			if (file) {
				this._sliceType = "video";

				const fullObject = {
					...file,
					type: "video",
				};
				const parentInfo = null;
				const forcedRole = "transition";
				this._linkObject = new LinkObject(fullObject, parentInfo, player, forcedRole);
				const { slice } = this._linkObject;
				this._slice = slice;

			} else if (sequence) {
				this._sliceType = "sequence";

				const role = "transition";

				const resourcesArray = [];
				let fit = null;
				sequence.forEach((object, i) => {
					if (i === 0 && object.properties && object.properties.fit) {
						fit = object.properties.fit;
					}
					const fullObject = {
						...object,
						type: "image",
					};
					const sliceResource = new SliceResource(fullObject, role, fit);
					resourcesArray.push(sliceResource);
				});

				const resourcesInfo = {
					role,
					resourcesArray,
					fit,
					duration,
				};
				this._slice = new SequenceSlice(resourcesInfo, player);

				this._duration = duration || defaultDuration;
			}
		}
	}

	// Used in StoryBuilder to split each page transition into two layer transitions
	getEntryAndExitTransitions(isForward) {
		let entry = {
			type: this._type,
			controlled: this._controlled,
			duration: this._duration, // Duration may remain undefined
			isDiscontinuous: true,
		};
		let exit = {
			type: this._type,
			controlled: this._controlled,
			duration: this._duration, // Duration may remain undefined
			isDiscontinuous: true,
		};

		switch (this._type) {
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
			entry.direction = this._direction;
			exit.type = "show";
			break
		case "slide-out":
			entry.type = "show";
			exit.direction = this._direction;
			break
		case "push":
			entry.type = "slide-in";
			entry.direction = this._direction;
			exit.type = "slide-out";
			exit.direction = this._direction;
			break
		case "animation":
			entry.sliceType = this._sliceType;
			entry.slice = this._slice;
			exit.type = "hide";
			exit.duration = 0;
			break
		}

		return { entry, exit }
	}

}

class LinkObject {

	get slice() { return this._slice }

	get transitionForward() { return this._transitionForward }

	get transitionBackward() { return this._transitionBackward }

	get snapPoints() { return this._snapPoints }

	get children() { return this._children }

	constructor(object, parentInfo, player, forcedRole = null) {
		this._slice = null;

		// For transitions (will eventually be stored at page level)
		this._transitionForward = null;
		this._transitionBackward = null;

		// For link object layers (will eventually result in the creation of a segment with states)
		this._children = [];

		// For snap points (will eventually be stored at page level)
		this._snapPoints = [];

		// Now build slice, children (and their slices) and transitions (and their slices) as required
		this._buildSlicesAndTransitions(object, parentInfo, player, forcedRole);
	}

	_buildSlicesAndTransitions(object, parentInfo = null, player, forcedRole = null) {
		const { properties } = object || {};
		const {
			fit,
			clipped,
			page,
			layers,
			transitionForward,
			transitionBackward,
			snapPoints,
		} = properties || {};

		let sliceFit = null;
		if (fit === "contain" || fit === "cover" || fit === "width" || fit === "height") {
			sliceFit = fit;
		} else if (parentInfo) { // If a layer slice
			sliceFit = "pixel";
		}

		const sliceClipped = (clipped === true || clipped === false)
			? clipped
			: null;

		const pageSide = (page === "left" || page === "right" || page === "center")
			? page
			: null;

		let role = forcedRole || "standard";
		if (parentInfo) {
			role = "layersLayer";
		} else if (layers) {
			role = "layersParent";
		}

		const sliceResource = new SliceResource(object, role, sliceFit, sliceClipped, pageSide);

		this._slice = new Slice(sliceResource, player, parentInfo);

		if (!parentInfo && layers) { // No need to consider layers for a child link object

			this._children = layers.map((layerObject, i) => {
				const layerProperties = layerObject.properties || {};
				let {
					entryForward, exitBackward,
				} = layerProperties;
				const {
					exitForward, entryBackward,
				} = layerProperties;
				// Create a new link object, using this link object's slice as the parent slice
				const parentInformation = {
					slice: this._slice,
					layerIndex: i,
				};
				const linkObject = new LinkObject(layerObject, parentInformation, player);

				// Transitions shall take precedence over entry and exits
				if (layerProperties.transitionForward) {
					const transition = new Transition(layerProperties.transitionForward, player);
					const isForward = true;
					const { entry } = transition.getEntryAndExitTransitions(isForward);
					entryForward = entry;
				}
				if (layerProperties.transitionBackward) {
					const transition = new Transition(layerProperties.transitionBackward, player);
					const isForward = false;
					const { exit } = transition.getEntryAndExitTransitions(isForward);
					exitBackward = exit;
				}

				return {
					linkObject, entryForward, exitForward, entryBackward, exitBackward,
				}
			});
		}

		// Store more detailed transition information
		if (transitionForward) {
			this._transitionForward = new Transition(transitionForward, player);
		}
		if (transitionBackward) {
			this._transitionBackward = new Transition(transitionBackward, player);
		}

		// Store snap points
		this._snapPoints = snapPoints;
	}

}

class DivinaParser {

	constructor(player, textManager, doWithParsedDivinaData) {
		this._player = player;
		this._textManager = textManager;
		this._doWithParsedDivinaData = doWithParsedDivinaData;
	}

	loadFromPath(path, pathType) {
		DivinaParser.loadJson(path, pathType)
			.then((json) => {
				this._buildStoryFromJson(json);
			}, (error) => {
				if (this._textManager) {
					this._textManager.showMessage({
						type: "error", data: error.message,
					});
				}
			});
	}

	static loadJson(path, pathType) {
		return new Promise((resolve, reject) => {
			if (!path) {
				reject(Error("No path was specified"));
			}
			const xhr = new XMLHttpRequest();
			const manifestPath = (pathType === "manifest") // Otherwise pathType should be = "folder"
				? path
				: `${path}/${defaultManifestFilename}`;
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
		if (json) {
			this._buildStoryFromJson(json);
		} else if (this._textManager) {
			this._textManager.showMessage({
				type: "error", data: "No json was passed",
			});
		}
	}

	_buildStoryFromJson(json) {
		if (!json) {
			if (this._textManager) {
				this._textManager.showMessage({
					type: "error", data: "Manifest is null",
				});
			}
			return
		}

		const {
			metadata, links, readingOrder, guided,
		} = json;
		if (!metadata || !readingOrder) {
			if (this._textManager) {
				this._textManager.showMessage({
					type: "error", data: "Missing metadata or readingOrder information",
				});
			}
			return
		}

		let updatedFolderPath = null;
		if (links && links.length > 0) {
			links.forEach((link) => {
				const { rel, href } = link;
				if (rel === "self" && href && hasAScheme(href) === true) {
					updatedFolderPath = getFolderPathFromManifestPath(href);
				}
			});
		}

		const parsedMetadata = DivinaParser._parseMetadata(metadata);
		if (!parsedMetadata) {
			return
		}

		const parsedDivinaData = {
			metadata: parsedMetadata,
			mainLinkObjectsArray: this._parseObjectsList(readingOrder),
		};

		if (guided) {
			parsedDivinaData.guidedLinkObjectsArray = this._parseObjectsList(guided);
		}

		if (!this._doWithParsedDivinaData) {
			return
		}
		this._doWithParsedDivinaData(parsedDivinaData, updatedFolderPath);
	}

	static _parseMetadata(metadata) {
		const {
			readingProgression,
			language,
			presentation,
		} = metadata;

		const storyReadingProgression = (readingProgression === "ltr" || readingProgression === "rtl"
			|| readingProgression === "ttb" || readingProgression === "btt")
			? readingProgression
			: defaultReadingProgression;

		const {
			continuous,
			fit,
			overflow,
			clipped,
			spread,
			viewportRatio,
			// orientation,
		} = presentation || {};

		const storyContinuous = (continuous === true || continuous === false)
			? continuous
			: defaultContinuous;
		const storyFit = (fit === "contain" || fit === "cover" || fit === "width" || fit === "height")
			? fit
			: defaultFit;
		const storyOverflow = (overflow === "scrolled" || overflow === "paginated")
			? overflow
			: defaultOverflow;
		const storyClipped = (clipped === true || clipped === false)
			? clipped
			: defaultClipped;
		const storySpread = (spread === "both" || spread === "landscape" || spread === "none")
			? spread
			: defaultSpread;

		let languagesArray = [];
		if (language) {
			languagesArray = (Array.isArray(language) === true)
				? language
				: [language];
		} else {
			languagesArray = ["unspecified"];
		}

		return {
			readingProgression: storyReadingProgression,
			continuous: storyContinuous,
			fit: storyFit,
			overflow: storyOverflow,
			clipped: storyClipped,
			spread: storySpread,
			viewportRatio,
			languagesArray,
		}
	}

	_parseObjectsList(objectsList) {
		const parentLinkObject = null;
		const linkObjectsArray = objectsList.map((object) => (
			new LinkObject(object, parentLinkObject, this._player)
		));
		return linkObjectsArray
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

	run(callback) {
		this._isRunning = true;

		const fullCallback = () => {
			if (this._doOnEnd) {
				this._doOnEnd();
			}
			this._isRunning = false;
			if (callback) {
				callback();
			}
		};

		if (this._doAsync) {
			this._doAsync()
				.then(fullCallback);
		} else {
			fullCallback();
		}
	}

	kill() {
		if (this._isRunning === true && this._doOnKill) {
			this._doOnKill();
		}
		this._isRunning = false;
	}

}

class TextureResource {

	get id() { return this._id }

	get type() { return this._type }

	get fallback() { return this._fallback }

	get href() { return this._href }

	get hasStartedLoading() { return (this._loadStatus !== 0) }

	get hasLoaded() { return (this._loadStatus === -1 || this._loadStatus === 2) }

	static get counter() {
		TextureResource._counter = (TextureResource._counter === undefined)
			? 0
			: (TextureResource._counter + 1);
		return TextureResource._counter
	}

	constructor(textureInfo, sliceId) {
		this._id = TextureResource.counter;

		const {
			type, path, href, fallback,
		} = textureInfo;

		this._type = type;
		this._path = path;
		this._href = href;
		this._fallback = fallback;

		this._video = null;
		this._timeout = null;
		this._doOnLoadSuccess = null;
		this._doOnLoadFail = null;

		this._loadStatus = 0;
		this._baseTexture = null;
		this._textures = {};

		this._addOrUpdateMediaFragment("full");
		this.addTextureInfo(textureInfo, sliceId);
	}

	_addOrUpdateMediaFragment(mediaFragment, sliceId) {
		if (!this._textures[mediaFragment]) {
			this._textures[mediaFragment] = {
				texture: null,
				sliceIdsSet: new Set(),
			};
		}
		// On a readingMode change, the baseTexture may already be present,
		// so adding new media fragments imply that the corresponding textures be created
		if (this._baseTexture && this._textures.full && this._textures.full.texture) {
			const fullTexture = this._textures.full.texture;
			const croppedTexture = Texture.cropToFragment(fullTexture, mediaFragment);
			this._textures[mediaFragment].texture = croppedTexture;
		}
		if (sliceId !== undefined) {
			this._textures[mediaFragment].sliceIdsSet.add(sliceId);
		}
	}

	// Also used in ResourceManager
	addTextureInfo(textureInfo, sliceId) {
		const { mediaFragment } = textureInfo;
		if (mediaFragment) {
			this._addOrUpdateMediaFragment(mediaFragment, sliceId);
		} else {
			this._addOrUpdateMediaFragment("full", sliceId);
		}
	}

	resetSliceIdsSets() {
		Object.keys(this._textures).forEach((mediaFragment) => {
			this._textures[mediaFragment].sliceIdsSet = new Set();
		});
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
			clearTimeout(this._timeout);
			this._removeTracesOfVideoLoad();
			this._video = null;

			if (this._fallback && doOnVideoLoadFail) {
				this._loadStatus = -1;
				// Let's create the baseTexture from the fallback image
				// (we don't care that the type will thus not be the right one anymore)
				doOnVideoLoadFail(this._path, this._fallback.path);
			} else {
				this._loadStatus = 0;
				resolve();
			}
		};
		this._doOnLoadFail = doOnLoadFail;
		video.addEventListener("error", doOnLoadFail);

		// Event to track should be loadedmetadata, but duration change proved more reliable
		const doOnLoadSuccess = () => {
			this._doOnDurationChange(doOnVideoLoadSuccess);
		};
		this._doOnLoadSuccess = doOnLoadSuccess;
		video.addEventListener("durationchange", doOnLoadSuccess);

		// If resources are loaded serially, a failing video load should not block loading
		if (allowsParallel === false) {
			this._timeout = setTimeout(doOnLoadFail, videoLoadTimeout);
		}
	}

	_removeTracesOfVideoLoad() {
		if (!this._video) {
			return
		}
		if (this._doOnLoadFail) {
			this._video.removeEventListener("error", this._doOnLoadFail);
			this._doOnLoadFail = null;
		}
		if (this._doOnLoadSuccess) {
			this._video.removeEventListener("durationchange", this._doOnLoadSuccess);
			this._doOnLoadSuccess = null;
		}
	}

	// Once a video's duration is different from zero, get useful information
	_doOnDurationChange(doOnVideoLoadSuccess) {
		clearTimeout(this._timeout);

		const { duration } = this._video;

		if (duration && doOnVideoLoadSuccess) {
			const texture = Texture.createVideoTexture(this._video);

			this._removeTracesOfVideoLoad();

			const textureData = {
				name: this._path,
				baseTexture: texture.baseTexture,
				texture,
			};
			doOnVideoLoadSuccess(textureData);

		// If the video failed loading
		} else if (this._doOnLoadFail) {
			this._doOnLoadFail(); // Which involves removing the event listener too
		}
	}

	notifyLoadStart() {
		if (this._loadStatus === 0) {
			this._loadStatus = 1; // Means that loader has started loading the resource
		}
	}

	cancelLoad(slices) {
		this._loadStatus = 0;
		Object.values(this._textures).forEach(({ sliceIdsSet }) => {
			sliceIdsSet.forEach((sliceId) => {
				const slice = slices[sliceId];
				slice.cancelTextureLoad();
			});
		});

		this.clearVideoTraces();
	}

	clearVideoTraces() {
		if (this._video) {
			if (this._doOnLoadFail) {
				this._video.removeEventListener("error", this._doOnLoadFail);
				this._doOnLoadFail = null;
			}
			if (this._doOnLoadSuccess) {
				this._video.removeEventListener("durationchange", this._doOnLoadSuccess);
				this._doOnLoadSuccess = null;
			}
			this._video = null;
		}
	}

	setBaseTexture(baseTexture, fullTexture) {
		if (this._baseTexture || !baseTexture || !fullTexture) {
			return
		}
		this._baseTexture = baseTexture;

		// For the texture, store the (clipped) media fragment texture directly if it is a fallback
		if (this._loadStatus === -1 && this._fallback && this._fallback.mediaFragment) {
			const croppedTexture = Texture.cropToFragment(fullTexture, this._fallback.mediaFragment);

			this._textures.full.texture = croppedTexture;

		// Otherwise just store the texture as the full texture
		// (reminder: this._loadStatus = 1 or -1 - if no fallback - at this stage)...
		} else {
			this._textures.full.texture = fullTexture;
			// ...and create other fragments as needed
			this._createFragmentsIfNeeded(fullTexture);
			if (this._loadStatus !== -1) {
				this._loadStatus = 2;
			}
		}
	}

	_createFragmentsIfNeeded(fullTexture) {
		Object.keys(this._textures).forEach((mediaFragment) => {
			if (mediaFragment !== "full") {
				const croppedTexture = Texture.cropToFragment(fullTexture, mediaFragment);
				this._textures[mediaFragment].texture = croppedTexture;
			}
		});
	}

	applyAllTextures(slices) {
		const fullTexture = this._textures.full.texture;
		Object.values(this._textures).forEach(({ texture, sliceIdsSet }) => {
			sliceIdsSet.forEach((sliceId) => {
				const slice = slices[sliceId];
				if (slice) {
					const sliceTexture = (this._loadStatus === -1) ? fullTexture : texture;
					const isAFallback = (this._loadStatus === -1);
					slice.updateTextures(sliceTexture, isAFallback);
				}
			});
		});
	}

	// Used for a SequenceSlice only
	getTextureForMediaFragment(mediaFragment = null) {
		const fragment = (this._loadStatus === -1)
			? "full" // The full texture for a fallback is already sized correctly
			: (mediaFragment || "full");
		if (!this._textures[fragment]) {
			return null
		}
		const { texture } = this._textures[fragment];
		return texture
	}

	destroyTexturesIfPossible(slices) {
		let shouldBeKept = false;
		Object.values(this._textures).forEach((mediaFragmentData) => {
			const { sliceIdsSet } = mediaFragmentData;
			sliceIdsSet.forEach((sliceId) => {
				const slice = slices[sliceId];
				if (slice) {
					const { loadStatus } = slice;
					if (loadStatus === -1 || loadStatus === 1 || loadStatus === 2) {
						shouldBeKept = true;
					}
				}
			});
		});
		if (shouldBeKept === false) {
			this.forceDestroyTextures();
		}
	}

	forceDestroyTextures() {
		if (this._loadStatus === 0) {
			return
		}

		Object.keys(this._textures).forEach((mediaFragment) => {
			this._textures[mediaFragment].texture = null;
		});
		if (this._baseTexture) {
			this._baseTexture.destroy();
		}
		this._baseTexture = null;

		this.clearVideoTraces();

		this._loadStatus = 0;
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

		this._nbOfInitialTasks = 0;
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

		const callback = () => {
			// Remove task from list
			const { id } = task;
			const index = this._tasksArray.findIndex((arrayTask) => (arrayTask.id === id));
			this._tasksArray.splice(index, 1);

			if (this._doAfterEachInitialTask) {
				this._doAfterEachInitialTask();
				this._nbOfInitialTasks -= 1;
				if (this._nbOfInitialTasks === 0) {
					this._doAfterEachInitialTask = null;
				}
			}

			if (this._allowsParallel === false) {
				this._isRunning = false;
				this._runNextTaskInQueue();
			}
		};
		task.run(callback);
	}

	_runNextTaskInQueue() { // In serial mode only
		if (this._tasksArray.length === 0 || this._isRunning === true) {
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

	start(doAfterEachInitialTask) {
		this._doAfterEachInitialTask = doAfterEachInitialTask;

		this._nbOfInitialTasks = this._tasksArray.length;
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

	constructor(maxPriority, priorityFactor, allowsParallel) {

		// Task priorities will be evaluated based on page differences
		const getPriorityFromTaskData = (data) => {
			let priority = 0;
			if (!data || data.pageIndex === null || this._targetPageIndex === null) {
				return priority
			}
			const taskPageIndex = data.pageIndex;
			priority = taskPageIndex - this._targetPageIndex;
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

		this._targetPageIndex = null;
	}

	updatePriorities(targetPageIndex) {
		this._targetPageIndex = targetPageIndex;
		super.updatePriorities();
	}

}

class ResourceManager {

	get resourceTextures() { return this._textureResources }

	constructor(doWithLoadPercentChange, textureSource, player) {
		this._doWithLoadPercentChange = doWithLoadPercentChange;
		this._textureSource = textureSource;
		this._player = player;

		const { options } = player;
		const {
			allowsParallel = defaultAllowsParallel,
			videoLoadTimeout = defaultVideoLoadTimeout,
		} = options || {};

		this._allowsParallel = allowsParallel;
		this._videoLoadTimeout = videoLoadTimeout;

		this._textureResources = {};

		this._taskQueue = null;
		this._nbOfCompletedTasks = 0;

		if (this._doWithLoadPercentChange) {
			this._doWithLoadPercentChange(0);
		}
	}

	// Used in Player
	storeResourceInfo(resource = null, sliceId) {
		if (!resource || sliceId === undefined) {
			return
		}

		this._storeTextureInfo(resource, sliceId);

		const { alternate } = resource;
		if (alternate) {
			Object.keys(alternate).forEach((tagName) => {
				Object.keys(alternate[tagName] || {}).forEach((tagValue) => {
					this._storeTextureInfo(alternate[tagName][tagValue], sliceId);
				});
			});
		}
	}

	_storeTextureInfo(textureInfo = null, sliceId) {
		const { path } = textureInfo || {};
		if (!path) {
			return
		}
		if (!this._textureResources[path]) {
			this._textureResources[path] = new TextureResource(textureInfo, sliceId);
		} else {
			this._textureResources[path].addTextureInfo(textureInfo, sliceId);
		}
	}

	// When setting (including changing) the page navigator (used in Player)
	reset(maxPriority, priorityFactor) {
		// Build async task queue if there is none...
		if (!this._taskQueue) {
			this._taskQueue = new ResourceLoadTaskQueue(maxPriority, priorityFactor,
				this._allowsParallel);
		// ...or stop all loading tasks otherwise
		} else {
			this._taskQueue.reset();
			this._nbOfCompletedTasks = 0;
		}

		// Clear sliceIdsSets so they can be populated again for the considered reading mode
		Object.values(this._textureResources).forEach((textureResource) => {
			textureResource.resetSliceIdsSets();
		});
	}

	updateForTargetPageIndex(targetPageIndex) {
		// Update priorities for load tasks (if some tasks are still pending)
		this._taskQueue.updatePriorities(targetPageIndex);
	}

	// Used in Slice
	loadTexturesAtPaths(pathsArray, sliceId, pageIndex) {
		let taskId = null;

		const pathsToLoadArray = [];
		pathsArray.forEach((path) => {
			if (path && this._textureResources[path]) {
				const textureResource = this._textureResources[path];
				const { id, hasStartedLoading } = textureResource;
				if (hasStartedLoading === false) {
					if (taskId === null) {
						taskId = String(id);
					} else {
						taskId += String(id);
					}
					pathsToLoadArray.push(path);
				}
			}
		});

		const callback = () => {
			const { slices } = this._player;
			pathsArray.forEach((path) => {
				const textureResource = this._textureResources[path];
				if (textureResource) {
					textureResource.applyAllTextures(slices);
				}
			});
		};
		// Note that callback will ensure slice.loadStatus = 2 (or -1),
		// which will prevent re-triggering loadTexturesAtPaths for the slice

		if (pathsToLoadArray.length === 0) {
			callback();
			return
		}

		// If is already loading, still consider if priority order > that of when started loading

		let task = this._taskQueue.getTaskWithId(taskId);
		const data = { pageIndex };

		// Add resource load task to queue if not already in queue
		if (!task) {
			const loader = new Loader();
			const doAsync = () => this._loadResources(pathsToLoadArray, pageIndex, loader);
			const doOnEnd = callback;
			const doOnKill = () => {
				// Cancel loading for resources not loaded yet (and thus change their load status)
				const { slices } = this._player;
				pathsToLoadArray.forEach((path) => {
					if (path && this._textureResources[path]) {
						const textureResource = this._textureResources[path];
						if (textureResource.hasLoaded === false) {
							textureResource.cancelLoad(slices);
						}
					}
				});
				loader.reset();
			};
			task = new Task(taskId, data, doAsync, doOnEnd, doOnKill);
			this._taskQueue.addTask(task);

		// In serial mode, if task exists, update data to potentially update its priority
		} else if (this._allowsParallel === false) {
			this._taskQueue.updateTaskWithData(data);
		}
	}

	_loadResources(pathsToLoadArray, pageIndex, loader) {
		pathsToLoadArray.forEach((path) => {
			if (path && this._textureResources[path]) {
				const textureResource = this._textureResources[path];
				textureResource.notifyLoadStart();
			}
		});
		return new Promise((resolve) => {
			this._addResourcesToLoaderAndLoad(pathsToLoadArray, loader, resolve);
		})
	}

	_addResourcesToLoaderAndLoad(pathsToLoadArray, loader, resolve) {
		const firstPath = pathsToLoadArray[0];
		const firstTextureResource = this._textureResources[firstPath];

		if (pathsToLoadArray.length === 1 && firstTextureResource
			&& firstTextureResource.type === "video") { // Only consider a video if it is alone

			const src = this._getSrc(firstPath);
			const doOnVideoLoadSuccess = (textureData) => {
				this._acknowledgeResourceHandling([textureData], resolve);
			};
			const doOnVideoLoadFail = (path, fallbackPath) => {
				this._addToLoaderAndLoad([{ path, fallbackPath }], loader, resolve);
			};
			firstTextureResource.attemptToLoadVideo(src, doOnVideoLoadSuccess, doOnVideoLoadFail,
				this._videoLoadTimeout, this._allowsParallel, resolve);

		} else {
			const pathsAndFallbackPathsArray = [];
			pathsToLoadArray.forEach((path) => {
				if (path && this._textureResources[path]) {
					const { type } = this._textureResources[path];
					// Reminder: a sequence transition forces its resourcesArray
					// to only contain image types anyway
					if (type === "image") {
						pathsAndFallbackPathsArray.push({ path });
					}
				}
			});
			this._addToLoaderAndLoad(pathsAndFallbackPathsArray, loader, resolve);
		}
	}

	_getSrc(path, fallbackPath = null) {
		let src = fallbackPath || path;

		const { folderPath, data } = this._textureSource;

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

	_addToLoaderAndLoad(pathsAndFallbackPathsArray, loader, resolve) {
		pathsAndFallbackPathsArray.forEach(({ path, fallbackPath }) => {
			this._addToLoader(loader, path, fallbackPath);
		});
		this._load(loader, resolve);
	}

	_addToLoader(loader, path, fallbackPath = null) {
		const src = this._getSrc(path, fallbackPath);
		loader.add(path, src);
	}

	_load(loader, resolve) {
		if (loader.hasTasks === true) {
			loader.load();
			// If loading succeeds, move on
			loader.onComplete((textureDataArray) => {
				this._acknowledgeResourceHandling(textureDataArray, resolve);
			});
		} else {
			this._acknowledgeResourceHandling(null, resolve);
		}
	}

	_acknowledgeResourceHandling(textureDataArray, resolve) {
		if (textureDataArray) {
			textureDataArray.forEach((textureData) => {
				const { name, baseTexture, texture } = textureData || {};
				// Store the baseTexture (and compute clipped textures for media fragments as needed),
				// knowing that name = path
				if (name && this._textureResources[name]) {
					const textureResource = this._textureResources[name];
					textureResource.setBaseTexture(baseTexture, texture);
				}
			});
		}
		resolve();
	}

	// Used in Player
	addStoryOpenTaskAndLoad(doOnLoadEnd, maxPriority) {
		// Add a last task to trigger doOnLoadEnd
		const id = -1;
		const data = null;
		const doAsync = null;
		const doOnEnd = doOnLoadEnd;
		const doOnKill = null;
		const forcedPriority = maxPriority;
		const task = new Task(id, data, doAsync, doOnEnd, doOnKill, forcedPriority);
		this._taskQueue.addTask(task);

		// Start the async queue with a function to handle a change in load percent
		this._nbOfCompletedTasks = 0;
		const { nbOfTasks } = this._taskQueue;
		const doAfterEachInitialTask = () => {
			this._nbOfCompletedTasks += 1;
			const percent = (nbOfTasks > 0) ? (this._nbOfCompletedTasks / nbOfTasks) : 1;
			const loadPercent = Math.round(100 * percent);
			if (this._doWithLoadPercentChange) {
				this._doWithLoadPercentChange(loadPercent);
			}
		};
		this._taskQueue.start(doAfterEachInitialTask);
	}

	// Used in SequenceSlice
	getTextureWithPath(path, mediaFragment = null) {
		if (!path || !this._textureResources || !this._textureResources[path]) {
			return null
		}
		const textureResource = this._textureResources[path];
		const texture = textureResource.getTextureForMediaFragment(mediaFragment);
		return texture
	}

	// Used in Slice (and SequenceSlice)
	notifyTextureRemovalFromSlice(path) {
		const { slices } = this._player;
		if (path && this._textureResources[path]) {
			const textureResource = this._textureResources[path];
			textureResource.destroyTexturesIfPossible(slices);
		}
	}

	// Used in PageNavigator
	forceDestroyTexturesForPath(path) {
		if (!path || !this._textureResources[path]) {
			return
		}
		const textureResource = this._textureResources[path];
		textureResource.forceDestroyTextures();
	}

	killPendingLoads() {
		this._taskQueue.reset();
		// Note that killing all tasks will call their respective textureResource.cancelLoad()
		this._nbOfCompletedTasks = 0;
	}

	destroy() {
		this.killPendingLoads();
		Object.values(this._textureResources).forEach((textureResource) => {
			textureResource.forceDestroyTextures();
		});
		this._textureResources = null;
	}

}

class LayerTransition {

	get controlled() { return this._controlled }

	get slice() { return this._slice }

	get isRunning() { return this._isRunning }

	constructor(handler, layer, isExiting, entryOrExit) {
		this._handler = handler;
		this._layer = layer;
		this._isExiting = isExiting;
		this._type = "cut";
		this._controlled = false;

		this._startTime = null;
		this._isRunning = true;

		const {
			type, duration, direction, sliceType, slice, controlled,
		} = entryOrExit || {};

		if (!entryOrExit
			|| !(type === "show" || type === "hide" || type === "fade-in" || type === "fade-out"
				|| type === "slide-in" || type === "slide-out" || type === "animation")) {
			return
		}
		this._type = type;
		this._controlled = controlled;

		let actualDuration = duration;
		if (type !== "animation" || sliceType !== "video") {
			actualDuration = (duration !== undefined) ? duration : defaultDuration;
			// Note that duration can be 0 for a "hide" layer transition
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
			this._run();
		}
	}

	// The function will below shall loop if layerTransitionPercent !== null
	_run(layerTransitionPercent = null) {
		if (this._isRunning === false) {
			return
		}

		let percent = 1;

		// For an intermediate state (i.e. a controlled transition - not applicable
		// to videos for now since we do not want to seek a specific point in a video)
		if (layerTransitionPercent !== null && this._sliceType !== "video") {
			percent = layerTransitionPercent;

		// For an uncontrolled (i.e. timed) transition
		// Note: bear in mind that this._duration may still be undefined at this stage for a video
		} else if (this._duration && this._duration > 0) {
			percent = (Date.now() - this._startTime) / this._duration;

		// For a video transition (keep playing until percent = 1)
		} else if (this._sliceType === "video" && this._slice) {
			percent = 0;
		}

		const { stateChange } = this._handler;

		// If the user has forced the transition to its end...
		if (stateChange.shouldForceToEnd === true
			// ... or the transition is not a video running to its end, and it has actually ended
			// (except if the percent value is given by layerTransitionPercent, i.e. controlled)
			|| (this._sliceType !== "video" && percent >= 1 && layerTransitionPercent !== 1)) {
			this.end();

		} else if (this._type === "animation") {

			// If the transition is a sequence, we can seek a specific point in it
			if (this._sliceType === "sequence" && this._slice && layerTransitionPercent !== null) {
				this._slice.pauseAtPercent(percent);
			} else {
				// Bear in mind we do not want to seek a specific point in a video,
				// so keep on playing the transition, waiting until its eventual end
				requestAnimationFrame(this._run.bind(this, null));
			}

		// Otherwise just apply the required changes based on time
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

	// User in LayerTransition

	get stateChange() { return this._currentStateChange }

	get viewportRect() { return this._player.viewportRect }

	constructor(layerPile, shouldStateLayersCoexistOutsideTransitions = false, player) {
		this._layerPile = layerPile;
		this._shouldStateLayersCoexistOutsideTransitions = shouldStateLayersCoexistOutsideTransitions;
		this._player = player; // Useful only for viewportRect

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
			this._layerPile.doOnStateChangeStartOrCancel(stateIndex);
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
			const layerTransition = new LayerTransition(this, layer, isExiting, entry);
			layerTransitionsArray.push(layerTransition);
		});

		layerIndicesToRemove.forEach((layerIndex) => {
			const layer = this._layerPile.getLayerAtIndex(layerIndex);
			const { exitForward, exitBackward } = layer || {};
			const exit = (isGoingForward === true) ? exitForward : exitBackward;
			const isExiting = true;
			const layerTransition = new LayerTransition(this, layer, isExiting, exit);
			layerTransitionsArray.push(layerTransition);
		});

		return layerTransitionsArray
	}

	notifyTransitionEnd() {
		const { layerTransitionsArray } = this._currentStateChange;
		let nbOfRunningLayerTransitions = 0;
		layerTransitionsArray.forEach((layerTransition) => {
			if (layerTransition.isRunning === true) {
				nbOfRunningLayerTransitions += 1;
			}
		});

		if (nbOfRunningLayerTransitions === 0) {
			this._endStateChange();
		}
	}

	_endStateChange() {
		const { newStateIndex, endCallback } = this._currentStateChange;

		this._stateIndex = newStateIndex;

		this._layerPile.finalizeEntry();
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

	constructor(scene, overflow, player) {
		// A scene is just a layerPile (in the divina case, can only be a page)
		this._scene = scene;
		this._overflow = overflow;
		// Useful for viewportRect and updateDisplayForZoomFactor (and options just below)
		this._player = player;

		const { options } = player;
		const {
			allowsPaginatedScroll,
			isPaginationSticky,
			isPaginationGridBased,
			doOnScroll,
		} = options;
		this._allowsPaginatedScroll = (allowsPaginatedScroll === true
			|| allowsPaginatedScroll === false)
			? allowsPaginatedScroll
			: defaultAllowsPaginatedScroll;
		this._isPaginationSticky = (isPaginationSticky === true || isPaginationSticky === false)
			? isPaginationSticky
			: defaultIsPaginationSticky;
		this._isPaginationGridBased = (isPaginationGridBased === true
			|| isPaginationGridBased === false)
			? isPaginationGridBased
			: defaultIsPaginationGridBased;
		this._doOnScroll = doOnScroll;

		this._inScrollDirection = null;
		this._relativeStart = null;
		this._relativeEnd = null;

		// Those values can change on a resize (because of the change in viewportRect) but not with zoom
		// (i.e. the values are those that apply when zoomFactor === 1)
		this._distanceToCover = 0;
		this._startPosition = { x: 0, y: 0 }; // Camera center position for progress = 0 (or null)
		this._progressVector = { x: 0, y: 0 }; // Cam center endPosition = startPosition + progressVector

		// The below values can necessarily change on a resize, but also with a zoom change
		this._progress = null; // However if null, progress remains null whatever the zoomFactor
		this._minX = 0; // Minimum value for the camera center's coordinate on the x axis
		this._maxX = 0;
		this._minY = 0;
		this._maxY = 0;
		this._currentPosition = { x: 0, y: 0 }; // Camera center in non-scaled/non-zoomed referential
		this._signedPercent = null; // Signed % of currentPosition x or y over full scene width or height

		// Add an empty _rawSnapPointsArray to hold the values specified in the original linkObject
		// A real _snapPointsArray with progress values will later be computed if needed
		// (i.e. if the scene is larger than the viewport, which should be checked after each resize)
		this._rawSnapPointsArray = [];
		this._snapPointsArray = null;
		this._reset();
		this._possibleError = 0;
		this._paginationProgressStep = null;
		this._lastNonTemporaryProgress = null;
		this._virtualPointInfo = {};

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
		this._setVirtualPointInfo(inScrollDirection);
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

	_setVirtualPointInfo(inScrollDirection) {
		let getPercent = null;
		let referenceDimension = null;
		let coord = null;
		let worksBackward = false;

		switch (inScrollDirection) {
		case "ltr":
			getPercent = () => (
				(this._currentPosition.x - this._minX) / (this._maxX - this._minX)
			);
			referenceDimension = "width";
			coord = "x";
			worksBackward = false;
			break
		case "rtl":
			getPercent = () => (
				(this._maxX - this._currentPosition.x) / (this._maxX - this._minX)
			);
			referenceDimension = "width";
			coord = "x";
			worksBackward = true;
			break
		case "ttb":
			getPercent = () => (
				(this._currentPosition.y - this._minY) / (this._maxY - this._minY)
			);
			referenceDimension = "height";
			coord = "y";
			worksBackward = false;
			break
		case "btt":
			getPercent = () => (
				(this._maxY - this._currentPosition.y) / (this._maxY - this._minY)
			);
			referenceDimension = "height";
			coord = "y";
			worksBackward = true;
			break
		}

		this._virtualPointInfo = {
			getPercent, referenceDimension, coord, worksBackward,
		};
	}

	addSnapPoints(snapPointsArray, lastSegmentIndex) {
		snapPointsArray.forEach((snapPointInfo) => {
			const { viewport, x, y } = snapPointInfo;
			if ((viewport === "start" || viewport === "center" || viewport === "end")
				&& (x !== null || y !== null)) {
				const snapPoint = {
					segmentIndex: lastSegmentIndex,
					viewport,
					x,
					y,
				};
				this._rawSnapPointsArray.push(snapPoint);
			}
		});
	}

	// After an overflowHandler's _positionSegments() operation, so in particular after a resize:
	// - If the total length of all segments together is less than the viewport dimension,
	// then the camera will not have space to move (but beware: only if zoomFactor = 1),
	// so the camera's start and end positions will be set to the center of the whole segment block
	// - If not, _hasSpaceToMove = true and there is no need to move the camera initially,
	// since it is already well positioned respective to the first segment
	// (Also, do note that small pixel errors are accounted for!)
	setBoundsAndUpdateOnResize() {
		let distanceToCover = 0;
		let startCenter = null;

		const { viewportRect } = this._player;
		const { width, height } = viewportRect;
		this._startPosition = { x: 0, y: 0 };
		this._progressVector = { x: 0, y: 0 };

		this._referenceSceneSize = {
			width: this._scene.size.width,
			height: this._scene.size.height,
		};

		if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
			const sceneContainerWidth = this._scene.size.width;
			distanceToCover = sceneContainerWidth - width;
			const signFactor = (this._inScrollDirection === "rtl") ? -1 : 1;
			if (distanceToCover <= possiblePixelError) {
				distanceToCover = 0;
				startCenter = signFactor * (sceneContainerWidth / 2);
			} else {
				startCenter = signFactor * (width / 2);
			}
			this._startPosition.x = startCenter;
			this._progressVector.x = signFactor * distanceToCover;

		} else if (this._inScrollDirection === "ttb" || this._inScrollDirection === "btt") {
			const sceneContainerHeight = this._scene.size.height;
			distanceToCover = sceneContainerHeight - height;
			const signFactor = (this._inScrollDirection === "btt") ? -1 : 1;
			if (distanceToCover <= possiblePixelError) {
				distanceToCover = 0;
				startCenter = signFactor * (sceneContainerHeight / 2);
			} else {
				startCenter = signFactor * (height / 2);
			}
			this._startPosition.y = startCenter;
			this._progressVector.y = signFactor * distanceToCover;
		}
		this._distanceToCover = Math.max(distanceToCover, 0);

		// Now if the page is larger than the effective viewport...
		if (this._distanceToCover > 0) {

			// Compute the possible error for progress calculations
			this._possibleError = this._getProgressStepForLength(possiblePixelError);

			// Compute the progress delta corresponding to one pagination step forward
			this._paginationProgressStep = this._getPaginationProgressStep();

			// Build snap points (i.e. define their progress values), if relevant
			this._buildRelevantSnapPoints();
		}

		const callback = () => {
			// Force zoomFactor to 1 and recompute x and y bounds
			this._setZoomFactorAndUpdateBounds(1);

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

	// Build relevant snap points by adding a progress value to their raw information
	_buildRelevantSnapPoints() {
		const snapPointsArray = [];
		let lastProgress = -1;
		this._rawSnapPointsArray.forEach((rawSnapPoint) => {
			const progress = this._getProgressForSnapPoint(rawSnapPoint);
			if (progress !== null && progress > lastProgress) {
				const snapPoint = { ...rawSnapPoint, progress };
				snapPointsArray.push(snapPoint);
				lastProgress = progress;
			}
		});
		this._snapPointsArray = snapPointsArray;
	}

	_getProgressForSnapPoint(rawSnapPoint) {
		const {
			segmentIndex,
			viewport,
			x,
			y,
		} = rawSnapPoint;
		const segment = this._scene.layersArray[segmentIndex].content;
		const { size, positionInSegmentLine } = segment;

		// Get the top left position of the camera for the snap point alignment
		const position = this._getCameraPositionInSegmentForAlignment(viewport, { x, y }, size);
		if (!position) {
			return null
		}
		// Update the position based on the segment's position in the scene
		position.x += positionInSegmentLine.x;
		position.y += positionInSegmentLine.y;

		// Compute the distance from the scene container's start point to that new point
		const distanceToCenter = getDistance(this._startPosition, position);
		// Convert that value into an acceptable progress value (between 0 and 1)
		let progress = null;
		if (distanceToCenter < possiblePixelError) {
			progress = 0;
		} else if (Math.abs(this._distanceToCover - distanceToCenter) < possiblePixelError) {
			progress = 1;
		} else {
			progress = Math.min(Math.max(distanceToCenter / this._distanceToCover, 0), 1);
		}

		return progress
	}

	// Get the position of the camera's top left point corresponding to a given snap point alignment
	_getCameraPositionInSegmentForAlignment(viewportPoint, coords, segmentSize) {
		const sign = (this._inScrollDirection === "rtl" || this._inScrollDirection === "btt") ? -1 : 1;
		const x = parseCoordinate(coords.x, segmentSize.width);
		const y = parseCoordinate(coords.y, segmentSize.height);
		if (x === null || y === null) {
			return null
		}

		const { viewportRect } = this._player;
		const { width, height } = viewportRect;
		const position = {
			x: sign * x,
			y: sign * y,
		};
		switch (viewportPoint) {
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
		this._zoomFactor = Math.min(Math.max(zoomFactor, 1), maxZoomFactor);
		this._scene.setScale(this._zoomFactor); // Reminder: this._scene is a Container

		this._player.updateDisplayForZoomFactor(zoomFactor);

		this._updateMinAndMaxX();
		this._updateMinAndMaxY();
		this._updateOffsetInScaledReferential();
	}

	_updateMinAndMaxX() {
		const { rootSize, viewportRect } = this._player;
		const { width } = viewportRect;

		const tippingZoomFactorValue = width / this._referenceSceneSize.width;

		if (this._inScrollDirection === "ltr") {
			// Reminder: this._startPosition.x does not change
			// And = this._referenceSceneSize.width / 2 if this._referenceSceneSize.width < width
			if (this._zoomFactor < tippingZoomFactorValue) {
				const k = (this._zoomFactor - 1) / (tippingZoomFactorValue - 1);
				this._minX = this._startPosition.x + k * (width / 2 - this._startPosition.x);
				this._maxX = this._minX;
			} else {
				this._minX = width / 2;
				this._maxX = this._minX + this._referenceSceneSize.width * this._zoomFactor - width;
			}
		} else if (this._inScrollDirection === "rtl") {
			if (this._zoomFactor < tippingZoomFactorValue) {
				const k = (this._zoomFactor - 1) / (tippingZoomFactorValue - 1);
				this._maxX = this._startPosition.x - k * (width / 2 + this._startPosition.x);
				this._minX = this._maxX;
			} else {
				this._maxX = -width / 2;
				this._minX = this._maxX - this._referenceSceneSize.width * this._zoomFactor + width;
			}
		} else {
			const sizeDiff = this._referenceSceneSize.width * this._zoomFactor - rootSize.width;
			const delta = (sizeDiff > 0) ? sizeDiff / 2 : 0;
			this._minX = this._startPosition.x - delta;
			this._maxX = this._startPosition.x + delta;
		}
	}

	_updateMinAndMaxY() {
		const { rootSize, viewportRect } = this._player;
		const { height } = viewportRect;

		const tippingZoomFactorValue = height / this._referenceSceneSize.height;

		if (this._inScrollDirection === "ttb") {
			if (this._zoomFactor < tippingZoomFactorValue) {
				const k = (this._zoomFactor - 1) / (tippingZoomFactorValue - 1);
				this._minY = this._startPosition.y + k * (height / 2 - this._startPosition.y);
				this._maxY = this._minY;
			} else {
				this._minY = height / 2;
				this._maxY = this._minY + this._referenceSceneSize.height * this._zoomFactor - height;
			}
		} else if (this._inScrollDirection === "btt") {
			if (this._zoomFactor < tippingZoomFactorValue) {
				const k = (this._zoomFactor - 1) / (tippingZoomFactorValue - 1);
				this._maxY = this._startPosition.y - k * (height / 2 + this._startPosition.y);
				this._minY = this._maxY;
			} else {
				this._maxY = -height / 2;
				this._minY = this._maxY - this._referenceSceneSize.height * this._zoomFactor + height;
			}
		} else {
			const sizeDiff = this._referenceSceneSize.height * this._zoomFactor - rootSize.height;
			const delta = (sizeDiff > 0) ? sizeDiff / 2 : 0;
			this._minY = this._startPosition.y - delta;
			this._maxY = this._startPosition.y + delta;
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

	_updatePositionAndProgressOnResize() { // Reminder: this._zoomFactor necessarily is 1
		// If the scene can now entirely fit within the viewport
		if (this._distanceToCover === 0) {

			this._setPosition(this._startPosition);
			this.setProgress(null);

		} else { // Note that progress may have been null before

			// Keep center of camera fixed

			const { width, height } = this._scene.size;
			const newPosition = {
				x: Math.min(Math.max(this._signedPercent * width,
					this._minX), this._maxX),
				y: Math.min(Math.max(this._signedPercent * height,
					this._minY), this._maxY),
			};

			if (this._overflow === "scrolled") {
				this._setPosition(newPosition);
			}

			const shouldStoreLastNonTemporaryProgress = (this._overflow === "paginated"
				&& this._isPaginationSticky === true);
			this._updateProgressForPosition(newPosition, shouldStoreLastNonTemporaryProgress);

			if (this._overflow === "paginated" && this.isAutoScrolling === false) {
				const isTheResultOfADragEnd = false;
				this._moveToClosestSnapPoint(isTheResultOfADragEnd);
			}

			// Update snap point-related speeds based on inScrollDirection
			if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
				this._snapJumpSpeed = width * snapJumpSpeedFactor;
				this._stickyMoveSpeed = width * stickyMoveSpeedFactor;
			} else if (this._inScrollDirection === "ttb" || this._inScrollDirection === "btt") {
				this._snapJumpSpeed = height * snapJumpSpeedFactor;
				this._stickyMoveSpeed = height * stickyMoveSpeedFactor;
			}
		}
	}

	_setPosition({ x, y }) { // Note that x and y correspond to the camera's center position
		this._currentPosition = { x, y };
		this._scene.setPosition({ x: -x, y: -y }); // this._scene is still a Container

		if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
			this._signedPercent = x / (this._scene.size.width * this._zoomFactor);
		} else if (this._inScrollDirection === "ttb" || this._inScrollDirection === "btt") {
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
			this._lastNonTemporaryProgress = this._progress;
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
		this._progress = p;
		this._virtualPoint = this._getVirtualPoint();
		if (this._doOnScroll) {
			this._doOnScroll(this._virtualPoint);
		}
		if (shouldUpdatePosition === false) {
			return
		}
		if (p === null) {
			this._setPosition(this._startPosition);
		} else if (this._inScrollDirection === "ltr") {
			this._setPosition({
				x: this._minX + p * this._progressVector.x * this._zoomFactor,
				y: Math.min(Math.max(this._currentPosition.y, this._minY), this._maxY),
			});
		} else if (this._inScrollDirection === "rtl") {
			this._setPosition({
				x: this._maxX + p * this._progressVector.x * this._zoomFactor,
				y: Math.min(Math.max(this._currentPosition.y, this._minY), this._maxY),
			});
		} else if (this._inScrollDirection === "ttb") {
			this._setPosition({
				x: Math.min(Math.max(this._currentPosition.x, this._minX), this._maxX),
				y: this._minY + p * this._progressVector.y * this._zoomFactor,
			});
		} else if (this._inScrollDirection === "btt") {
			this._setPosition({
				x: Math.min(Math.max(this._currentPosition.x, this._minX), this._maxX),
				y: this._maxY + p * this._progressVector.y * this._zoomFactor,
			});
		}
	}

	_getVirtualPoint() {
		if (this._progress === null) {
			return null
		}

		const { viewportRect } = this._player;
		const { getPercent, referenceDimension, coord } = this._virtualPointInfo;

		const percent = getPercent();

		let i = 0;
		let virtualPoint = null;
		let remainingDistance = viewportRect[referenceDimension] / 2;
		remainingDistance += (coord === "x")
			? (percent * (this._maxX - this._minX))
			: (percent * (this._maxY - this._minY));
		remainingDistance /= this._zoomFactor;

		while (i < this._scene.layersArray.length && virtualPoint === null) {
			const segmentLayer = this._scene.layersArray[i];
			const { size } = segmentLayer;
			const referenceDistance = size[referenceDimension];
			remainingDistance -= referenceDistance;

			if (remainingDistance <= possiblePixelError && referenceDistance > 0) {
				let percentInSegment = (remainingDistance + referenceDistance) / referenceDistance;
				percentInSegment = Math.min(Math.max(percentInSegment, 0), 1);
				const { worksBackward } = this._virtualPointInfo;
				virtualPoint = {
					segmentIndex: i,
					href: segmentLayer.getFirstHref(),
					[coord]: (worksBackward === true) ? (1 - percentInSegment) : percentInSegment,
					percent,
				};
			}
			i += 1;
		}

		return virtualPoint
	}

	setPercent(percent) {
		switch (this._inScrollDirection) {
		case "ltr":
			this._setPosition({
				x: this._minX + percent * (this._maxX - this._minX),
				y: Math.min(Math.max(this._currentPosition.y, this._minY), this._maxY),
			});
			break
		case "rtl":
			this._setPosition({
				x: this._maxX - percent * (this._maxX - this._minX),
				y: Math.min(Math.max(this._currentPosition.y, this._minY), this._maxY),
			});
			break
		case "ttb":
			this._setPosition({
				x: Math.min(Math.max(this._currentPosition.x, this._minX), this._maxX),
				y: this._minY + percent * (this._maxY - this._minY),
			});
			break
		case "btt":
			this._setPosition({
				x: Math.min(Math.max(this._currentPosition.x, this._minX), this._maxX),
				y: this._maxY - percent * (this._maxY - this._minY),
			});
			break
		}
		this._updateProgressForPosition();
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
			nextProgress = this._getNextSnapPointProgress(allowsSameProgress);
			previousProgress = this._getPreviousSnapPointProgress(allowsSameProgress);
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
	_getNextSnapPointProgress(allowsSameProgress = false, lastNonTemporaryProgress = null) {
		if (!this._snapPointsArray
			|| (this._overflow === "scrolled" && this._allowsPaginatedScroll === false)) {
			return null
		}

		// If lastNonTemporaryProgress is defined, then a step forward
		// (via a discontinuous gesture or a sticky drag) is under way
		const referenceProgress = (lastNonTemporaryProgress !== null)
			? lastNonTemporaryProgress
			: this._progress;
		let i = 0;
		while (i < this._snapPointsArray.length
			&& ((allowsSameProgress === true)
				? this._snapPointsArray[i].progress <= referenceProgress + this._possibleError
				: this._snapPointsArray[i].progress < referenceProgress - this._possibleError)) {
			i += 1;
		}

		let nextProgress = 1;
		if (i < this._snapPointsArray.length) {
			nextProgress = this._snapPointsArray[i].progress;
		}

		// Select the closest value between that one and the one corresponding to one pagination away
		if (this._paginationProgressStep) {
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

	// Get the progress value of the previous snap point in the list (0 if there is none)
	_getPreviousSnapPointProgress(allowsSameProgress = false, lastNonTemporaryProgress = null) {
		if (!this._snapPointsArray
			|| (this._overflow === "scrolled" && this._allowsPaginatedScroll === false)) {
			return null
		}

		// If lastNonTemporaryProgress is defined, then a step backward
		// (via a discontinuous gesture or a sticky drag) is under way
		const referenceProgress = (lastNonTemporaryProgress !== null)
			? lastNonTemporaryProgress
			: this._progress;
		let i = this._snapPointsArray.length - 1;
		while (i >= 0
			&& ((allowsSameProgress === true)
				? this._snapPointsArray[i].progress >= referenceProgress - this._possibleError
				: this._snapPointsArray[i].progress > referenceProgress + this._possibleError)) {
			i -= 1;
		}

		let previousProgress = 0;
		if (i >= 0) {
			previousProgress = this._snapPointsArray[i].progress;
		}

		// Select the closest value between that one and the one corresponding to one pagination away
		if (this._paginationProgressStep) {
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
			zoomFactor = (this._zoomFactor !== 1) ? 1 : maxZoomFactor;

			// Compute camera's fixed point
			zoomFixedPoint = this._computeFixedPoint(touchPoint, viewportRect);

		} else {
			if (!delta && !multiplier) {
				return
			}

			// Compute zoom factor
			if (delta) {
				const { height } = viewportRect;
				const zoomSensitivity = zoomSensitivityConstant / height;
				zoomFactor = Math.min(Math.max(this._zoomFactor - delta * zoomSensitivity, 1),
					maxZoomFactor);
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
		this._setPosition({
			x: Math.min(Math.max(this._currentPosition.x + zoomChange * zoomFixedPoint.x,
				this._minX), this._maxX),
			y: Math.min(Math.max(this._currentPosition.y + zoomChange * zoomFixedPoint.y,
				this._minY), this._maxY),
		});

		// Update progress to conform to that new position
		const shouldStoreLastNonTemporaryProgress = (this._overflow === "paginated"
			&& this._isPaginationSticky === true);
		this._updateProgressForPosition(this._currentPosition, shouldStoreLastNonTemporaryProgress);

		// If reverting to normal zoomFactor=1 value when overflow=paginated, snap to closest snap point
		if (this._zoomFactor === 1 && this._overflow === "paginated") {
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

		const percent = (Date.now() - startDate) / duration;

		if (duration === 0 || percent >= 1 || shouldForceToEnd === true) {
			this.setProgress(targetProgress);
			this._reset();
			if (endCallback) {
				endCallback();
			}
		} else {
			let forcedProgress = startProgress + (targetProgress - startProgress) * percent;
			forcedProgress = Math.min(Math.max(forcedProgress, 0), 1);
			this.setProgress(forcedProgress);
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

	// Apply the amount of user scrolling to the scene container's position via the camera
	// by computing what new progress value the delta corresponds to
	handleScroll(scrollData, isWheelScroll) {
		if (this._hasSpaceToMove === false
			|| (this.isZoomed === false && (this._overflow === "paginated"
				&& (this._isPaginationSticky === false || isWheelScroll === true)))) {
			return false
		}
		const { deltaX, deltaY } = scrollData;
		this._setPosition({
			x: Math.min(Math.max(this._currentPosition.x - deltaX, this._minX), this._maxX),
			y: Math.min(Math.max(this._currentPosition.y - deltaY, this._minY), this._maxY),
		});
		const shouldStoreLastNonTemporaryProgress = (this._overflow === "paginated"
			&& this._isPaginationSticky === true);
		this._updateProgressForPosition(this._currentPosition, shouldStoreLastNonTemporaryProgress);
		return true
	}

	moveToSegmentIndex(segmentIndex, isGoingForward) {
		// If the scene is not larger than the viewport, just display it
		if (this._hasSpaceToMove === false) {
			return
		}
		// If a segmentIndex is specified and progress is defined,
		// then get the progress value to which the segment corresponds
		if (segmentIndex !== null && this._progress !== null) {
			const progress = this._getProgressForSegmentIndex(segmentIndex);
			this.setProgress(progress || 0);
		// Otherwise just go to the start or end of the scene
		} else {
			this.moveToStartOrEnd(isGoingForward);
		}
	}

	_getProgressForSegmentIndex(segmentIndex) {
		// The progress value is computed for the "start" viewport point in the case
		// the inScrollDirection is ltr or btt, and for the "end" point otherwise
		const snapPoint = {
			segmentIndex,
			viewport: "start",
			x: "0%",
			y: "0%",
		};
		const progress = this._getProgressForSnapPoint(snapPoint);
		return progress
	}

	moveToStartOrEnd(isGoingForward = true) {
		if (this._distanceToCover === 0) {
			return
		}

		this._reset();
		this.setProgress((isGoingForward === true) ? 0 : 1);

		if (isGoingForward === true) {
			this._signedPercent = 0;
		} else {
			this._signedPercent = (this._inScrollDirection === "rtl"
				|| this._inScrollDirection === "btt")
				? -1
				: 1;
		}
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

	constructor(layerPile, overflow, player) {
		this._layerPile = layerPile;

		// An overflowHandler necessarily has a camera
		this._camera = new Camera(layerPile, overflow, player);

		this._type = "overflowHandler";

		this._inScrollDirection = null;
	}

	setInScrollDirection(inScrollDirection) {
		this._inScrollDirection = inScrollDirection;
		this._camera.setInScrollDirection(inScrollDirection);
		this.resize(); // Will reposition segments
	}

	// Functions linked to segments

	// Add snap points to the last segment - since we are still in the process of adding segments
	addSnapPointsForLastSegment(snapPointsArray) {
		const segmentsArray = this._layerPile.layersArray.map((layer) => (layer.content));
		if (segmentsArray.length === 0) {
			return
		}
		const lastSegmentIndex = segmentsArray.length - 1;
		this._camera.addSnapPoints(snapPointsArray, lastSegmentIndex);
	}

	goToSegmentIndex(segmentIndex, isGoingForward) {
		this._camera.moveToSegmentIndex(segmentIndex, isGoingForward);
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

	// Functions to deal with continuous gestures and zoom

	handleScroll(scrollData, isWheelScroll) {
		if (this.activeLayersArray.length === 1) {
			const layer = this.activeLayersArray[0]; // Check only the first Segment in a Page
			const { content } = layer;
			if (content.handleScroll(scrollData, isWheelScroll) === true) {
				return true
			}
		}
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
				segment.setPositionInSegmentLine({ x: sumOfPreviousSegmentDimensions, y: 0 });
				segment.setPosition({
					x: sumOfPreviousSegmentDimensions + width / 2,
					y: 0,
				});
				sumOfPreviousSegmentDimensions += width;
				break
			case "rtl":
				segment.setPositionInSegmentLine({ x: -sumOfPreviousSegmentDimensions, y: 0 });
				segment.setPosition({
					x: -sumOfPreviousSegmentDimensions - width / 2,
					y: 0,
				});
				sumOfPreviousSegmentDimensions += width;
				break
			case "ttb":
				segment.setPositionInSegmentLine({ x: 0, y: sumOfPreviousSegmentDimensions });
				segment.setPosition({
					x: 0,
					y: sumOfPreviousSegmentDimensions + height / 2,
				});
				sumOfPreviousSegmentDimensions += height;
				break
			case "btt":
				segment.setPositionInSegmentLine({ x: 0, y: -sumOfPreviousSegmentDimensions });
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

	// Used below

	get layersArray() { return this._layersArray }

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

	// Used in Layer
	get loadStatus() { return this._loadStatus }

	constructor(name, parent = null, layersArray = [], isFirstSliceAParentSlice = false) {
		super(name, parent);

		this._name = name;
		this._parent = parent;

		// Build layers
		this._layersArray = [];
		// Note that the fallback slice is added too, although its texture will be hidden (in Slice.js)
		if (layersArray) {
			layersArray.forEach((layer) => {
				this._addLayer(layer);
				layer.setParent(this);
			});
		}

		const parentSliceLayer = (isFirstSliceAParentSlice === true && layersArray.length > 0)
			? layersArray[0]
			: null;
		this._parentSlice = (parentSliceLayer) ? parentSliceLayer.content : null;

		this._loadStatus = null;

		this._handler = null;
	}

	_addLayer(layer, shouldAddLayerAtStart = false) {
		if (shouldAddLayerAtStart === true) { // For an empty segment
			this._layersArray.unshift(layer);
			const slice = layer.content;
			this.addChildAtIndex(slice, 0);
		} else {
			this._layersArray.push(layer);
		}
		// Note that we do not add containerObjects right away,
		// since the PageNavigator's stateHandler will deal with that
	}

	getDepthOfNewLayer() {
		return this._depth
	}

	_addStateHandler(shouldStateLayersCoexistOutsideTransitions, player) {
		this._handler = new StateHandler(this, shouldStateLayersCoexistOutsideTransitions,
			player);
	}

	_addOverflowHandler(overflow, player) {
		this._handler = new OverflowHandler(this, overflow, player);
	}

	getLayerAtIndex(layerIndex) {
		if (this._layersArray.length === 0
			|| layerIndex < 0 || layerIndex >= this._layersArray.length) {
			return null
		}
		const layer = this._layersArray[layerIndex];
		return layer
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

	// Following a continuous gesture

	handleScroll(scrollData, isWheelScroll) {
		if (!this._handler) {
			return false
		}
		if (this._handler.type === "overflowHandler"
			&& this._handler.handleScroll(scrollData, isWheelScroll) === true) {
			return true
		}
		return (this._handler.type === "stateHandler"
			&& this._handler.handleScroll(scrollData, isWheelScroll) === true)
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
			// If the LayerPile is a Segment with a unique Slice (or eventually a basic LayerPile)
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

	getPathsToLoad() {
		const fullPathsArray = [];
		this._layersArray.forEach((layer) => {
			const pathsArray = layer.getPathsToLoad();
			fullPathsArray.push(...pathsArray);
		});
		return fullPathsArray
	}

	destroyTexturesIfPossible() {
		this._layersArray.forEach((layer) => { layer.destroyTexturesIfPossible(); });
	}

	getFirstHref() {
		if (this._layersArray.length === 0) {
			return null
		}
		return this._layersArray[0].getFirstHref()
	}

	// Slice functions

	resizePage() {
		if (!this._parent || !this._parent.resizePage) {
			return
		}
		this._parent.resizePage();
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

		if (this._loadStatus !== oldLoadStatus && this._parent
			&& this._parent.updateLoadStatus) {
			this._parent.updateLoadStatus();
		}
	}

}

class PageNavigator extends LayerPile {

	// Used in StateHandler
	get doOnStateChangeStartOrCancel() { return this.updateLoadTasks }

	// Used in Player and ResourceManager
	get type() { return this._type }

	// Used in ResourceManager (and below)
	get pageIndex() {
		const pageIndex = (this._handler && this._handler.type === "stateHandler")
			? this._handler.stateIndex
			: 0;
		return pageIndex
	}

	// Used in InteractionManager
	get currentPage() { return this._currentPage }

	// Used in Slice
	get metadata() { return this._metadata }

	// Used below
	get nbOfPages() { return (this._pagesArray) ? this._pagesArray.length : 0 }

	constructor(type, metadata, pageLayersArray, player) {
		const name = `${type}PageNav`;
		const parent = null;
		super(name, parent, pageLayersArray);

		this._type = type;
		this._metadata = metadata;

		const {
			eventEmitter, interactionManager, resourceManager, options,
		} = player;
		this._eventEmitter = eventEmitter;
		this._interactionManager = interactionManager;
		this._resourceManager = resourceManager;

		const { allowsDestroy } = options;
		this._allowsDestroy = (allowsDestroy === true || allowsDestroy === false)
			? allowsDestroy
			: defaultAllowsDestroy;

		const shouldStateLayersCoexistOutsideTransitions = false;
		this._addStateHandler(shouldStateLayersCoexistOutsideTransitions, player);

		this._pagesArray = (this._layersArray)
			? this._layersArray.map(({ content }) => (content))
			: [];

		this._currentPage = null; // The current page will be the page pointed to by pageIndex

		this._targetSegmentIndex = null;

		// Pages for which textures are required to be loaded
		this._loadingPageRange = {
			startIndex: null,
			endIndex: null,
		};

		this._tags = null;

		this._pageDeltaForTransitionControl = null;
	}

	setLoadingProperties(maxNbOfPagesBefore, maxNbOfPagesAfter) {
		this._maxNbOfPagesBefore = maxNbOfPagesBefore;
		this._maxNbOfPagesAfter = maxNbOfPagesAfter;
	}

	// Used above and in Player
	updateLoadTasks(targetPageIndex, oldPathsSet = null) {
		const actualTargetPageIndex = (targetPageIndex === null) ? this.pageIndex : targetPageIndex;

		// Update priorities for load tasks (if some tasks are still pending)
		this._resourceManager.updateForTargetPageIndex(actualTargetPageIndex);

		// Determine which pages have been added or removed

		if (oldPathsSet) { // On a reading mode or tag change
			this._loadingPageRange = {
				startIndex: null,
				endIndex: null,
			};
		}

		const { startIndex, endIndex } = this._getPageIndexLoadingRange(actualTargetPageIndex);
		// If start and end indices have not changed, do nothing
		if (startIndex !== this._loadingPageRange.startIndex
			|| endIndex !== this._loadingPageRange.endIndex) {

			const pagesToAddIndices = [];
			const pagesToRemoveIndices = [];
			// Determine added page indices
			for (let i = startIndex; i <= endIndex; i += 1) {
				if (this._loadingPageRange.startIndex === null
					|| (i < this._loadingPageRange.startIndex || i > this._loadingPageRange.endIndex)
					|| this._layersArray[i].loadStatus === 1
					|| this._layersArray[i].loadStatus === 0
					|| this._pagesArray[i].loadStatus === -1) {
					pagesToAddIndices.push(i);
				}
			}
			// Determine removed page indices
			if (this._loadingPageRange.startIndex !== null) {
				for (let i = this._loadingPageRange.startIndex;
					i <= this._loadingPageRange.endIndex; i += 1) {
					if (i < startIndex || i > endIndex) {
						pagesToRemoveIndices.push(i);
					}
				}
			}
			// Store active page range for next time (i.e. next page change)
			this._loadingPageRange = { startIndex, endIndex };

			// Load relevant textures
			const newPathsSet = new Set(); // Used to list all *individual* paths
			pagesToAddIndices.forEach((pageIndex) => {
				const layer = this._getLayerWithIndex(pageIndex);
				if (layer) {
					const pathsArrayAndSliceIdsArray = layer.getPathsToLoad();
					pathsArrayAndSliceIdsArray.forEach(({ pathsArray, sliceId }) => {
						// Reminder: at this stage each pathsArray actually = { pathsArray, sliceId }
						this._resourceManager.loadTexturesAtPaths(pathsArray, sliceId, pageIndex);
						pathsArray.forEach((path) => {
							newPathsSet.add(path);
						});
					});
				}
			});

			// Destroy relevant textures
			if (this._allowsDestroy === true) {

				if (oldPathsSet) {
					const destroyablePathsArray = [];
					// All those in old that are not in new!
					oldPathsSet.forEach((oldPath) => {
						let canBeDestroyed = true;
						newPathsSet.forEach((newPath) => {
							if (newPath === oldPath) {
								canBeDestroyed = false;
							}
						});
						if (canBeDestroyed === true) {
							destroyablePathsArray.push(oldPath);
						}
					});
					destroyablePathsArray.forEach((path) => {
						this._resourceManager.forceDestroyTexturesForPath(path);
					});
				}

				pagesToRemoveIndices.forEach((pageIndex) => {
					const layer = this._getLayerWithIndex(pageIndex);
					if (layer) {
						layer.destroyTexturesIfPossible();
					}
				});
			}
		}
	}

	_getPageIndexLoadingRange(pageIndex) {
		let startIndex = 0;
		let endIndex = this.nbOfPages - 1;
		if (this._maxNbOfPagesAfter) {
			startIndex = Math.max(0, pageIndex - this._maxNbOfPagesBefore);
			endIndex = Math.min(this.nbOfPages - 1, pageIndex + this._maxNbOfPagesAfter);
		}
		return { startIndex, endIndex }
	}

	// On a successful page change (post-transition), when this.pageIndex (= stateIndex) has changed
	finalizeEntry() {
		if (this.pageIndex < this._pagesArray.length) {
			this._currentPage = this._pagesArray[this.pageIndex];
		} else {
			return
		}
		if (!this._currentPage) {
			return
		}

		// If _doOnStateChangeEnd has been called by a goTo, go to the relevant segment directly
		if (this._targetSegmentIndex !== null) {
			this._currentPage.goToSegmentIndex(this._targetSegmentIndex);
			this._targetSegmentIndex = null;
		}

		// If required, do something with the page change information (e.g. signal it via an event)
		const customData = { pageIndex: this.pageIndex, nbOfPages: this.nbOfPages };
		this._eventEmitter.emit("pagechange", customData);
	}

	// Used in StateHandler
	getDepthOfNewLayer(oldPageIndex, isGoingForward) {
		if (oldPageIndex < 0 || oldPageIndex >= this._layersArray.length
			|| !this._layersArray[oldPageIndex]) {
			return 1
		}
		const { exitForward, exitBackward } = this._layersArray[oldPageIndex];
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

	goToPageWithIndex(pageIndex, segmentIndex = null, shouldSkipTransition = false,
		isChangeControlled = false) {
		let isGoingForward = true;
		this._targetSegmentIndex = segmentIndex;

		if (!this._handler || this._handler.type !== "stateHandler") {
			return
		}

		const callback = () => {
			// If changing pages
			if (pageIndex !== this.pageIndex) {
				if (this.pageIndex !== null) {
					isGoingForward = (pageIndex - this.pageIndex > 0);
				}
				this._handler.goToState(pageIndex, isGoingForward, shouldSkipTransition, isChangeControlled);
				// And then the finalizeEntry above will ensure we go to segmentIndex directly

			// Or if staying on the same page but changing segments
			} else if (this._targetSegmentIndex !== null) {
				// Leave isGoingForward at true
				this._currentPage.goToSegmentIndex(this._targetSegmentIndex, isGoingForward);
				this._targetSegmentIndex = null;
			}
		};

		// If forcing a page change (e.g. via ToC while a transition is running)
		if (this._handler.isUndergoingChanges === true) {
			this._handler.forceChangesToEnd(callback);
		} else {
			callback();
		}
	}

	_getLayerWithIndex(pageIndex) {
		if (this._layersArray.length > 0 && pageIndex >= 0 && pageIndex < this.nbOfPages) {
			const layer = this._layersArray[pageIndex];
			return layer
		}
		return null
	}

	finalizeExit() { // But no need for a setupForEntry
		super.finalizeExit();
		this._currentPage = null;
		this.removeFromParent();
	}

	setPercentInCurrentPage(percent) {
		if (!this._currentPage) {
			return
		}
		this._currentPage.setPercent(percent);
	}

	getFirstHrefInCurrentPage() {
		if (!this._currentPage) {
			return null
		}
		return this._currentPage.getFirstHref()
	}

	destroy() {
		this.removeFromParent();
	}

}

class Slideshow extends PageNavigator {

	constructor(type, metadata, pageLayersArray, player) {
		super(type, metadata, pageLayersArray, player);

		const { direction } = metadata || {};
		this._direction = direction;

		this._pagesArray.forEach((page) => {
			page.setDirection(direction);
		});
	}

	go(way, shouldGoToTheMax) {
		if (!this._direction
			|| ((way === "right" || way === "left")
				&& (this._direction === "ttb" || this._direction === "btt"))
			|| ((way === "down" || way === "up")
				&& (this._direction === "rtl" || this._direction === "ltr"))) {
			return
		}

		if (shouldGoToTheMax === true) {
			let targetPageIndex = null;
			if (way === "right" || way === "down") {
				targetPageIndex = (this._direction === "ltr"
					|| this._direction === "ttb")
					? this._pagesArray.length - 1
					: 0;
			} else if (way === "left" || way === "up") {
				targetPageIndex = (this._direction === "rtl"
					|| this._direction === "btt")
					? this._pagesArray.length - 1
					: 0;
			}
			if (targetPageIndex !== null) {
				const shouldSkipTransition = true;
				if (targetPageIndex !== this.pageIndex) {
					this.goToPageWithIndex(targetPageIndex, null, shouldSkipTransition);
				} else {
					this.goToPageWithIndex(targetPageIndex, 0, shouldSkipTransition);
				}
			}
		} else {
			switch (way) {
			case "right":
				this._interactionManager.goRight();
				break
			case "left":
				this._interactionManager.goLeft();
				break
			case "down":
				this._interactionManager.goDown();
				break
			case "up":
				this._interactionManager.goUp();
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

		this._isActive = false;
	}

	setParent(parent) {
		if (!this._content) {
			return
		}
		this._content.setParent(parent);
	}

	setEntryForward(entryForward) {
		this._entryForward = entryForward;
	}

	setExitForward(exitForward) {
		this._exitForward = exitForward;
	}

	setEntryBackward(entryBackward) {
		this._entryBackward = entryBackward;
	}

	setExitBackward(exitBackward) {
		this._exitBackward = exitBackward;
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
		if (!this._content) {
			return
		}
		this._content.setupForEntry(isGoingForward);
	}

	finalizeEntry() {
		if (!this._content) {
			return
		}
		this._content.finalizeEntry();
	}

	finalizeExit() {
		this._isActive = false;
		if (!this._content) {
			return
		}
		this._content.finalizeExit();
	}

	// Used in PageNavigator
	getPathsToLoad() {
		if (!this._content) {
			return []
		}

		const fullPathsArray = [];

		let pathsArray = this._content.getPathsToLoad();
		fullPathsArray.push(...pathsArray);

		if (this._entryForward) {
			pathsArray = Layer.getPathsForLayerTransition(this._entryForward);
			fullPathsArray.push(...pathsArray);
		}
		if (this._exitForward) {
			pathsArray = Layer.getPathsForLayerTransition(this._exitForward);
			fullPathsArray.push(...pathsArray);
		}
		if (this._entryBackward) {
			pathsArray = Layer.getPathsForLayerTransition(this._entryBackward);
			fullPathsArray.push(...pathsArray);
		}
		if (this._exitBackward) {
			pathsArray = Layer.getPathsForLayerTransition(this._exitBackward);
			fullPathsArray.push(...pathsArray);
		}

		return fullPathsArray
	}

	static getPathsForLayerTransition(layerTransition) {
		const { slice } = layerTransition;
		if (!slice) {
			return []
		}
		return slice.getPathsToLoad()
	}

	destroyTexturesIfPossible() {
		if (!this._content) {
			return
		}
		this._content.destroyTexturesIfPossible();

		if (this._entryForward) {
			Layer.destroyTexturesIfPossibleForHalfTransition(this._entryForward);
		}
		if (this._exitForward) {
			Layer.destroyTexturesIfPossibleForHalfTransition(this._exitForward);
		}
		if (this._entryBackward) {
			Layer.destroyTexturesIfPossibleForHalfTransition(this._entryBackward);
		}
		if (this._exitBackward) {
			Layer.destroyTexturesIfPossibleForHalfTransition(this._exitBackward);
		}
	}

	static destroyTexturesIfPossibleForHalfTransition(halfTransition) {
		const { slice } = halfTransition;
		if (!slice) {
			return
		}
		slice.destroyTexturesIfPossible();
	}

	getFirstHref() {
		if (!this._content || !this._content.getFirstHref) {
			return null
		}
		return this._content.getFirstHref()
	}

}

class Page extends LayerPile {

	get isAtStart() {
		return (this._handler && this._handler.type === "overflowHandler"
			&& this._handler.isAtStart === true)
	}

	get isAtEnd() {
		return (this._handler && this._handler.type === "overflowHandler"
			&& this._handler.isAtEnd === true)
	}

	// Used in Segment
	get pageIndex() { return this._pageIndex }

	// Used in StoryLoader and below
	get segmentsArray() { return this._layersArray.map(({ content }) => (content)) }

	// Used in InteractionManager

	get hitZoneToPrevious() { return this._hitZoneToPrevious }

	get hitZoneToNext() { return this._hitZoneToNext }

	get inScrollDirection() { return this._inScrollDirection }

	get size() {
		let width = 0;
		let height = 0;
		// The size is derived from the sizes of all segments
		this.segmentsArray.forEach((segment) => {
			const { size } = segment;
			const { viewportRect } = this._player;
			if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
				width += size.width;
				if (this._isADoublePage === true) {
					height = Math.max(height, size.height);
				} else {
					height = viewportRect.height;
				}
			} else if (this._inScrollDirection === "ttb" || this._inScrollDirection === "btt") {
				height += size.height;
				width = viewportRect.width;
			}
		});
		return { width, height }
	}

	constructor(pageIndex, isADoublePage, overflow, player) {
		const name = `page${pageIndex}`;
		super(name);

		this._pageIndex = pageIndex;
		this._isADoublePage = isADoublePage;
		this._player = player;

		this._hitZoneToPrevious = null;
		this._hitZoneToNext = null;
		this._inScrollDirection = null;

		this._addOverflowHandler(overflow, player);

		const { options } = player;
		const { doOnPageLoadStatusUpdate } = options;
		if (doOnPageLoadStatusUpdate) {
			this._doOnPageLoadStatusUpdate = doOnPageLoadStatusUpdate;
		}
	}

	// Used in Slideshow
	setDirection(direction) {
		this._setInScrollDirection(direction);

		switch (direction) {
		case "ltr":
			this._setHitZoneToPrevious("left");
			this._setHitZoneToNext("right");
			break
		case "rtl":
			this._setHitZoneToPrevious("right");
			this._setHitZoneToNext("left");
			break
		case "ttb":
			this._setHitZoneToPrevious("top");
			this._setHitZoneToNext("bottom");
			break
		case "btt":
			this._setHitZoneToPrevious("bottom");
			this._setHitZoneToNext("top");
			// Ditto
			break
		}
	}

	_setHitZoneToPrevious(quadrant) {
		this._hitZoneToPrevious = quadrant;
	}

	_setHitZoneToNext(quadrant) {
		this._hitZoneToNext = quadrant;
	}

	_setInScrollDirection(inScrollDirection) {
		this._inScrollDirection = inScrollDirection;
		if (!this._handler || this._handler.type !== "overflowHandler") {
			return
		}
		this._handler.setInScrollDirection(inScrollDirection);
	}

	addSegment(segment, shouldAddSegmentAtStart = false) {
		// Add the segment to the layer pile
		const segmentLayer = new Layer("segment", segment);
		this._addLayer(segmentLayer, shouldAddSegmentAtStart);
	}

	addSnapPointsForLastSegment(snapPointsArray) {
		if (!this._handler || this._handler.type !== "overflowHandler") {
			return
		}
		this._handler.addSnapPointsForLastSegment(snapPointsArray);
	}

	// Used in PageNavigator
	goToSegmentIndex(segmentIndex, isGoingForward = true) {
		if (!this._handler || this._handler.type !== "overflowHandler") {
			return
		}
		this._handler.goToSegmentIndex(segmentIndex, isGoingForward);
	}

	attemptStickyStep() {
		if (!this._handler || this._handler.type !== "overflowHandler") {
			return false
		}
		return this._handler.attemptStickyStep()
	}

	zoom(zoomData) {
		if (!this._handler || this._handler.type !== "overflowHandler") {
			return
		}
		this._handler.zoom(zoomData);
	}

	setPercent(percent) {
		if (!this._handler || this._handler.type !== "overflowHandler") {
			return
		}
		this._handler.setPercent(percent);
	}

	resizePage() {
		const storyNavigator = this._parent;
		if (storyNavigator) {
			storyNavigator.layersArray.forEach((layer) => {
				const { content, isActive } = layer; // content is a Page
				if (content === this && isActive === true) {
					this.resize();
				}
			});
		}
	}

	updateLoadStatus() {
		const oldStatus = this._loadStatus;

		super.updateLoadStatus();

		if (this._loadStatus !== oldStatus && this._doOnPageLoadStatusUpdate) {
			this._doOnPageLoadStatusUpdate(this._pageIndex, this._loadStatus);
		}
	}

}

class Segment extends LayerPile {

	// Used in StoryBuilder
	get segmentIndex() { return this._segmentIndex }

	constructor(segmentIndex, page, sliceLayersArray, player) {
		const { pageIndex } = page;
		const name = `page${pageIndex}Segment${segmentIndex}`;
		const isFirstSliceAParentSlice = (sliceLayersArray.length > 1);
		super(name, page, sliceLayersArray, isFirstSliceAParentSlice);

		this._pageIndex = pageIndex;
		this._segmentIndex = segmentIndex;

		// Add a StateHandler to the Segment if it has multiple layers
		if (sliceLayersArray.length > 1) {
			const shouldStateLayersCoexistOutsideTransitions = true;
			this._addStateHandler(shouldStateLayersCoexistOutsideTransitions, player);
		}

		// It is useful to do the following right away for (double page) empty slices,
		// so that their loadStatus will always be = 2
		this.updateLoadStatus();
	}

}

class StoryBuilder {

	static createPageNavigatorsInfo(storyData) {
		const { metadata, mainLinkObjectsArray, guidedLinkObjectsArray } = storyData || {};
		const {
			readingProgression, continuous, fit, overflow, clipped, spread,
		} = metadata || {};

		const cleanMetadata = {
			direction: readingProgression,
			fit,
			overflow,
			clipped,
		};

		const pageNavigatorsInfo = { metadata: cleanMetadata };

		if (continuous === true) {
			pageNavigatorsInfo.scroll = StoryBuilder.createPageNavigatorInfo("scroll",
				mainLinkObjectsArray);
		} else {
			pageNavigatorsInfo.single = StoryBuilder.createPageNavigatorInfo("single",
				mainLinkObjectsArray);

			// If the double page reading mode is a possibility
			if (spread !== "none") {
				const direction = (readingProgression === "rtl") ? "rtl" : "ltr";
				pageNavigatorsInfo.double = StoryBuilder.createPageNavigatorInfo("double",
					mainLinkObjectsArray, direction);
			}
		}

		if (guidedLinkObjectsArray) {
			pageNavigatorsInfo.guided = StoryBuilder.createPageNavigatorInfo("guided",
				guidedLinkObjectsArray);
		}

		return pageNavigatorsInfo
	}

	static createPageNavigatorInfo(type, linkObjectsArray, direction) {
		let metadata = {};
		let grouping = null;

		switch (type) {
		case "single":
			grouping = "single";
			break
		case "double": // Transitions will be discarded
			metadata = {
				direction, // Force direction to be ltr or rtl
				forcedFit: "contain",
				forcedTransitionType: "cut",
			};
			grouping = "double";
			break
		case "scroll":
			grouping = "stitched";
			break
		case "guided":
			metadata = {
				forcedFit: "contain",
			};
			grouping = "single";
			break
		}

		const pageNavInfo = { metadata };

		let pageIndex = -1;
		let segmentIndex = 0;

		if (grouping === "single" || grouping === "stitched") {
			const transitionsArray = [];

			linkObjectsArray.forEach((linkObject) => {
				const {
					slice, transitionForward, transitionBackward, children,
				} = linkObject;

				// It is time to create a new page...
				if (pageIndex === -1 // ... if we are at the beginning of the story
					|| grouping === "single" // ... or with each new resource in a discontinuous story
					|| transitionForward) { // ... or with each new "chapter" in a "chaptered webtoon"
					pageIndex += 1;
					segmentIndex = 0;
				}

				slice.setPageNavInfo(type, { pageIndex, segmentIndex });

				// Only consider transitions on the first segment of a page
				if (transitionForward && segmentIndex === 0) {
					transitionsArray.push({
						transition: transitionForward, isForward: true, pageIndex,
					});
					if (transitionForward.slice) {
						transitionForward.slice.setPageNavInfo(type, { pageIndex, segmentIndex });
					}
				}
				if (transitionBackward && segmentIndex === 0) {
					transitionsArray.push({
						transition: transitionBackward, isForward: false, pageIndex,
					});
					if (transitionBackward.slice) {
						transitionBackward.slice.setPageNavInfo(type, { pageIndex, segmentIndex });
					}
				}

				// For layer slices
				if (children) {
					children.forEach((child) => {
						if (child.linkObject && child.linkObject.slice) {
							const childSlice = child.linkObject.slice;
							childSlice.setPageNavInfo(type, { pageIndex, segmentIndex });
						}
					});
				}

				segmentIndex += 1;
			});

			pageNavInfo.transitionsArray = transitionsArray;

		} else if (grouping === "double") { // Transitions are discarded in double page reading mode

			let lastPageSide = null;
			let isLonely = false;

			linkObjectsArray.forEach((linkObject, i) => {
				const { slice } = linkObject;
				const { resource } = slice || {};
				const { pageSide } = resource || {};

				if (!lastPageSide
					|| lastPageSide === "center" || lastPageSide === null
					|| pageSide === "center" || pageSide === null
					|| (direction === "ltr" && (lastPageSide === "right" || pageSide === "left"))
					|| (direction === "rtl" && (lastPageSide === "left" || pageSide === "right"))) {

					pageIndex += 1;

					const nextLinkObject = (i < linkObjectsArray.length - 1)
						? linkObjectsArray[i + 1]
						: null;
					const nextPageSide = (nextLinkObject && nextLinkObject.slice
						&& nextLinkObject.slice.resource)
						? nextLinkObject.slice.resource.pageSide
						: null;
					if (direction === "ltr") {
						segmentIndex = (pageSide === "right") ? 1 : 0;
						if (pageSide === "left" && nextPageSide !== "right") {
							isLonely = true;
						}
					} else { // direction === "rtl"
						segmentIndex = (pageSide === "left") ? 1 : 0;
						if (pageSide === "right" && nextPageSide !== "left") {
							isLonely = true;
						}
					}
				}
				slice.setPageNavInfo(type, { pageIndex, segmentIndex, isLonely });

				isLonely = false;
				lastPageSide = pageSide;

				segmentIndex += 1;
			});
		}

		// Do not forget to add the last created page to the list
		pageIndex += 1;

		pageNavInfo.nbOfPages = pageIndex;

		return pageNavInfo
	}

	static createPageNavigator(type, linkObjectsArray, pageNavigatorInfo, defaultMetadata, player) {
		const { metadata, transitionsArray } = pageNavigatorInfo;
		const fullMetadata = {
			...defaultMetadata,
			...metadata,
		};
		const pageLayersArray = StoryBuilder.buildPageLayersArray(type, fullMetadata, linkObjectsArray,
			transitionsArray, player);
		const pageNavigator = new Slideshow(type, fullMetadata, pageLayersArray, player);
		return pageNavigator
	}

	static buildPageLayersArray(type, metadata, linkObjectsArray, transitionsArray, player) {
		const { overflow } = metadata;

		const pagesArray = [];

		let currentPageIndex = -1;
		let currentSegmentIndex = 0;
		let currentPage = null;

		const isADoublePage = (type === "double");

		linkObjectsArray.forEach((linkObject) => {
			const { slice, children, snapPoints } = linkObject;
			const { pageNavInfo } = slice;
			const info = pageNavInfo[type];
			if (info) {
				const { pageIndex, segmentIndex, isLonely } = info;

				if (pageIndex > currentPageIndex) {
					if (currentPage) {
						pagesArray.push(currentPage);
					}
					currentPageIndex += 1;
					currentSegmentIndex = 0;

					currentPage = new Page(currentPageIndex, isADoublePage, overflow, player);
				}

				const sliceLayersArray = [new Layer("slice", slice)];

				if (children) {
					children.forEach((child) => {
						const {
							entryForward, exitForward, entryBackward, exitBackward,
						} = child;
						const layerSlice = child.linkObject.slice;
						const sliceLayer = new Layer("slice", layerSlice);
						if (entryForward) {
							sliceLayer.setEntryForward(entryForward);
						}
						if (exitForward) {
							sliceLayer.setExitForward(exitForward);
						}
						if (entryBackward) {
							sliceLayer.setEntryBackward(entryBackward);
						}
						if (exitBackward) {
							sliceLayer.setExitBackward(exitBackward);
						}
						sliceLayersArray.push(sliceLayer);
					});
				}

				// Now create a segment for the slice and add it to the page
				// (do note that, for a divina, a page can only have several segments if continuous=true)

				let segment = null;

				if (type === "double" && currentSegmentIndex === 0 && segmentIndex === 1) {
					currentSegmentIndex = 1;
					segment = new Segment(currentSegmentIndex, currentPage, sliceLayersArray, player);

					const neighbor = segment;
					StoryBuilder.addEmptySegmentToPage(currentPage, 0, neighbor, player);

				} else {
					segment = new Segment(currentSegmentIndex, currentPage, sliceLayersArray, player);
				}

				currentPage.addSegment(segment);

				// If the linkObject has snapPoints, add them to the page too
				if (snapPoints) {
					currentPage.addSnapPointsForLastSegment(snapPoints);
				}

				if (type === "double" && segmentIndex === 0 && isLonely === true) {
					const neighbor = segment;
					StoryBuilder.addEmptySegmentToPage(currentPage, 1, neighbor, player);
				}

				currentSegmentIndex += 1;
			}
		});

		// Do not forget to add the last created page to the list
		if (currentPage) {
			pagesArray.push(currentPage);
		}

		// Create pageLayerDataArray
		const pageLayersArray = pagesArray.map((page) => (new Layer("page", page)));

		// Now assign entry and exit (half-)transitions
		// If forcedTransitionType === "cut", don't add a transition at all!
		const { forcedTransitionType } = metadata;

		if (!forcedTransitionType && transitionsArray) {
			transitionsArray.forEach(({ transition, isForward, pageIndex }) => {
				const { slice } = transition;
				if (slice) {
					// Set the second page in the readingOrder as parent for a transition slice
					slice.setParent(pagesArray[pageIndex]);
				}

				const { entry, exit } = transition.getEntryAndExitTransitions(isForward);

				if (isForward === true) {
					if (pageIndex > 0) {
						pageLayersArray[pageIndex - 1].setExitForward(exit);
					}
					pageLayersArray[pageIndex].setEntryForward(entry);

				} else {
					if (pageIndex > 0) {
						pageLayersArray[pageIndex - 1].setEntryBackward(entry);
					}
					pageLayersArray[pageIndex].setExitBackward(exit);
				}

			});
		}

		return pageLayersArray
	}

	static addEmptySegmentToPage(page, segmentIndex, neighbor, player) {
		const emptySlice = Slice.createEmptySlice(player, neighbor);
		const emptySliceLayersArray = [new Layer("slice", emptySlice)];
		const emptySegment = new Segment(segmentIndex, page, emptySliceLayersArray, player);
		const shouldAddSegmentAtStart = (segmentIndex === 0);
		page.addSegment(emptySegment, shouldAddSegmentAtStart);
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
		if (callbacksArray) {
			callbacksArray.forEach((callback) => {
				callback(data);
			});
		}
	}

}

class Player {

	// Size of the rootElement (used in Camera)
	get rootSize() { return this._renderer.size }

	// Size of the effective viewport (i.e. once viewport ratio constraint is applied),
	// used in TextureElement, InteractionManager, StateHandler, PageNavigator and Cameram
	get viewportRect() { return this._viewportRect }

	// Used in PageNavigator and Camera
	get options() { return this._options }

	// Used in TextureElement
	get readingMode() { return (this._pageNavigator) ? this._pageNavigator.type : null }

	// Used in PageNavigator
	get interactionManager() { return this._interactionManager }

	// Used in TextureElement and PageNavigator
	get resourceManager() { return this._resourceManager }

	// Used in ResourceManager
	get slices() { return this._slices }

	// Used in Slice

	get pageNavigator() { return this._pageNavigator }

	get tags() { return this._tags }

	// Used in outside app and PageNavigator
	get eventEmitter() { return this._eventEmitter }

	// The rootElement is the parent DOM element (HTML page's body)
	constructor(rootElement) {
		this._rootElement = rootElement;

		// Create the player's renderer
		this._renderer = new Renderer(rootElement, defaultBackgroundColor);

		// Create the container that will hold the loading message
		this._textManager = new TextManager(this._renderer.mainContainer);

		// Create an object that will pass important variables around
		const defaultRect = {
			x: 0, y: 0, width: 0, height: 0,
		};
		this._rootSize = defaultRect;
		this._viewportRect = defaultRect;
		this._tags = {};
		this._options = {};

		// Size those managers
		const shouldResizeImmediately = true;
		this.resize(shouldResizeImmediately);

		// Create the interaction manager (which will deal with user gestures)
		this._interactionManager = new InteractionManager(this, rootElement);

		// Initialize story data
		this._minRatio = null;
		this._maxRatio = null;
		this._spread = defaultSpread;

		this._startHref = null;
		this._haveFirstResourcesLoaded = false;
		this._resourceManager = null;

		this._maxNbOfPagesBefore = 0;
		this._maxNbOfPagesAfter = 0;
		this._priorityFactor = 1;

		this._storyData = {};
		this._slices = {};
		this._pageNavigatorsInfo = {};
		this._pageNavigator = null;
		this._wasDoublePageReadingModeAvailable = false;

		this._eventEmitter = new EventEmitter();

		// Add resize event listener
		this.resize = this.resize.bind(this);
		window.addEventListener("resize", this.resize);
	}

	// The resize function is called on creating the Player
	// and whenever a "resize" event is detected (e.g. after an orientation change)
	resize(shouldResizeImmediately = false) {
		const callback = () => {
			const { width, height } = this._rootElement.getBoundingClientRect();

			// Size viewport based on _rootElement's size (and applicable viewport ratio constraints)
			this._sizeViewport(width, height);

			// Now resize the current pageNavigator if there is one
			if (this._pageNavigator) {
				this._pageNavigator.resize();
			}
			// Note that the list of available story navigators can also be updated
		};
		if (shouldResizeImmediately === true) {
			callback();
		} else {
			requestAnimationFrame(callback);
		}
	}

	// This function sizes the viewport based on _rootElement's size and viewport ratio constraints
	_sizeViewport(width, height) {
		let viewportWidth = width;
		let viewportHeight = height;

		// Get the (target) ratio value that conforms to the viewport ratio constraints
		const applicableRatio = this._getApplicableRatio(width, height);
		const rootElementRatio = width / height;

		const topLeftPoint = { x: 0, y: 0 };

		if (rootElementRatio >= applicableRatio) {
			// The _rootElement's height becomes the viewport's and constrains the viewport's width
			viewportWidth = height * applicableRatio;
			topLeftPoint.x = (width - viewportWidth) / 2;

		} else if (rootElementRatio < applicableRatio) {
			// The _rootElement's width becomes the viewport's and constrains the viewport's height
			viewportHeight = width / applicableRatio;
			topLeftPoint.y = (height - viewportHeight) / 2;
		}

		// Resize the renderer
		this._renderer.setSize(width, height);

		// Store the viewport's rectangle
		this._viewportRect = {
			x: topLeftPoint.x,
			y: topLeftPoint.y,
			width: viewportWidth,
			height: viewportHeight,
		};

		// Update the renderer's display (note that zoomFactor is forced to 1 on a resize)
		this.updateDisplayForZoomFactor(1, this._viewportRect);

		// Update availability of double reading mode if necessary
		if (this._pageNavigator
			&& this._isDoublePageReadingModeAvailable() !== this._wasDoublePageReadingModeAvailable) {

			const customData = { readingMode: this._pageNavigator.type };
			const actualReadingModes = { ...this._pageNavigatorsInfo };
			delete actualReadingModes.metadata;
			if (this._wasDoublePageReadingModeAvailable === true) {
				delete actualReadingModes.double;
				this.setReadingMode("single");
			}
			customData.readingModesArray = Object.keys(actualReadingModes);
			this._eventEmitter.emit("readingmodeupdate", customData);

			this._wasDoublePageReadingModeAvailable = !this._wasDoublePageReadingModeAvailable;
		}
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

	// Used above (after a resize) and in Camera (when changing zoom)
	updateDisplayForZoomFactor(zoomFactor, viewportRect = this._viewportRect) {
		this._renderer.updateDisplay(viewportRect, zoomFactor);
	}

	_isDoublePageReadingModeAvailable() {
		return (this._spread === "both"
			|| (this._spread === "landscape" && this._viewportRect.width >= this._viewportRect.height))
	}

	// For loading the divina data from a manifest path
	openDivinaFromManifestPath(path, href = null, options = null) {
		const textureSource = { folderPath: getFolderPathFromManifestPath(path) };
		const parseAndHandleDivinaData = (divinaParser) => { divinaParser.loadFromPath(path, "manifest"); };
		this._parseDivina(href, textureSource, options, parseAndHandleDivinaData);
	}

	// For loading the divina data from a folder path
	openDivinaFromFolderPath(path, href = null, options = null) {
		const textureSource = { folderPath: path };
		const parseAndHandleDivinaData = (divinaParser) => { divinaParser.loadFromPath(path, "folder"); };
		this._parseDivina(href, textureSource, options, parseAndHandleDivinaData);
	}

	// For loading the divina data from data = { json, base64DataByHref }
	openDivinaFromData(data, href = null, options = null) {
		const textureSource = { data };
		const json = (data && data.json) ? data.json : null;
		const parseAndHandleDivinaData = (divinaParser) => { divinaParser.loadFromJson(json); };
		this._parseDivina(href, textureSource, options, parseAndHandleDivinaData);
	}

	_parseDivina(href = null, textureSource, options, parseAndHandleDivinaData) {
		this._startHref = href;
		this._options = options || {};

		// Set loading properties, which shall be common to all page navigators
		this._setLoadingProperties();

		// Set allowed story interactions based on options
		this._interactionManager.setStoryInteractions(options);

		const updatedTextureSource = textureSource;

		const doWithParsedDivinaData = (parsedDivinaData, updatedFolderPath) => {

			// Create resource manager (now that options and possibly data exist)
			if (updatedFolderPath) {
				updatedTextureSource.folderPath = updatedFolderPath;
			}
			this._createResourceManager(updatedTextureSource);

			const { metadata } = parsedDivinaData || {};
			const { readingProgression, orientation } = metadata || {};
			const customData = { readingProgression, orientation };
			this._eventEmitter.emit("jsonload", customData);

			this._buildStoryFromStoryData(parsedDivinaData);
		};
		const divinaParser = new DivinaParser(this, this._textManager, doWithParsedDivinaData);
		parseAndHandleDivinaData(divinaParser);
	}

	_setLoadingProperties() {
		const { maxNbOfPagesAfter } = this._options || {};
		const nbOfPages = (maxNbOfPagesAfter > 0)
			? maxNbOfPagesAfter
			: defaultMaxNbOfPagesAfter;
		this._maxNbOfPagesAfter = Math.ceil(nbOfPages);
		this._maxNbOfPagesBefore = Math.ceil(this._maxNbOfPagesAfter * maxShareOfPagesBefore);
		this._priorityFactor = (this._maxNbOfPagesAfter / this._maxNbOfPagesBefore) || 1;
	}

	_createResourceManager(textureSource) {
		const doWithLoadPercent = (loadPercent) => {
			if (this._textManager) {
				this._textManager.showMessage({ type: "loading", data: loadPercent });
			}
		};
		this._resourceManager = new ResourceManager(doWithLoadPercent, textureSource, this);
	}

	_buildStoryFromStoryData(storyData) {
		this._storyData = storyData;

		const { metadata, mainLinkObjectsArray, guidedLinkObjectsArray } = storyData;
		const { spread, viewportRatio } = metadata || {};

		// Set spread (used to check whether the double reading mode is available)
		this._spread = spread;

		// Update HTML canvas size to conform to viewportRatio constraints (will trigger a resize)
		this._setRatioConstraint(viewportRatio);

		// Store all slices
		this._slices = this._getSlices(mainLinkObjectsArray, guidedLinkObjectsArray);

		// Store all tags
		const { languagesArray } = metadata;
		this._tags = {
			language: {
				array: languagesArray,
				index: null,
			},
		};
		Player.addTagsForSlices(this._tags, this._slices);

		// Now create build info for all available page navigators
		// (note that _pageNavigatorsInfo.metadata will be a (c)leaner version of the above metadata)
		this._pageNavigatorsInfo = StoryBuilder.createPageNavigatorsInfo(storyData);

		// If required, do something with the information on available reading modes and languages
		const actualReadingModes = { ...this._pageNavigatorsInfo };
		delete actualReadingModes.metadata;

		if (this._pageNavigatorsInfo.double) {
			if (this._isDoublePageReadingModeAvailable() === true) {
				this._wasDoublePageReadingModeAvailable = true;
			} else {
				this._wasDoublePageReadingModeAvailable = false;
				delete actualReadingModes.double;
			}
		}
		const customData = {
			readingModesArray: Object.keys(actualReadingModes),
			languagesArray,
		};
		this._eventEmitter.emit("pagenavigatorscreation", customData);

		// Now build (and set) the page navigator to start with
		if (this._pageNavigatorsInfo.single) {
			this._setPageNavigator("single");
		} else if (this._pageNavigatorsInfo.scroll) {
			this._setPageNavigator("scroll");
		}
	}

	_setRatioConstraint(viewportRatio) {
		if (!viewportRatio) {
			return
		}

		// Parse viewportRatio properties to compute the applicable min and max ratio
		let minRatio;
		let maxRatio;
		const { aspectRatio, constraint } = viewportRatio;
		const ratio = parseAspectRatio(aspectRatio);
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
		const shouldResizeImmediately = true;
		this.resize(shouldResizeImmediately);
	}

	_getSlices(mainLinkObjectsArray, guidedLinkObjectsArray = null) {
		let slices = {};
		const mainSlices = this._getSlicesFromLinkObjectsArray(mainLinkObjectsArray);
		slices = { ...mainSlices };

		if (guidedLinkObjectsArray) {
			const guidedSlices = this._getSlicesFromLinkObjectsArray(guidedLinkObjectsArray);
			slices = {
				...slices,
				...guidedSlices,
			};
		}

		return slices
	}

	_getSlicesFromLinkObjectsArray(linkObjectsArray) {
		let slices = {};
		linkObjectsArray.forEach((linkObject) => {
			const newSlices = this._getSlicesFromLinkObject(linkObject);
			slices = {
				...slices,
				...newSlices,
			};
		});
		return slices
	}

	_getSlicesFromLinkObject(linkObject) {
		let slices = {};
		const {
			slice, transitionForward, transitionBackward, children,
		} = linkObject;
		const { id } = slice;
		slices[id] = slice;

		if (transitionForward && transitionForward.slice) {
			slices[transitionForward.slice.id] = transitionForward.slice;
		}
		if (transitionBackward && transitionBackward.slice) {
			slices[transitionBackward.slice.id] = transitionBackward.slice;
		}

		children.forEach((child) => {
			const childSlices = this._getSlicesFromLinkObject(child.linkObject);
			slices = {
				...slices,
				...childSlices,
			};
		});

		return slices
	}

	static addTagsForSlices(tags, slices) {
		Object.values(slices).forEach((slice) => {
			const { resource, resourcesArray } = slice;
			if (resource) {
				Player.updateTagsArrayForResource(tags, resource);
			} else if (resourcesArray) {
				resourcesArray.forEach((sequenceResource) => {
					Player.updateTagsArrayForResource(tags, sequenceResource);
				});
			}
		});
	}

	static updateTagsArrayForResource(tags, sliceResource) {
		const updatedTags = { ...tags };
		if (sliceResource && sliceResource.usedTags) {
			Object.entries(sliceResource.usedTags).forEach(([tagName, possibleTagValues]) => {
				if (!updatedTags[tagName]) {
					updatedTags[tagName] = {
						array: [],
						index: null,
					};
				}
				possibleTagValues.forEach((tagValue) => {
					if (updatedTags[tagName].array.indexOf(tagValue) < 0) {
						updatedTags[tagName].array.push(tagValue);
					}
				});
			});
		}
		return tags
	}

	// Set the pageNavigator, load its first resources and start playing the story
	_setPageNavigator(pageNavigatorType) {
		const oldPageNavigator = this._pageNavigator;

		const pageNavigatorInfo = this._pageNavigatorsInfo[pageNavigatorType];

		const defaultMetadata = this._pageNavigatorsInfo.metadata;

		const { mainLinkObjectsArray, guidedLinkObjectsArray } = this._storyData;
		if (pageNavigatorType === "guided") {
			this._pageNavigator = StoryBuilder.createPageNavigator(pageNavigatorType,
				guidedLinkObjectsArray, pageNavigatorInfo, defaultMetadata, this);
		} else {
			this._pageNavigator = StoryBuilder.createPageNavigator(pageNavigatorType,
				mainLinkObjectsArray, pageNavigatorInfo, defaultMetadata, this);
		}

		this._pageNavigator.setLoadingProperties(this._maxNbOfPagesBefore, this._maxNbOfPagesAfter);

		// Set language if none has been defined yet (otherwise keep it)
		const { index, array } = this._tags.language;
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
			const shouldUpdatePageNavigator = false;
			this.setLanguage(currentLanguage, shouldUpdatePageNavigator);
		}

		// Repopulate the main container
		this._renderer.mainContainer.addChild(this._pageNavigator);

		// Configure _interactionManager depending on the divina's features
		this._interactionManager.setPageNavigator(this._pageNavigator);

		// Create (or update) the _resourceManager's priority function based on the number of pages,
		// while also (killing tasks and re)building the async task queue (and clearing sliceIdsSets
		// so they can be populated again for the considered pageNavigatorType)
		const maxPriority = this._maxNbOfPagesAfter || this._pageNavigator.nbOfPages;
		this._resourceManager.reset(maxPriority, this._priorityFactor);


		// Get target page and segment indices
		let href = this._startHref;
		if (this._haveFirstResourcesLoaded === true) {
			href = (oldPageNavigator) ? oldPageNavigator.getFirstHrefInCurrentPage() : null;
		}
		const canUseShortenedHref = true;
		const target = this._getTargetPageAndSegmentIndices(href, canUseShortenedHref);

		// Now clean old story navigator
		if (oldPageNavigator) {
			oldPageNavigator.finalizeExit(); // Will also remove its container from its parent
		}

		this._resourceManager.killPendingLoads();

		// Store a list (Set) of used paths
		const oldPathsSet = new Set();
		Object.values(this._slices).forEach((slice) => {
			const pathsArray = slice.unlinkTexturesAndGetPaths();
			pathsArray.forEach((path) => {
				oldPathsSet.add(path);
			});
		});

		// Do any required updates on the calling app side (e.g. color loadViewer cells differently)
		const customData = {
			readingMode: pageNavigatorType,
			nbOfPages: this._pageNavigator.nbOfPages,
		};
		this._eventEmitter.emit("readingmodechange", customData);

		// Populate the resourceManager's textureResources with relevant sliceIds,
		// i.e. only for those slices actually used in this page navigator
		Object.values(this._slices).forEach((slice) => {
			const {
				pageNavInfo, id, resource, resourcesArray,
			} = slice;
			if (pageNavInfo[pageNavigatorType]) { // If slice used in this PageNavigator
				const virtualResourcesArray = resourcesArray || [resource];
				virtualResourcesArray.forEach((virtualResource) => {
					this._resourceManager.storeResourceInfo(virtualResource, id);
				});
			}
		});

		// Create async tasks for destroying and loading resources
		this._pageNavigator.updateLoadTasks(target.pageIndex, oldPathsSet);

		// If the story navigator change occurred before the first resources were loaded
		if (this._haveFirstResourcesLoaded === false) {

			// Add a last task to trigger doAfterInitialLoad and start async queue
			// (if not already running)

			const doAfterLoadingFirstPagesOrSegments = () => {
				this._haveFirstResourcesLoaded = true;

				// Remove the _textManager
				if (this._textManager) {
					this._textManager.destroy();
					this._textManager = null;
				}

				// Signal the end of the initial load
				this._eventEmitter.emit("initialload", {});

				// Now go to required resource in current story navigator
				this._goToTargetPageAndSegmentIndices(target);
			};

			this._resourceManager.addStoryOpenTaskAndLoad(doAfterLoadingFirstPagesOrSegments,
				maxPriority);

		// Otherwise determine what page the new story navigator should start on by getting the href
		// of the first resource in the page (in the old story navigator)
		} else {
			this._goToTargetPageAndSegmentIndices(target);
		}
	}

	// For reaching a specific resource directly in the story (typically via a table of contents,
	// however it is also used as the first step into the story navigation)
	_getTargetPageAndSegmentIndices(targetHref, canUseShortenedHref = false) {
		if (!this._pageNavigator) {
			return { pageIndex: 0, segmentIndex: 0 }
		}
		const { mainLinkObjectsArray, guidedLinkObjectsArray } = this._storyData;
		if (this._pageNavigator.type === "guided") {
			return this._getTargetInLinkObjectsArray(targetHref, canUseShortenedHref,
				guidedLinkObjectsArray)
		}
		return this._getTargetInLinkObjectsArray(targetHref, canUseShortenedHref, mainLinkObjectsArray)
	}

	_getTargetInLinkObjectsArray(targetHref, canUseShortenedHref = false, linkObjectsArray) {
		const targetPath = (canUseShortenedHref === true)
			? getShortenedHref(targetHref) // Which is actually the resource path
			: null;

		let hardTarget = null;
		let softTarget = null;

		linkObjectsArray.forEach((linkObject) => {
			const { slice } = linkObject || {};
			const { resource, pageNavInfo } = slice || {};
			const { href, path } = resource || {};
			if (hardTarget === null && targetHref === href) {
				hardTarget = pageNavInfo[this._pageNavigator.type];
			} else if (softTarget === null && targetPath === path) {
				softTarget = pageNavInfo[this._pageNavigator.type];
			}
		});

		if (hardTarget) {
			return hardTarget
		}
		if (softTarget) {
			return softTarget
		}
		return { pageIndex: 0, segmentIndex: 0 }
	}

	_goToTargetPageAndSegmentIndices(target) {
		const { pageIndex, segmentIndex } = target;

		const shouldSkipTransition = true;
		this._pageNavigator.goToPageWithIndex(pageIndex || 0, segmentIndex, shouldSkipTransition);
	}

	setReadingMode(readingMode) { // Called externally
		if (!readingMode || readingMode === this._pageNavigator.type) {
			return
		}
		this._setPageNavigator(readingMode);
	}

	// Used above or externally (in the latter case the change will be validated here)
	setLanguage(language, shouldUpdatePageNavigator) {
		this.setTag("language", language, shouldUpdatePageNavigator);
	}

	setTag(tagName, tagValue, shouldUpdatePageNavigator = true) {
		if (!this._tags[tagName]) {
			return
		}

		const { array } = this._tags[tagName];
		const index = array.indexOf(tagValue);
		if (index < 0) {
			return
		}

		this._tags[tagName].index = index;

		if (shouldUpdatePageNavigator === true) {
			this._resourceManager.killPendingLoads();

			const oldPathsSet = new Set();
			Object.values(this._slices).forEach((slice) => {
				const pathsArray = slice.unlinkTexturesAndGetPaths();
				pathsArray.forEach((path) => {
					oldPathsSet.add(path);
				});
			});

			// Create async tasks for destroying and loading resources
			const targetPageIndex = null; // Keep the same page index
			this._pageNavigator.updateLoadTasks(targetPageIndex, oldPathsSet);
		}

		if (tagName === "language") {
			const customData = { language: tagValue };
			this._eventEmitter.emit("languagechange", customData);
		}
	}

	// For accessing a resource in the story from the table of contents
	goTo(href, canUseShortenedHref = false) {
		// Get target page and segment indices
		const target = this._getTargetPageAndSegmentIndices(href, canUseShortenedHref);

		// Now go to target page and segment indices
		this._goToTargetPageAndSegmentIndices(target);
	}

	goToPageWithIndex(pageIndex) {
		if (!this._pageNavigator || pageIndex === null || pageIndex === undefined) {
			return
		}
		const segmentIndex = null;
		const shouldSkipTransition = true;
		this._pageNavigator.goToPageWithIndex(pageIndex, segmentIndex, shouldSkipTransition);
	}

	goRight() {
		if (!this._pageNavigator) {
			return
		}
		const shouldGoToTheMax = false;
		this._pageNavigator.go("right", shouldGoToTheMax);
	}

	goLeft() {
		if (!this._pageNavigator) {
			return
		}
		const shouldGoToTheMax = false;
		this._pageNavigator.go("left", shouldGoToTheMax);
	}

	goDown() {
		if (!this._pageNavigator) {
			return
		}
		const shouldGoToTheMax = false;
		this._pageNavigator.go("down", shouldGoToTheMax);
	}

	goUp() {
		if (!this._pageNavigator) {
			return
		}
		const shouldGoToTheMax = false;
		this._pageNavigator.go("up", shouldGoToTheMax);
	}

	goToMaxRight() {
		if (!this._pageNavigator) {
			return
		}
		const shouldGoToTheMax = true;
		this._pageNavigator.go("right", shouldGoToTheMax);
	}

	goToMaxLeft() {
		if (!this._pageNavigator) {
			return
		}
		const shouldGoToTheMax = true;
		this._pageNavigator.go("left", shouldGoToTheMax);
	}

	goToMaxDown() {
		if (!this._pageNavigator) {
			return
		}
		const shouldGoToTheMax = true;
		this._pageNavigator.go("down", shouldGoToTheMax);
	}

	goToMaxUp() {
		if (!this._pageNavigator) {
			return
		}
		const shouldGoToTheMax = true;
		this._pageNavigator.go("up", shouldGoToTheMax);
	}

	setPercentInPage(percent) {
		if (!this._pageNavigator) {
			return
		}
		this._pageNavigator.setPercentInCurrentPage(percent);
	}

	// For exiting the application
	destroy() {
		window.removeEventListener("resize", this.resize);

		if (this._pageNavigator) {
			this._pageNavigator.destroy();
		}

		// Remove textures and event listeners from slices
		Object.values(this._slices).forEach((slice) => {
			slice.destroy();
		});

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

		this._renderer.destroy();
		this._renderer = null;
	}

}

/*! divinaPlayer
 *
 * Copyright (c) 2019 Florian Dupas (Kwalia);
 * Licensed under the MIT license */

module.exports = Player;
//# sourceMappingURL=divina.cjs.js.map
