import { TextureElement } from "../Renderer"

// Note that size is obtained from underlying TextureElement

export default class Slice extends TextureElement {

	// Used in Player (for tags)
	get resourceInfoArray() { return this._resourceInfoArray }

	// Used in StoryBuilder and Player
	get pageNavInfo() { return this._pageNavInfo }

	// Used in StoryBuilder
	get pageSide() { return (this._properties) ? this._properties.pageSide : null }

	// Used in StateHandler
	get canPlay() { return (this._duration > 0) }

	// Used in Layer and ResourceManager
	get loadStatus() { return this._loadStatus }

	// Used in TextSlice
	get hasVariableSize() {
		return (!this._referenceSize
			|| (this._referenceSize.width === null || this._referenceSize.height === null))
	}

	// Used in TextureResource
	get isActive() {
		if (!this._parent) {
			return true
		}
		const { pageNavigator } = this._player
		const { segmentRange } = pageNavigator
		const { startIndex, endIndex } = segmentRange
		const { segmentIndex } = this._parent
		return (segmentIndex >= startIndex && segmentIndex <= endIndex)
	}

	// Used in Segment
	get href() { return (this._resource) ? this._resource.href : null }

	// Used in Player
	get id() { return this._id }

	// Used below

	static get counter() {
		Slice._counter = (Slice._counter === undefined)
			? 0
			: (Slice._counter + 1)
		return Slice._counter
	}

	get _video() { return (this._videoTexture) ? this._videoTexture.video : null }

	get _resourceManager() { return this._player.resourceManager }

	constructor(resourceInfoArray, properties, player, parentInfo = null) {
		const { role } = properties
		super(role, player, parentInfo)

		this._id = Slice.counter

		this._resourceInfoArray = resourceInfoArray
		this._properties = properties

		this._player.addSlice(this._id, this)

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
			this._assignDummyTexture()
			this._loadStatus = 0
		}

		this._pageNavInfo = {}

