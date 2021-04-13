import { Texture as PixiTexture, Rectangle as PixiRectangle } from "pixi.js-legacy"

import BaseTexture from "./BaseTexture"

import * as Utils from "../../utils"

export default class Texture {

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
		this._pixiTexture = pixiTexture
		if (video) {
			this._video = video
		}
	}

	// Used in TextureResource
	static createVideoTexture(videoPath) {
		const pixiTexture = PixiTexture.from(videoPath)

		// Prevent autoplay at start
		pixiTexture.baseTexture.resource.autoPlay = false

		const baseTexture = new BaseTexture(pixiTexture.baseTexture)

		const video = pixiTexture.baseTexture.resource.source
		const texture = new Texture(pixiTexture, video)

		return { baseTexture, texture }
	}

	// Used in TextureResource
	static cropToFragment(uncroppedTexture, mediaFragment) {
		const { pixiTexture, video } = uncroppedTexture
		const croppedPixiTexture = pixiTexture.clone()

		const rect = Utils.getRectForMediaFragmentAndSize(mediaFragment, croppedPixiTexture)
		if (rect) {
			const {
				x, y, width, height,
			} = rect
			const frame = new PixiRectangle(x, y, width, height)
			croppedPixiTexture.frame = frame
			croppedPixiTexture.updateUvs()
		}

		const texture = (video)
			? new Texture(croppedPixiTexture, video)
			: new Texture(croppedPixiTexture)

		return texture
	}

	destroy() {
		if (this._pixiTexture) {
			this._pixiTexture.destroy()
		}
		if (this._video) {
			this._video = null
		}
	}

}