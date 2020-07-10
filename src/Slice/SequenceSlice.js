import Slice from "./Slice"

import * as Utils from "../utils"

export default class SequenceSlice extends Slice {

	// Used below and in Player
	get resourcesArray() {
		const { resourcesArray } = this._resourcesInfo || {}
		return resourcesArray || []
	}

	// Used in StateHandler
	get canPlay() { return (this._duration > 0 && this._texturesArray.length > 0) }

	constructor(resourcesInfo, player) {
		super(resourcesInfo, player)

		this._resourcesInfo = resourcesInfo
		const { duration } = resourcesInfo
		this._duration = (Utils.isANumber(duration) === true && duration > 0) ? duration : 0

		this._type = "sequenceSlice"

		this._hasLoadedOnce = false
		this._texturesArray = []
		this._nbOfFrames = 0
		this._nbOfLoadedFrameTextures = 0
	}

	getPathsToLoad() {
		if (this._loadStatus === 1 || this._loadStatus === 2) {
			return []
		}

		const pathsArray = []
		this.resourcesArray.forEach((resource) => {
			const { path } = this._getRelevantPathAndMediaFragment(resource)
			if (path) {
				pathsArray.push(path)
			}
		})

		this._loadStatus = 1

		return [{ pathsArray, sliceId: this._id }]
	}

	updateTextures() {
		if (!this._duration) {
			return
		}

		this._texturesArray = this._createTexturesArray()
		if (this._texturesArray.length === 0) {
			this._loadStatus = 0
			return
		}

		if (this._texturesArray.length < this.resourcesArray.length) {
			this._loadStatus = -1
		}

		this._loadStatus = 2
		this.setTexturesArray(this._texturesArray)
	}

	_createTexturesArray() {
		let texturesArray = []

		if (this.resourcesArray.length > 0) {

			// Build texturesList
			const texturesList = []
			this.resourcesArray.forEach((resource) => {
				const texture = this._getLoadedTexture(resource)

				if (texture) {
					// Get natural dimensions from the first valid texture in the list
					if (this._hasLoadedOnce === false) {
						this._setSizeFromActualTexture(texture.frame.width, texture.frame.height)
						this._hasLoadedOnce = true
					}
					texturesList.push(texture)
				}
			})

			// Now build texturesArray with time information
			if (texturesList.length > 0) {
				this._nbOfFrames = texturesList.length
				// Compute how long each image will be displayed
				// Note that the textures that have not been created are skipped,
				// meaning that the total number of textures may be less than planned,
				// and thus the time spent on each actual texture longer than expected
				const time = this._duration / texturesList.length
				texturesArray = texturesList.map((texture) => ({ texture, time }))
			}

		}
		return texturesArray
	}

	// The associated texture can either come from an image or fallback image
	_getLoadedTexture(resource) {
		if (!resource || !this.resourceManager) {
			return null
		}
		const { path, mediaFragment } = this._getRelevantPathAndMediaFragment(resource)
		const texture = this.resourceManager.getTextureWithPath(path, mediaFragment)
		return texture
	}

	play() {
		if (!this._playableSprite) {
			return
		}
		this._playableSprite.gotoAndPlay(0)
	}

	stop() {
		if (!this._playableSprite) {
			return
		}
		this._playableSprite.gotoAndStop(0)
	}

	pauseAtPercent(percent) {
		if (!this._playableSprite || this._nbOfFrames < 1) {
			return
		}
		const frameIndex = Math.min(Math.floor(percent * this._nbOfFrames), this._nbOfFrames - 1)
		this._playableSprite.gotoAndStop(frameIndex)
	}

	resize() {
		const { pageNavigator } = this._player
		const fit = pageNavigator.metadata.forcedFit || this._resourcesInfo.fit
			|| pageNavigator.metadata.fit
		super.resize(fit)
	}

	destroyTexturesIfPossible() {
		const pathsArray = this.unlinkTexturesAndGetPaths()
		this.setTexturesArray(null)

		if (this._parent && this._parent.updateLoadStatus) {
			this._parent.updateLoadStatus()
		}

		pathsArray.forEach((path) => {
			this.resourceManager.notifyTextureRemovalFromSlice(path)
		})
	}

	// Used above and in Player
	unlinkTexturesAndGetPaths() {
		if (this._loadStatus === 0) {
			return []
		}

		this._loadStatus = 0

		const pathsArray = []
		this.resourcesArray.forEach((resource) => {
			const { path } = this._getRelevantPathAndMediaFragment(resource)
			if (path) {
				pathsArray.push(path)
			}
		})
		return pathsArray
	}

}