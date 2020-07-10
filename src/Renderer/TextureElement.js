import {
	Sprite as PIXISprite,
	AnimatedSprite as PIXIAnimatedSprite,
	Texture as PIXITexture,
} from "pixi.js-legacy"

import Container from "./Container"

import * as constants from "../constants"

export default class TextureElement extends Container {

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
			const { viewportRect } = this._player
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
		super()

		this._role = (resource) ? resource.role : null
		this._player = player
		this._parentInfo = parentInfo
		this._neighbor = neighbor

		this._sprite = new PIXISprite()
		this._sprite.anchor.set(0.5)
		this._pixiContainer.addChild(this._sprite)

		this._playableSprite = null
		this._namePrefix = null

		this._width = 0
		this._height = 0
		this._scale = 1

		this._clipped = false

		this._duration = 0

		// Set a (surely temporary) size
		const { viewportRect } = player
		const { width, height } = resource || {}
		const actualWidth = (width > 0) ? width : viewportRect.width
		const actualHeight = (height > 0) ? height : viewportRect.height
		this._setSize({ width: actualWidth, height: actualHeight })

		if (this._role === "layersParent") {
			this._sprite.visible = false
		}
	}

	_setSize(size) {
		const { width, height } = size

		this._width = width
		this._height = height

		this._sprite.width = width
		this._sprite.height = height

		if (this._playableSprite) {
			this._playableSprite.width = this._width
			this._playableSprite.height = this._height
		}
	}

	_assignDummyTexture() {
		this._setTexture(PIXITexture.WHITE)
		this._setTint(constants.defaultDummyColor)
	}

	_setTexture(texture) {
		// No need to add a texture to a parent slice
		if (this._role === "layersParent") {
			return
		}
		if (!texture) {
			this._assignDummyTexture()
		} else {
			this._sprite.texture = texture
			this._setTint(0xFFFFFF)
		}
	}

	_setTint(tint) {
		this._sprite.tint = tint
	}

	_assignEmptyTexture() {
		this._setTexture(PIXITexture.WHITE)
		this._setTint(constants.defaultBackgroundColor)
	}

	_setVideoTexture(texture) {
		this._sprite.texture = null
		if (!this._playableSprite) {
			this._addPlayableSprite()
		}
		this._playableSprite.texture = texture
	}

	_addPlayableSprite(texturesArray = null) {
		if (texturesArray && texturesArray.length > 0) { // For a sequence slice
			this._playableSprite = new PIXIAnimatedSprite(texturesArray)
		} else { // For a video slice
			this._playableSprite = new PIXISprite()
		}
		this._playableSprite.anchor.set(0.5)

		const spriteName = `${this._name}PlayableSprite`
		this._playableSprite.name = spriteName

		this._pixiContainer.addChild(this._playableSprite)

		if (this._maskingPixiContainer) {
			this._pixiContainer.addChild(this._maskingPixiContainer)
		}
	}

	// Used in SequenceSlice (since clipped forced to true, a mask will necessarily be created)
	setTexturesArray(texturesArray) {
		this._sprite.texture = null
		// PixiJS does not allow for a direct assignement (playableSprite.textures = texturesArray),
		// so remove the sequence sprite before recreating it
		if (this._playableSprite) {
			this._pixiContainer.removeChild(this._playableSprite)
			this._playableSprite = null
		}
		this._addPlayableSprite(texturesArray)
	}

	// Used in Container (called with parent = null) and LayerPile (via Slice)
	// Bear in mind that the parent of a layersLayer slice is a segment (not the parentSlice!)
	setParent(parent = null) {
		super.setParent(parent)

		// Keep the existing name for a transition slice
		if (!parent || (this._name && this._role === "transition")) {
			return
		}

		let { name } = parent
		if (this._parentInfo) {
			name += `Layer${this._parentInfo.layerIndex}`
		}
		if (this._role === "transition") {
			name += "Transition"
		}
		this._sprite.name = `${name}Sprite`
		const suffix = "Slice"
		this._setName(name, suffix)
	}

	resize(fit, clipped) {
		this._clipped = clipped

		this._applyFit(fit)
		if (clipped === true) {
			this._applyClip()
		}

		// If the slice has a parent slice, position it respective to that parent slice
		if (this._role === "layersLayer" && this._parentInfo) {
			// Used unclippedSize since to ensure that the position is based
			// on the top left point of the parent slice (instead of the effective viewport)
			const { unclippedSize } = this._parentInfo.slice
			this._sprite.position = {
				x: (this.size.width - unclippedSize.width) / (2 * this._scale),
				y: (this.size.height - unclippedSize.height) / (2 * this._scale),
			}
			if (this._playableSprite) {
				this._playableSprite.position = this._sprite.position
			}
			if (this._maskingPixiContainer) {
				this._maskingPixiContainer.position = this._sprite.position
			}
		}
	}

	_applyFit(fit) {
		if (!this._width || !this._height
			|| this._role === "layersLayer") { // Scale will remain at 1 for a child
			return
		}

		const ratio = this._width / this._height
		const { viewportRect } = this._player
		const { height } = viewportRect
		let { width } = viewportRect

		// In double reading mode, fit the resource inside a rectangle half the viewport width (maximum)
		if (this._player.readingMode === "double") {
			width = this._getWidthForHalfSegmentSlice(width)
		}

		// Compute the scale to be applied to the container based on fit
		const viewportRatio = width / height
		let scale = 1
		switch (fit) {
		case "height":
			scale = this._getScaleWhenForcingHeight(height)
			break
		case "width":
			scale = this._getScaleWhenForcingWidth(width)
			break
		case "contain":
			if (ratio >= viewportRatio) {
				scale = this._getScaleWhenForcingWidth(width)
			} else {
				scale = this._getScaleWhenForcingHeight(height)
			}
			break
		case "cover":
			if (ratio >= viewportRatio) {
				scale = this._getScaleWhenForcingHeight(height)
			} else {
				scale = this._getScaleWhenForcingWidth(width)
			}
			break
		default:
			break
		}

		// Now apply the scale to the container
		if (this._role === "layersParent") {
			if (this._scale !== scale) { // To prevent triggering an infinite loop
				this.setScale(scale)
				if (this._parent) {
					this._parent.resizePage()
				}
			}
		} else {
			this.setScale(scale)
		}
	}

	_getWidthForHalfSegmentSlice(width) {
		let actualWidth = width
		if (this._neighbor) {
			const { size } = this._neighbor
			actualWidth = Math.min(width / 2, size.width)
		} else {
			actualWidth /= 2
		}
		return actualWidth
	}

	_getScaleWhenForcingHeight(viewportHeight) {
		const scale = viewportHeight / this._height
		return scale
	}

	_getScaleWhenForcingWidth(viewportWidth) {
		const scale = viewportWidth / this._width
		return scale
	}

	// Size the clipping mask based on viewport size if the resource needs to be clipped
	_applyClip() {
		if (!this._maskingPixiContainer) {
			this.addMask()
		}
		const { viewportRect } = this._player
		const { width, height } = viewportRect
		this.setMaskRect((-width / this._scale) / 2, (-height / this._scale) / 2,
			width / this._scale, height / this._scale)
	}

	// Used in Slice on final destroy
	destroy() {
		this._sprite.texture = null
		if (this._playableSprite) {
			this._playableSprite.texture = null
		}
	}

}