import { TextureElement } from "../Renderer"

import * as constants from "../constants"

// Note that size is obtained from underlying TextureElement

export default class Slice extends TextureElement {

	// Used in Player
	get id() { return this._id }

	// Used in TagManager
	get resourceInfoArray() { return this._resourceInfoArray }

	// Used in StoryBuilder and Player
	get pageNavInfo() { return this._pageNavInfo }

	// Used in StoryBuilder
	get pageSide() { return (this._properties) ? this._properties.pageSide : null }

	// Used in StateHandler
	get canPlay() { return (this._duration > 0) }

	// Used in SequenceSlice, Layer and ResourceManager
	get loadStatus() { return this._loadStatus }

	// Used in TextSlice
	get hasVariableSize() {
		return (!this._referenceSize
			|| (this._referenceSize.width === null || this._referenceSize.height === null))
	}

	// Used in TextureResource
	get isActive() {
		if (!this.parent) {
			return true
		}
		const { pageNavigator } = this.player
		const { segmentRange } = pageNavigator
		const { startIndex, endIndex } = segmentRange
		const { segmentIndex } = this.parent
		return (segmentIndex >= startIndex && segmentIndex <= endIndex)
	}

	// Used below

	static get counter() {
		Slice._counter = (Slice._counter === undefined)
			? 0
			: (Slice._counter + 1)
		return Slice._counter
	}

	get _video() { return (this._videoTexture) ? this._videoTexture.video : null }

	get _resourceManager() { return this.player.resourceManager }

	// Used in SequenceSlice
	get properties() { return this._properties }

	// Used in SequenceSlice
	set loadStatus(loadStatus) { this._loadStatus = loadStatus }

	constructor(resourceInfoArray, properties, player, parentInfo = null) {
		const { role } = properties
		super(role, player, parentInfo)

		this._id = Slice.counter

		this._resourceInfoArray = resourceInfoArray
		this._properties = properties

		this.player.addSlice(this._id, this)

		const main = (resourceInfoArray && Array.isArray(resourceInfoArray) === true
			&& resourceInfoArray.length > 0)
			? resourceInfoArray[0]
			: null
		const { id } = main || {}
		const { resourceManager } = player
		const mainResource = resourceManager.getResourceWithId(id) || {}
		const {
			type = properties.type,
			width = properties.width,
			height = properties.height,
		} = mainResource
		this._type = `${type}Slice`

		// Set a (surely temporary) size
		this._referenceSize = { width, height }
		this._updateSizeFromReferenceSize()

		// Add a dummy texture to begin with
		this._hasLoadedOnce = false
		if (role === "empty") {
			this._loadStatus = 2
		} else if (type === "text") {
			this._loadStatus = 2
		} else {
			this.assignDummyTexture()
			this._loadStatus = 0
		}

		this._pageNavInfo = {}

		this._videoTexture = null
		this._doOnEnd = null

		this._playLoop = null
	}

	_updateSizeFromReferenceSize() {
		const { width, height } = this._referenceSize
		if (width && height) {
			this.setSize(this._referenceSize)
		} else {
			const { viewportRect } = this.player
			const viewportRatio = (viewportRect.height > 0)
				? (viewportRect.width / viewportRect.height)
				: 1
			if (width) {
				const size = { width, height: width / viewportRatio }
				this.setSize(size)
			} else if (height) {
				const size = { height, width: height * viewportRatio }
				this.setSize(size)
			} else {
				this.setSize(viewportRect)
			}
		}
	}

	// Used in StoryBuilder
	setPageNavInfo(type, pageNavInfo) {
		this._pageNavInfo[type] = pageNavInfo
	}

	// Used in Layer (for PageNavigator)
	getResourceIdsToLoad(force = false) { // force = true on changing tags or reading modes
		if (this.role === "empty" || this._type === "textSlice"
			|| (force === false && (this._loadStatus === 1 || this._loadStatus === 2))) {
			return []
		}

		const { id, fragment } = this.getRelevantResourceIdAndFragment(this._resourceInfoArray)

		if (id === null) {
			this._loadStatus = 0
			this._updateParentLoadStatus()
			return []
		}

		this._loadStatus = 1
		this._updateParentLoadStatus()
		this.addAndStartLoadingAnimation()
		return [[{ sliceId: this._id, resourceId: id, fragment }]]
	}

