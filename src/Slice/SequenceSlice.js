import Slice from "./Slice"

export default class SequenceSlice extends Slice {

	// Used in TagManager
	get arrayOfResourceInfoArray() {
		return this._arrayOfResourceInfoArray
	}

	// Used in LayerTransition
	get canPlay() { return (this._duration > 0 && this._texturesArray.length > 0) }

	constructor(arrayOfResourceInfoArray, properties, player, parentInfo = null) {
		const resourceInfoArray = null
		super(resourceInfoArray, properties, player, parentInfo)

		this._arrayOfResourceInfoArray = arrayOfResourceInfoArray
		const { duration } = properties
		this._duration = duration || 0

		this._type = "sequenceSlice"

		this._hasLoadedOnce = false
		this._texturesArray = []
		this._nbOfFrames = 0
		this._nbOfLoadedFrameTextures = 0
	}

	getResourceIdsToLoad(force = false) {
		if (force === false && (this._loadStatus === 1 || this._loadStatus === 2)) {
			return []
		}

		const resourceDataArray = []
		this._arrayOfResourceInfoArray.forEach((resourceInfoArray) => {
			const { id, fragment } = this._getRelevantResourceIdAndFragment(resourceInfoArray)
			if (id !== null) {
				resourceDataArray.push({ sliceId: this._id, resourceId: id, fragment })
			}
		})

		this._loadStatus = 1
		this._updateParentLoadStatus()
		this._addAndStartLoadingAnimation()
		return [resourceDataArray]
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

		this._loadStatus = (this._texturesArray.length < this._arrayOfResourceInfoArray.length) ? -1 : 2

		this._stopAndRemoveLoadingAnimation()

		this.setTexturesArray(this._texturesArray)
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
						this._setSizeFromActualTexture(width, height)
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
	_getLoadedTexture(resourceInfoArray) {
		const { resourceManager } = this._player
		const { id, fragment } = this._getRelevantResourceIdAndFragment(resourceInfoArray)
		const texture = resourceManager.getTextureWithId(id, fragment)
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
		const fit = pageNavigator.metadata.forcedFit || this._properties.fit
			|| pageNavigator.metadata.fit
		super.resize(fit)
	}

	// Used in Slice
	_getLoadedIds() {
		const idsArray = []
		this._arrayOfResourceInfoArray.forEach((resourceInfoArray) => {
			const { id } = this._getRelevantResourceIdAndFragment(resourceInfoArray)
			if (id !== null) {
				idsArray.push(id)
			}
		})
		return idsArray
	}

	// Used in TextureResource
	removeTexture() {
		this.setTexturesArray(null)
		this._setAsUnloaded()
	}

}