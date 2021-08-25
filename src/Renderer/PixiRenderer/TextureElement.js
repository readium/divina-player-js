import {
	Sprite as PixiSprite,
	AnimatedSprite as PixiAnimatedSprite,
	Texture as PixiTexture,
} from "pixi.js-legacy"

import Container from "./Container"
import LoadingAnimation from "./LoadingAnimation"

import * as Utils from "../../utils"
import * as constants from "../../constants"

export default class TextureElement extends Container {

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
		super()

		this._role = role
		this._player = player
		this._parentInfo = parentInfo

		this._texture = null

		this._sprite = new PixiSprite()
		this._sprite.anchor.set(0.5)
		this._pixiContainer.addChild(this._sprite)

		this._isInViewport = false
		this._sprite.visible = false

		this._playableSprite = null
		this._namePrefix = null

		this._width = 1
		this._height = 1
		this._scale = 1

		this._fit = null
		this._clipped = false

		this._neighbor = null

		this._duration = 0

		this._loadingAnimation = null

		if (this._role === "layersParent") {
			this._sprite.visible = false
		}
	}

	// Used in StoryBuilder
	setNeighbor(neighborSlice) {
		this._neighbor = neighborSlice
	}

	addAndStartLoadingAnimation() {
		if (this._loadingAnimation) {
			return
		}
		this._loadingAnimation = new LoadingAnimation(this, this._scale, this._player)
		this._loadingAnimation.addAndStart()
	}

	stopAndRemoveLoadingAnimation() {
		if (!this._loadingAnimation) {
			return
		}
		this._loadingAnimation.stopAndRemove()
	}

	setSize(size) {
		const { width, height } = size

		// Canvases cannot draw content less than 1 pixel wide and high
		this._width = Math.max(width, 1)
		this._height = Math.max(height, 1)

		this._sprite.width = this._width
		this._sprite.height = this._height

		if (this._playableSprite) {
			this._playableSprite.width = this._width
			this._playableSprite.height = this._height
		}
	}

	assignDummyTexture() {
		this.setTexture(null)
	}

	setTexture(texture) {
		// No need to add a texture to a parent slice
		if (this._role === "layersParent") {
			return
		}
		this._texture = texture
		if (!texture) {
			this.setBackgroundColor(constants.DEFAULT_DUMMY_COLOR)
		} else {
			this._sprite.texture = texture.pixiTexture
			this._setTint(0xFFFFFF)
		}
	}

	setBackgroundColor(color) {
		this._sprite.texture = PixiTexture.WHITE
		const tint = Utils.convertColorStringToNumber(color)
		this._setTint(tint)
	}

	_setTint(tint) {
		this._sprite.tint = tint
	}

	// Used in Slice
	setVideoTexture(videoTexture) {
		this._sprite.texture = null

		if (this._playableSprite) {
			this.pixiContainer.removeChild(this._playableSprite)
		}
		this._playableSprite = PixiSprite.from(videoTexture.pixiTexture)
		this._addPlayableSprite()

		this._playableSprite.visible = this._isInViewport

		this._playableSprite.position = this._sprite.position
	}

	_addPlayableSprite() {
		if (!this._playableSprite) {
			return
		}

		this._playableSprite.anchor.set(0.5)

		// Since a playableSprite for a SequenceSlice has a different way of computing size,
		// the dimensions are applied for a video playableSprite only via setVideoTexture

		const spriteName = `${this.name}PlayableSprite`
		this._playableSprite.name = spriteName

		this.pixiContainer.addChild(this._playableSprite)

		if (this.maskingPixiContainer) {
			this.pixiContainer.addChild(this._maskingPixiContainer)
		}
	}

	// Used in SequenceSlice (since clipped forced to true, a mask will necessarily be created)
	setTexturesArray(texturesArray) {
		this._sprite.texture = null

		// PixiJS does not allow for a direct assignement (playableSprite.textures = texturesArray),
		// so remove the sequence sprite before recreating it
		if (this._playableSprite) {
			this.pixiContainer.removeChild(this._playableSprite)
		}
		if (!texturesArray || texturesArray.length === 0) {
			return
		}
		const pixiTexturesArray = texturesArray.map(({ texture, time }) => (
			{ texture: texture.pixiTexture, time }
		))
		this._playableSprite = new PixiAnimatedSprite(pixiTexturesArray)
		this._addPlayableSprite()
	}

	unsetVideoTexture() {
		if (!this._playableSprite) {
			return
		}
		this.pixiContainer.removeChild(this._playableSprite)
		this._playableSprite.texture = null
	}

	// Used in Container (called with parent = null) and LayerPile (via Slice)
	// Bear in mind that the parent of a layersChild slice is a segment (not the parentSlice!)
	setParent(parent = null) {
		super.setParent(parent)

		// Keep the existing name for a transition slice
		if (!parent || (this.name && this._role === "transition")) {
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
		this.setName(name, suffix)
	}

	resize(fit, clipped) {
		this._fit = fit
		this._clipped = clipped

		this._applyFit(fit)
		if (clipped === true) {
			this._applyClip()
		}

		// If the slice has a parent slice, position it respective to that parent slice
		if (this._role === "layersChild" && this._parentInfo) {
			// Used unclippedSize since to ensure that the position is based
			// on the top left point of the parent slice (instead of the effective viewport)
			const { unclippedSize } = this._parentInfo.slice
			this._sprite.position = {
				x: (this.size.width - unclippedSize.width / this._scaleFactor) / (2 * this._scale),
				y: (this.size.height - unclippedSize.height / this._scaleFactor) / (2 * this._scale),
			}
			if (this._playableSprite) {
				this._playableSprite.position = this._sprite.position
			}
			if (this.maskingPixiContainer) {
				this.maskingPixiContainer.position = this._sprite.position
			}
		}

		if (this._loadingAnimation) {
			this._loadingAnimation.resize(this._scale)
		}
	}

	_applyFit(fit) {
		if (!this._width || !this._height
			|| this._role === "layersChild") { // Scale will remain at 1 for a child
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
			if (this._scale !== scale) { // So as not to trigger an infinite loop
				this.setScale(scale)
				if (this.parent) {
					this.parent.resizePage()
				}
			}
		} else {
			this.setScale(scale)
		}
	}

	_getWidthForHalfSegmentSlice(width) {
		let actualWidth = width
		if (this._role === "empty" && this._neighbor) {
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
		const { viewportRect } = this._player
		const { width, height } = viewportRect
		// Only add a mask if it's absolutely necessary (since masks do have a cost in performance)
		if (this._fit === "contain"
			|| (this._width / this._height) <= ((width + constants.POSSIBLE_PIXEL_ERROR) / height)) {
			return
		}
		if (!this.maskingPixiContainer) {
			this.addMask()
		}

		this.setMaskRect((-width / this._scale) / 2, (-height / this._scale) / 2,
			width / this._scale, height / this._scale)
	}

	// Used in TextSlice
	applySizeClip() {
		if (!this.maskingPixiContainer) {
			this.addMask()
		}
		this.setMaskRect(-this._width / 2, -this._height / 2, this._width, this._height)
	}

	// Used in Layer
	setIsInViewport(isInViewport) {
		if (isInViewport !== this._isInViewport) {
			this._sprite.visible = isInViewport
			if (this._playableSprite) {
				this._playableSprite.visible = isInViewport
			}
		}
		this._isInViewport = isInViewport
	}

	// Used in SequenceSlice

	goToFrameAndPlay(frameIndex) {
		if (!this._playableSprite) {
			return
		}
		this._playableSprite.gotoAndPlay(frameIndex)
	}

	goToFrameAndStop(frameIndex) {
		if (!this._playableSprite) {
			return
		}
		this._playableSprite.gotoAndStop(frameIndex)
	}

	// Used in Slice on final destroy
	destroy() {
		this._sprite.texture = null
		if (this._playableSprite) {
			this._playableSprite.texture = null
		}
	}

}