		this._videoTexture = null
		this._doOnEnd = null
	}

	_updateSizeFromReferenceSize() {
		const { width, height } = this._referenceSize
		if (width && height) {
			this._setSize(this._referenceSize)
		} else {
			const { viewportRect } = this._player
			const viewportRatio = (viewportRect.height > 0)
				? (viewportRect.width / viewportRect.height)
				: 1
			if (width) {
				const size = { width, height: width / viewportRatio }
				this._setSize(size)
			} else if (height) {
				const size = { height, width: height * viewportRatio }
				this._setSize(size)
			} else {
				this._setSize(viewportRect)
			}
		}
	}

	// Used in StoryBuilder
	setPageNavInfo(type, pageNavInfo) {
		this._pageNavInfo[type] = pageNavInfo
	}

	// Used in StoryBuilder (for transition slices) and Layer
	setParent(parent) {
		super.setParent(parent)
	}

	// Used in Layer (for PageNavigator)
	getResourceIdsToLoad(force = false) { // force = true on changing tags or reading modes
		const { role } = this._properties
		if (role === "empty" || this._type === "textSlice"
			|| (force === false && (this._loadStatus === 1 || this._loadStatus === 2))) {
			return []
		}

		const { id, fragment } = this._getRelevantResourceIdAndFragment(this._resourceInfoArray)

		if (id === null) {
			this._loadStatus = 0
			this._updateParentLoadStatus()
			return []
		}

		this._loadStatus = 1
		this._updateParentLoadStatus()
		this._addAndStartLoadingAnimation()
		return [[{ sliceId: this._id, resourceId: id, fragment }]]
	}

	_getRelevantResourceIdAndFragment(resourceInfoArray) {
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

		const result = this._player.getBestMatchForCurrentTags(reworkedArray)
		id = result.id
		fragment = result.fragment

		return { id, fragment }
	}

	_updateParentLoadStatus() {
		const { pageNavigator } = this._player
		if (!pageNavigator) { // On Player destroy, pageNavigator is already null
			return
		}
		const { pageNavType } = pageNavigator
		if (!this._pageNavInfo[pageNavType] // If Slice is not in current pageNavigator anymore...
			|| !this._parent || !this._parent.updateLoadStatus) {
			return
		}
		this._parent.updateLoadStatus()
	}

	// Once the associated texture has been created, it can be applied to the slice
	updateTextures(texture, isAFallback) {
		if (!texture) {
			this._loadStatus = 0
			this._assignDummyTexture()

		} else {
			this._loadStatus = (isAFallback === true) ? -1 : 2

			if (texture !== this._texture) { // this._texture is to be found in TextureElement
				const { video, size } = texture
				const { width, height } = size

				// If the texture is a normal image or fallback image
				if (!video) {
					this._setTexture(texture)
					if (this._hasLoadedOnce === false) {
						// The dimensions are now correct and can be kept
						this._setSizeFromActualTexture(width, height)
						this._hasLoadedOnce = true
					}

				// Otherwise, if the texture is a video
				} else if (video.duration) {
					this._videoTexture = texture

					if (this._hasLoadedOnce === false) {
						this._duration = video.duration

						// The dimensions are now correct and can be kept
						this._setSizeFromActualTexture(width, height)

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
		this._stopAndRemoveLoadingAnimation()
	}

	// On the first successful loading of the resource's texture
	_setSizeFromActualTexture(width, height) {
		if (width === this._width && height === this._height) {
			return
		}
		this._setSize({ width, height })

		// Now only resize the page where this slice appears
		if (this._parent && this.isActive === true) {
			this._parent.resizePage()
		}
	}

	cancelTextureLoad() {
		this._loadStatus = 0
		this._updateParentLoadStatus()
		this._stopAndRemoveLoadingAnimation()
	}

	play() {
		this._shouldPlay = true
		if (!this._video) {
			return
		}
		const playPromise = this._video.play()
		if (playPromise !== undefined) {
			playPromise.then(() => {
				this._setVideoTexture(this._videoTexture)
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
		}
		// Since changing pages will force a stop (on reaching the normal end of a transition
		// or forcing it), now is the appropriate time to remove the "ended" event listener
		if (this._doOnEnd) {
			this._video.removeEventListener("ended", this._doOnEnd)
			this._doOnEnd = null
		}
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

		const { pageNavigator } = this._player

		const fit = pageNavigator.metadata.forcedFit || this._properties.fit
			|| pageNavigator.metadata.fit

		let clipped = false
		if (pageNavigator.metadata.forcedClipped !== undefined
			&& (pageNavigator.metadata.forcedClipped === true
				|| pageNavigator.metadata.forcedClipped === false)) {
			clipped = pageNavigator.metadata.forcedClipped
		} else if (this._properties !== undefined
			&& (this._properties.clipped === true || this._properties.clipped === false)) {
			clipped = this._properties.clipped
		} else {
			clipped = pageNavigator.metadata.clipped
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
		this._stopAndRemoveLoadingAnimation()

		const { role } = this._properties
		if (this._loadStatus !== 2 || role === "empty" || this._type === "textSlice") {
			return
		}

		const idsArray = this._getLoadedIds() // A different function for Slice and SequenceSlice
		idsArray.forEach((id) => {
			this._resourceManager.destroyResourceForSliceIfPossible(id)
		})
	}

	_getLoadedIds() {
		const { id } = this._getRelevantResourceIdAndFragment(this._resourceInfoArray)
		return (id !== null) ? [id] : []
	}

	// Used in TextureResource
	removeTexture() {
		if (this._video) {
			this._unsetVideoTexture()
			this._videoTexture = null
		} else {
			this._setTexture(null)
		}
		this._setAsUnloaded()
	}

	// Used above and in SequenceSlice
	_setAsUnloaded() {
		this._loadStatus = 0
		this._updateParentLoadStatus()
		this._stopAndRemoveLoadingAnimation()
	}

	// Used in Segment (ultimately for Camera's virtual point)
	getHref() {
		const { href } = this.getHrefAndPath()
		return href
	}

	// Used above and in Player for target hrefs
	getHrefAndPath() {
		if (!this._resourceInfoArray || this._resourceInfoArray.length < 1) {
			return { href: null, path: null }
		}
		const { id, fragment } = this._getRelevantResourceIdAndFragment(this._resourceInfoArray)
		const resource = this._resourceManager.getResourceWithId(id)
		const { path } = resource
		let href = path
		if (href && fragment) {
			href += `#${fragment}`
		}
		return { href, path }
	}

	// Called by Player on final destroy
	destroy() {
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

	// Used where?
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

	// Used where?
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