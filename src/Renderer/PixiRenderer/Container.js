import { Container as PixiContainer, Graphics as PixiGraphics } from "pixi.js-legacy"

export default class Container {

	// Used in TextElement, TextureElement and LoadingAnimation
	get name() { return this._name }

	// Used in TextElement, TextureElement and LayerPile (parent is a Container, not a PixiContainer!)
	get parent() { return this._parent }

	// Used below and in LoadingAnimation
	get pixiContainer() { return this._pixiContainer }

	// Used in TextureElement
	get maskingPixiContainer() { return this._maskingPixiContainer }

	constructor(type = null, name = null, parent = null, pixiContainer = null) {
		this._type = type
		this._pixiContainer = pixiContainer || new PixiContainer()
		this.setName(name)
		if (parent) {
			parent.addChild(this)
		}

		this._maskingPixiContainer = null
		this._mask = null

		this._position = { x: 0, y: 0 }

		this._scaleFactor = 1
		this._scale = 1

		this._isXPositionUpdating = false
		this._isYPositionUpdating = false
	}

	setName(name, suffix = null) {
		this._name = name
		if (this._pixiContainer) {
			this._pixiContainer.name = name
			if (suffix !== null) {
				this._pixiContainer.name += suffix
			}
		}
		if (this._maskingPixiContainer) {
			this._setMaskingPixiContainerName()
			this._setMaskName()
		}
	}

	_setMaskingPixiContainerName() {
		this._maskingPixiContainer.name = `${this._name}MaskingContainer`
	}

	_setMaskName() {
		this._mask.name = `${this._name}Mask`
	}

	// Used here and in Player (on changing page navigators)
	addChild(child) {
		const { pixiContainer } = child
		this._pixiContainer.addChild(pixiContainer)
		child.setParent(this)
	}

	// Used here, in TextureElement and LayerPile
	setParent(parent) {
		this._parent = parent
	}

	// Mask functions are used in Renderer and TextureElement

	addMask() {
		this._maskingPixiContainer = new PixiContainer()
		this._setMaskingPixiContainerName()
		this._pixiContainer.addChild(this._maskingPixiContainer)
	}

	setMaskRect(x, y, w, h) {
		if (!this._maskingPixiContainer) {
			return
		}
		// The mask is recreated with each resize (it works better)

		// Remove the mask and create it again
		this._maskingPixiContainer.removeChildren()
		this._mask = new PixiGraphics()
		this._setMaskName()
		this._maskingPixiContainer.addChild(this._mask)
		this._pixiContainer.mask = this._mask

		// Redraw the mask at the right size
		this._mask.beginFill(0)
		this._mask.drawRect(x, y, w, h)
		this._mask.endFill()
	}

	removeMask() {
		this._pixiContainer.mask = null
		if (this._mask) {
			this._maskingPixiContainer.removeChild(this._mask)
			this._mask = null
		}
		if (this._maskingPixiContainer) {
			this._pixiContainer.removeChild(this._maskingPixiContainer)
			this._maskingPixiContainer = null
		}
	}

	// Used in Renderer to update the content container on a resize
	setPivot(pivot) {
		this._pixiContainer.pivot = pivot
	}

	// Used on destroying TextManager, on changing page navigators and in StateHandler
	removeFromParent() {
		if (!this._parent) {
			return
		}
		const { pixiContainer } = this._parent
		this.setParent(null)
		if (!pixiContainer || !this._pixiContainer) {
			return
		}
		pixiContainer.removeChild(this._pixiContainer)
	}

	// Used in StateHandler and LayerPile
	addChildAtIndex(container, index) {
		// First store child PixiJS containers above index value away
		const { children } = this._pixiContainer
		let i = children.length
		const zIndex = Math.min(Math.max(index, 0), i)
		const tmpPixiContainer = new PixiContainer()
		i -= 1
		while (i >= 0 && zIndex <= i) {
			const child = children[i]
			tmpPixiContainer.addChild(child)
			i -= 1
		}
		// Now add the new child
		this.addChild(container)
		// Finally put child PixiJS containers back
		const childrenToPutBack = [...tmpPixiContainer.children].reverse()
		childrenToPutBack.forEach((child) => {
			this._pixiContainer.addChild(child)
		})
	}

	// Functions used in Player (for zoom)

	getPosition() {
		const { x, y } = this._pixiContainer
		return { x, y }
	}

	// Functions used in Slice

	setAlpha(alpha) { // Also used in StateHandler (for transitions)
		this._pixiContainer.alpha = alpha
	}

	setX(x) {
		this._position.x = x * this._scale
		this._pixiContainer.x = x * this._scale
	}

	setY(y) {
		this._position.y = y * this._scale
		this._pixiContainer.y = y * this._scale
	}

	setScaleFactor(scaleFactor) {
		if (!scaleFactor) {
			return
		}
		this._scaleFactor = scaleFactor
		const actualScale = this._scale * this._scaleFactor
		this._pixiContainer.scale.set(actualScale)
	}

	// Beware: rotations apply to sprites, not to their enclosing pixiContainer
	setRotation(rotation) {
		if (this._playableSprite) {
			this._playableSprite.rotation = rotation
		} else {
			this._sprite.rotation = rotation
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
		this._position = position
		if (this._isXPositionUpdating === false) {
			this._pixiContainer.position.x = position.x
		}
		if (this._isYPositionUpdating === false) {
			this._pixiContainer.position.y = position.y
		}
	}

	// Functions used in StateHandler to handle transitions

	resetPosition() {
		this.setPosition(this._position)
	}

	setIsXPositionUpdating(isXPositionUpdating) {
		this._isXPositionUpdating = isXPositionUpdating
	}

	setIsYPositionUpdating(isYPositionUpdating) {
		this._isYPositionUpdating = isYPositionUpdating
	}

	setXOffset(xOffset) {
		this._pixiContainer.position.x = this._position.x + xOffset
	}

	setYOffset(yOffset) {
		this._pixiContainer.position.y = this._position.y + yOffset
	}

	setVisibility(shouldBeVisible) {
		this._pixiContainer.visible = shouldBeVisible
	}

	// Used in TextureElement - and in Layer to handle (a multi-layered segment's) slice layers
	setScale(scale) {
		if (!scale) {
			return
		}
		this._scale = scale
		const actualScale = this._scale * this._scaleFactor
		this._pixiContainer.scale.set(actualScale)
	}

	// Used in Segment
	clipToSize(size) {
		if (!this._maskingPixiContainer) {
			this.addMask()
		}
		const { width, height } = size
		this.setMaskRect(-width / 2, -height / 2, width, height)
	}

}