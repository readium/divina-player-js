import { Texture as PIXITexture, Rectangle as PIXIRectangle } from "pixi.js-legacy"

import * as Utils from "../utils"

// A texture stored in the Loader will need to have the following properties:
// - If it corresponds to an image: .frame.width and .frame.height
// - If it corresponds to a video: .video (the video itself will need to be a videoElement,
//   i.e. it should include videoWidth, videoHeight and duration properties)

export default class Texture {

	// Used in TextureResource
	static createVideoTexture(videoPath) {
		const texture = PIXITexture.from(videoPath)
		// Prevent autoplay at start
		texture.baseTexture.resource.autoPlay = false
		// Store a reference to video at texture level for convenience
		const video = texture.baseTexture.resource.source
		texture.baseTexture.video = video
		texture.video = video
		return texture
	}

	// Used in TextureResource
	static cropToFragment(uncroppedTexture, mediaFragment) {
		const texture = uncroppedTexture.clone()

		const rect = Utils.getRectForMediaFragmentAndSize(mediaFragment, texture)
		if (rect) {
			const {
				x, y, width, height,
			} = rect
			const frame = new PIXIRectangle(x, y, width, height)
			texture.frame = frame
			texture.updateUvs()
		}

		return texture
	}

}