	getRelevantResourceIdAndFragment(resourceInfoArray) {
		let { id, fragment } = resourceInfoArray[0] || {}

		if (resourceInfoArray.length < 2) {
			return { id, fragment }
		}

		// Check which alternate is most appropriate
		const reworkedArray = resourceInfoArray.map((resourceInfo) => {
			const resource = this._resourceManager.getResourceWithId(resourceInfo.id)
			const { path, tags } = resource || {}
			return {
				...tags, id: resourceInfo.id, path, fragment: resourceInfo.fragment,
			}
		})

		const result = this.player.getBestMatchForCurrentTags(reworkedArray)
		id = result.id
		fragment = result.fragment

		return { id, fragment }
	}

	_updateParentLoadStatus() {
		const { pageNavigator } = this.player
		if (!pageNavigator) { // On Player destroy, pageNavigator is already null
			return
		}
		const { pageNavType } = pageNavigator
		if (!this._pageNavInfo[pageNavType] // If Slice is not in current pageNavigator anymore...
			|| !this.parent || !this.parent.updateLoadStatus) {
			return
		}
		this.parent.updateLoadStatus()
	}

	// Once the associated texture has been created, it can be applied to the slice
	updateTextures(texture, isAFallback) {
		if (!texture) {
			this._loadStatus = 0
			this.assignDummyTexture()

		} else {
			this._loadStatus = (isAFallback === true) ? -1 : 2

			if (texture !== this._texture) { // this._texture is to be found in TextureElement
				const { video, size } = texture
				const { width, height } = size

				// If the texture is a normal image or fallback image
				if (!video) {
					this.setTexture(texture)
					this.player.refreshOnce()

					if (this._hasLoadedOnce === false) {
						// The dimensions are now correct and can be kept
						this.setSizeFromActualTexture(width, height)
						this._hasLoadedOnce = true
					}

				// Otherwise, if the texture is a video
				} else if (video.duration) {
					this._videoTexture = texture

					if (this._hasLoadedOnce === false) {
						this._duration = video.duration

						// The dimensions are now correct and can be kept
						this.setSizeFromActualTexture(width, height)

						this._hasLoadedOnce = true
					}

					this._doOnEnd = null

					if (this._shouldPlay === true) {
						this.play()
					}
				}
			}
		}

		this._updateParentLoadStatus()
		this.stopAndRemoveLoadingAnimation()
	}

	// On the first successful loading of the resource's texture
	setSizeFromActualTexture(width, height) {
		if (width === this.unscaledSize.width && height === this.unscaledSize.height) {
			return
		}
		this.setSize({ width, height })

		// Now only resize the page where this slice appears
		if (this._parent && this.isActive === true) {
			this._parent.resizePage()
		}
	}

	cancelTextureLoad() {
		this._loadStatus = 0
		this._updateParentLoadStatus()
		this.stopAndRemoveLoadingAnimation()
	}

	play() {
		this._shouldPlay = true
		if (!this._video) {
			return
		}

		const shouldUseRaf = (("requestVideoFrameCallback" in HTMLVideoElement.prototype) === false)

		const playPromise = this._video.play()
		if (playPromise !== undefined) {
			playPromise.then(() => {
				this.setVideoTexture(this._videoTexture)
				this._playLoop = () => {
					if (this.isInViewport === true) {
						this.player.refreshOnce()
					}
					if (this._playLoop) {
						if (shouldUseRaf === false) {
							this._video.requestVideoFrameCallback(this._playLoop)
						} else {
							requestAnimationFrame(this._playLoop)
						}
					}
				}
				this._playLoop()
			}).catch(() => {
				// Caught error prevents play (keep the catch to avoid issues with video pause)
			})
		}
	}

	// Stop a video by pausing it and returning to its first frame
	stop() {
		this._shouldPlay = false
		if (this._video) {
			this._video.pause()
			this._video.currentTime = 0
			this._video.loop = true
			this._destroyPlayLoop()
		}
		// Since changing pages will force a stop (on reaching the normal end of a transition
		// or forcing it), now is the appropriate time to remove the "ended" event listener
		if (this._doOnEnd) {
			this._video.removeEventListener("ended", this._doOnEnd)
			this._doOnEnd = null
		}
	}

	_destroyPlayLoop() {
		cancelAnimationFrame(this._playLoop)
		this._playLoop = null
	}

