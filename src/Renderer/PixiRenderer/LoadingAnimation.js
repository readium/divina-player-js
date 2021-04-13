import {
	Graphics as PixiGraphics,
	Texture as PixiTexture,
	Ticker as PixiTicker,
} from "pixi.js-legacy"

import * as constants from "../../constants"

// Used in TextureElement

export default class LoadingAnimation {

	constructor(parentContainer, parentContainerScale = 1, player, name) {
		this._parentContainer = parentContainer
		this._parentContainerScale = parentContainerScale
		this._name = name
		this._player = player

		this._ticker = new PixiTicker()
		this._ticker.stop()
		this._isPlaying = false
		this._rotation = 0
		this._tickerFunction = () => {
			if (!this._loadingAnimationGraphics || this._isPlaying === false) {
				return
			}
			this._loadingAnimationGraphics.rotation += constants.ROTATION_BY_TICK
		}
		this._ticker.add(this._tickerFunction)
	}

	_updateGraphics() {
		if (this._loadingAnimationGraphics) {
			this._parentContainer.removeChild(this._loadingAnimationGraphics)
		}

		const { LINE_WIDTH, SIZE_COEFFICIENT } = constants

		this._loadingAnimationGraphics = new PixiGraphics()
		this._loadingAnimationGraphics.name = `${this._name}LoadingAnimation`
		this._parentContainer.addChild(this._loadingAnimationGraphics)
		const lineTextureStyle = { width: LINE_WIDTH, texture: PixiTexture.WHITE }
		this._loadingAnimationGraphics.lineTextureStyle(lineTextureStyle)

		const { viewportRect } = this._player
		const { width, height } = viewportRect
		const radius = Math.min(width, height) * SIZE_COEFFICIENT
		const endAngle = -Math.PI / 3
		this._loadingAnimationGraphics.arc(0, 0, radius, 0, endAngle)

		this._loadingAnimationGraphics.scale.set(1 / this._parentContainerScale)
	}

	addAndStart() {
		this._ticker.start()
		this._isPlaying = true
		this._updateGraphics()
	}

	resize(parentContainerScale) {
		if (this._parentContainerScale === parentContainerScale) {
			return
		}
		this._parentContainerScale = parentContainerScale
		if (this._isPlaying === true) {
			this._updateGraphics()
		}
	}

	stopAndRemove() {
		this._isPlaying = false
		this._ticker.stop()
		if (this._loadingAnimationGraphics) {
			this._parentContainer.removeChild(this._loadingAnimationGraphics)
			this._loadingAnimationGraphics = null
		}
	}

}