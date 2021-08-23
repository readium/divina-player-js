import Slice from "./Slice"

export default class SequenceSlice extends Slice {

	// Used in TagManager
	get arrayOfResourceInfoArray() {
		return this._arrayOfResourceInfoArray
	}

	// Used in LayerTransition
	get canPlay() { return (this._duration > 0 && this._texturesArray.length > 0) }

	constructor(resourceInfoArray, arrayOfResourceInfoArray, properties, player, parentInfo = null) {
		super(resourceInfoArray, properties, player, parentInfo)

		this._arrayOfResourceInfoArray = arrayOfResourceInfoArray
		const { duration } = properties
		this._duration = duration || 0

		this._type = "sequenceSlice"

		this._hasLoadedOnce = false
		this._texturesArray = []
		this._nbOfFrames = 0
		this._nbOfLoadedFrameTextures = 0

		this._stepDuration = null
	}

	getResourceIdsToLoad(force = false) {
		if (force === false && (this.loadStatus === 1 || this.loadStatus === 2)) {
			return []
		}

		const resourceDataArray = []
		this._arrayOfResourceInfoArray.forEach((resourceInfoArray) => {
			const { id, fragment } = this.getRelevantResourceIdAndFragment(resourceInfoArray)
			if (id !== null) {
				resourceDataArray.push({ sliceId: this._id, resourceId: id, fragment })
			}
		})

		this.loadStatus = 1
		this._updateParentLoadStatus()
		this.addAndStartLoadingAnimation()
		return [resourceDataArray]
	}

	updateTextures() {
		if (!this._duration) {
			return
		}

		this._texturesArray = this._createTexturesArray()
		if (this._texturesArray.length === 0) {
			this.loadStatus = 0
			return
		}

		this.loadStatus = (this._texturesArray.length < this._arrayOfResourceInfoArray.length) ? -1 : 2

		this.stopAndRemoveLoadingAnimation()

		this.setTexturesArray(this._texturesArray)
		// Note: No need to refresh the player (Slice's setVisibility will deal with it)
	}

	_createTexturesArray() {
		let texturesArray = []

		if (this._arrayOfResourceInfoArray.length > 0) {

			// Build texturesList
			const texturesList = []
			this._arrayOfResourceInfoArray.forEach((resourceInfoArray) => {
				const texture = this._getLoadedTexture(resourceInfoArray)

				if (texture) {
					// Get natural dimensions from the first valid texture in the list
					if (this._hasLoadedOnce === false) {
						const { size } = texture
						const { width, height } = size
						this.setSizeFromActualTexture(width, height)
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
				this._stepDuration = this._duration / texturesList.length
				texturesArray = texturesList.map((texture) => ({ texture, time: this._stepDuration }))
			}

		}
		return texturesArray
	}

	// The associated texture can either come from an image or fallback image
	_getLoadedTexture(resourceInfoArray) {
		const { resourceManager } = this.player
		const { id, fragment } = this.getRelevantResourceIdAndFragment(resourceInfoArray)
		const texture = resourceManager.getTextureWithId(id, fragment)
		return texture
	}

	play() {
		if (!this.goToFrameAndPlay) {
			return
		}
		this.goToFrameAndPlay(0)
		this._playLoop = setInterval(() => {
			if (this.isInViewport === true) {
				this.player.refreshOnce()
			}
		}, this._stepDuration)
	}

	stop() {
		if (!this.goToFrameAndStop) {
			return
		}
		this.goToFrameAndStop(0)
		this._destroyPlayLoop()
	}

	_destroyPlayLoop() {
		clearInterval(this._playLoop)
		this._playLoop = null
	}

	pauseAtPercent(percent) {
		if (!this.goToFrameAndStop || this._nbOfFrames < 1) {
			return
		}
		const frameIndex = Math.min(Math.floor(percent * this._nbOfFrames), this._nbOfFrames - 1)
		this.goToFrameAndStop(frameIndex)
		this._destroyPlayLoop()
	}

	resize() {
		const { pageNavigator } = this.player
		const fit = pageNavigator.metadata.forcedFit || this.properties.fit
			|| pageNavigator.metadata.fit
		super.resize(fit)
	}

	// Used in Slice
	_getLoadedIds() {
		const idsArray = []
		this._arrayOfResourceInfoArray.forEach((resourceInfoArray) => {
			const { id } = this.getRelevantResourceIdAndFragment(resourceInfoArray)
			if (id !== null) {
				idsArray.push(id)
			}
		})
		return idsArray
	}

	// Used in TextureResource
	removeTexture() {
		this.setTexturesArray(null)
		this.setAsUnloaded()
	}

	destroy() {
		this._destroyPlayLoop()
		super.destroy()
	}

}