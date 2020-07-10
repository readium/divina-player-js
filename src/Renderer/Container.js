import { Container as PIXIContainer, Graphics as PIXIGraphics } from "pixi.js-legacy"

export default class Container {

	// Used in TextureElement
	get name() { return this._name }

	// Used in LayerPile (note that parent below is a Container, not a PIXIContainer)
	get parent() { return this._parent }

	// Used in Camera
	get positionInSegmentLine() { return this._positionInSegmentLine }

	// Used below
	get pixiContainer() { return this._pixiContainer }

	constructor(name = null, parent = null, pixiContainer = null) {
		this._pixiContainer = pixiContainer || new PIXIContainer()
		this._setName(name)

		if (parent) {
			parent.addChild(this)
		}

		this._maskingPixiContainer = null
		this._mask = null

		this._position = { x: 0, y: 0 }
		this._positionInSegmentLine = { x: 0, y: 0 }

		this._scale = 1

		this._isXPositionUpdating = false
		this._isYPositionUpdating = false
	}

	_setName(name, suffix = null) {
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
		this._maskingPixiContainer = new PIXIContainer()
		this._setMaskingPixiContainerName()
		this._pixiContainer.addChild(this._maskingPixiContainer)
	}

	setMaskRect(x, y, w, h) {
		// The mask is recreated with each resize (it works better)

		// Remove the mask and create it again
		this._maskingPixiContainer.removeChildren()
		this._mask = new PIXIGraphics()
		this._setMaskName()
		this._maskingPixiContainer.addChild(this._mask)
		this._pixiContainer.mask = this._mask

		// Redraw the mask at the right size
		this._mask.beginFill(0x000000)
		this._mask.drawRect(x, y, w, h)
		this._mask.endFill()
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
		// First store child PIXI containers above index value away
		const { children } = this._pixiContainer
		let i = children.length
		const zIndex = Math.min(Math.max(index, 0), i)
		const tmpPixiContainer = new PIXIContainer()
		i -= 1
		while (i >= 0 && zIndex <= i) {
			const child = children[i]
			tmpPixiContainer.addChild(child)
			i -= 1
		}
		// Now add the new child
		this.addChild(container)
		// Finally put child PIXI containers back
		const childrenToPutBack = [...tmpPixiContainer.children].reverse()
		childrenToPutBack.forEach((child) => {
			this._pixiContainer.addChild(child)
		})
	}

	// Functions used in OverflowHandler to layout segments

	setPositionInSegmentLine(positionInSegmentLine) {
		this._positionInSegmentLine = positionInSegmentLine
	}

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

	setAlpha(alpha) {
		this._pixiContainer.alpha = alpha
	}

	setVisibility(shouldBeVisible) {
		this._pixiContainer.visible = shouldBeVisible
	}

	// Used in Layer to handle (a multi-layered segment's) slice layers
	setScale(scale) {
		if (!scale) {
			return
		}
		this._pixiContainer.scale.set(scale)
		this._scale = scale
	}

}