	setDoOnEnd(doOnEnd) {
		if (!this._video) {
			return
		}
		this._video.loop = false
		this._doOnEnd = doOnEnd.bind(this)
		this._video.addEventListener("ended", this._doOnEnd)
	}

	resize(sequenceFit = null) {
		if (sequenceFit) {
			const sequenceClipped = false
			super.resize(sequenceFit, sequenceClipped)
			return
		}

		if (this._type === "textSlice") {
			this._updateSizeFromReferenceSize()
		}

		const { pageNavigator } = this.player
		const { metadata } = pageNavigator

		const fit = metadata.forcedFit || this._properties.fit || metadata.fit

		let clipped = false
		if (metadata.forcedClipped !== undefined
			&& (metadata.forcedClipped === true || metadata.forcedClipped === false)) {
			clipped = pageNavigator.metadata.forcedClipped
		} else if (this._properties !== undefined
			&& (this._properties.clipped === true || this._properties.clipped === false)) {
			clipped = this._properties.clipped
		} else {
			clipped = metadata.clipped
		}

		super.resize(fit, clipped)
	}

	// Used in Layer

	setupForEntry() {
		this.resize()
	}

	finalizeEntry() {
		this.play()
	}

	finalizeExit() {
		this.stop()
	}

	// Used in Layer
	destroyResourcesIfPossible() {
		this.stopAndRemoveLoadingAnimation()

		if (this._loadStatus !== 2 || this.role === "empty" || this._type === "textSlice") {
			return
		}

		const idsArray = this._getLoadedIds() // A different function for Slice and SequenceSlice
		idsArray.forEach((id) => {
			this._resourceManager.destroyResourceForSliceIfPossible(id)
		})
	}

	_getLoadedIds() {
		const { id } = this.getRelevantResourceIdAndFragment(this._resourceInfoArray)
		return (id !== null) ? [id] : []
	}

	// Used in TextureResource
	removeTexture() {
		if (this._video) {
			this.unsetVideoTexture()
			this._videoTexture = null
		} else {
			this.setTexture(null)
		}
		this.setAsUnloaded()
	}

	// Used above and in SequenceSlice
	setAsUnloaded() {
		this._loadStatus = 0
		this._updateParentLoadStatus()
		this.stopAndRemoveLoadingAnimation()
	}

	// Used in LayerPile (for Segment, and ultimately for Camera's virtual point)
	// ...but also in Player for target hrefs!
	getInfo() {
		if (this.role === "empty" || !this._resourceInfoArray || this._resourceInfoArray.length < 1) {
			return { href: "", path: "", mimeType: constants.DEFAULT_MIME_TYPE }
		}
		const { id, fragment } = this._resourceInfoArray[0]
		const resource = this._resourceManager.getResourceWithId(id)
		const { path, mimeType } = resource
		let href = path
		if (href && fragment) {
			href += `#${fragment}`
		}
		return { href: href || "", path: path || "", type: mimeType || constants.DEFAULT_MIME_TYPE }
	}

	// Called by Player on final destroy
	destroy() {
		this._destroyPlayLoop()

		// Clear textures
		super.destroy()
		this._videoTexture = null

		// Remove event listeners
		if (this._video && this._doOnEnd) {
			this._video.removeEventListener("ended", this._doOnEnd)
			this._doOnEnd = null
		}
	}

	// Used in StoryBuilder
	static createEmptySlice(player) {
		const resourceInfoArray = []
		const properties = { role: "empty", type: "empty" }
		const parentInfo = null
		const slice = new Slice(resourceInfoArray, properties, player, parentInfo)
		return slice
	}

	// Used in TimeAnimationManager

	setVariable(variable, value) {
		switch (variable) {
		case "alpha":
			this.setAlpha(value)
			break
		case "x":
			this.setX(value)
			break
		case "y":
			this.setY(value)
			break
		case "scale":
			this.setScaleFactor(value)
			this.resize() // So as to reposition child layers based on scaleFactor
			break
		case "rotation":
			this.setRotation(value)
			break
		default:
			break
		}
	}

	getVariable(variable) {
		switch (variable) {
		case "alpha":
			return this.getAlpha()
		case "x":
			return this.getX()
		case "y":
			return this.getY()
		case "scale":
			return this.getScaleFactor()
		case "rotation":
			return this.getRotation()
		default:
			return null
		}
	}

}