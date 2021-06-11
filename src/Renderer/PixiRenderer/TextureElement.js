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
	get unscaledSize() {
		return { width: this._width, height: this._height }
	}

	constructor(role, player, parentInfo = null) {
		super()

		this._role = role
		this._player = player
		this._parentInfo = parentInfo

		this._texture = null

		this._sprite = new PixiSprite()
		this._sprite.anchor.set(0.5)
		this._pixiContainer.addChild(this._sprite)

		this._playableSprite = null
		this._namePrefix = null

		this._width = 1
		this._height = 1
		this._scale = 1

		this._clipped = false

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

	_addAndStartLoadingAnimation() {
		if (this._loadingAnimation) {
			return
		}
		this._loadingAnimation = new LoadingAnimation(this._pixiContainer, this._scale, this._player,
			this._name)
		this._loadingAnimation.addAndStart()
	}

	_stopAndRemoveLoadingAnimation() {
		if (!this._loadingAnimation) {
			return
		}
		this._loadingAnimation.stopAndRemove()
	}

	_setSize(size) {
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

	_assignDummyTexture() {
		this._setTexture(null)
	}

	_setTexture(texture) {
		// No need to add a texture to a parent slice
		if (this._role === "layersParent") {
			return
		}
		this._texture = texture
		if (!texture) {
			this._setBackgroundColor(constants.DEFAULT_DUMMY_COLOR)
		} else {
			this._sprite.texture = texture.pixiTexture
			this._setTint(0xFFFFFF)
		}
	}

	_setBackgroundColor(color) {
		this._sprite.texture = PixiTexture.WHITE
		const tint = Utils.convertColorStringToNumber(color)
		this._setTint(tint)
	}

	_setTint(tint) {
		this._sprite.tint = tint
	}

	// Used in Slice
	_setVideoTexture(videoTexture) {
		this._sprite.texture = null

		if (this._playableSprite) {
			this._pixiContainer.removeChild(this._playableSprite)
		}
		this._playableSprite = PixiSprite.from(videoTexture.pixiTexture)
		this._addPlayableSprite()

		this._playableSprite.position = this._sprite.position
	}

	_addPlayableSprite() {
		if (!this._playableSprite) {
			return
		}

		this._playableSprite.anchor.set(0.5)

		// Since a playableSprite for a SequenceSlice has a different way of computing size,
		// the dimensions are applied for a video playableSprite only via _setVideoTexture

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

	_unsetVideoTexture() {
		if (!this._playableSprite) {
			return
		}
		this._pixiContainer.removeChild(this._playableSprite)
		this._playableSprite.texture = null
	}

	// Used in Container (called with parent = null) and LayerPile (via Slice)
	// Bear in mind that the parent of a layersChild slice is a segment (not the parentSlice!)
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
		if (this._role === "layersChild" && this._parentInfo) {
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
		if (!this._maskingPixiContainer) {
			this.addMask()
		}
		const { viewportRect } = this._player
		const { width, height } = viewportRect
		this.setMaskRect((-width / this._scale) / 2, (-height / this._scale) / 2,
			width / this._scale, height / this._scale)
	}

	_applySizeClip() {
		if (!this._maskingPixiContainer) {
			this.addMask()
		}
		this.setMaskRect(-this._width / 2, -this._height / 2, this._width, this._height)
	}

	// Used in Slice on final destroy
	destroy() {
		this._sprite.texture = null
		if (this._playableSprite) {
			this._playableSprite.texture = null
		}
	}

}