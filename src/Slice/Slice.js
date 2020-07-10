import { TextureElement } from "../Renderer"

export default class Slice extends TextureElement {

	// Used in Segment
	get resource() { return this._resource }

	// Used in StoryBuilder
	get pageNavInfo() { return this._pageNavInfo }

	// Used in StateHandler
	get canPlay() { return (this._duration > 0) }

	// Used in Layer and ResourceManager
	get loadStatus() { return this._loadStatus }

	// Used in Segment (and below)
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

	// Note that resource is really a SliceResource, not a (Texture)Resource
	constructor(resource = null, player, parentInfo = null, neighbor = null) {
		super(resource, player, parentInfo, neighbor)

		this._id = Slice.counter

		this._resource = resource

		this._type = `${(resource) ? resource.type : "untyped"}Slice`

		// Add a dummy texture to begin with
		this._hasLoadedOnce = false
		if (this.role === "empty") {
			this._assignEmptyTexture()
			this._loadStatus = 2
		} else {
			this._assignDummyTexture()
			this._loadStatus = 0
		}

		this._pageNavInfo = {}
	}

	// Used in StoryBuilder
	setPageNavInfo(type, pageNavInfo) {
		this._pageNavInfo[type] = pageNavInfo
	}

	// Used in StoryBuilder (for transition slices) and Layer
	setParent(parent) {
		super.setParent(parent)
	}

	// Used in Layer
	getPathsToLoad() {
		if (this._loadStatus !== 0) {
			return []
		}

		const { path } = this._getRelevantPathAndMediaFragment(this._resource)

		this._loadStatus = (!path) ? 0 : 1
		if (this._parent && this._parent.updateLoadStatus) {
			this._parent.updateLoadStatus()
		}

		return (path) ? [{ pathsArray: [path], sliceId: this._id }] : []
	}

	_getRelevantPathAndMediaFragment(resource) {
		let path = (resource) ? resource.path : null
		let mediaFragment = (resource) ? resource.mediaFragment : null

		const { tags = {} } = this._player // Note that this._player actually comes from TextureElement
		if (resource && resource.alternate) {
			const { alternate } = resource
			Object.entries(tags).forEach(([tagName, tagData]) => {
				const { array, index } = tagData
				if (array && index < array.length) {
					const tagValue = array[index]
					if (alternate[tagName] && alternate[tagName][tagValue]) {
						path = alternate[tagName][tagValue].path
						mediaFragment = alternate[tagName][tagValue].mediaFragment
					}
				}
			})
		}

		return { path, mediaFragment }
	}

	// Once the associated texture has been created, it can be applied to the slice
	updateTextures(texture, isAFallback) {

		if (!texture) {
			this._loadStatus = 0
			this._assignDummyTexture()

		} else if (texture !== this.texture) {
			this._loadStatus = (isAFallback === true) ? -1 : 2

			const { video } = texture

			// If the texture is a video
			if (video && video.duration) {
				this._video = video

				this._setVideoTexture(texture)

				if (this._hasLoadedOnce === false) {
					this._duration = video.duration

					// The dimensions are now correct and can be kept
					this._setSizeFromActualTexture(texture.frame.width, texture.frame.height)
					this._hasLoadedOnce = true
				}

				this._doOnEnd = null

				if (this._shouldPlay === true) {
					this.play()
				}

			// Otherwise the texture is a normal image or fallback image
			} else {
				this._setTexture(texture)
				if (this._hasLoadedOnce === false) {
					// The dimensions are now correct and can be kept
					this._setSizeFromActualTexture(texture.frame.width, texture.frame.height)
					this._hasLoadedOnce = true
				}
			}
		} else { // texture === this.texture
			this._loadStatus = (isAFallback === true) ? -1 : 2
		}

		if (this._parent && this._parent.updateLoadStatus) {
			this._parent.updateLoadStatus()
		}
	}

	// On the first successful loading of the resource's texture
	_setSizeFromActualTexture(width, height) {
		if (width === this.size.width && height === this.size.height) {
			return
		}
		this._setSize({ width, height })

		// Now only resize the page where this slice appears (if that page is indeed active)
		if (this._parent) {
			this._parent.resizePage()
		}
	}

	play() {
		this._shouldPlay = true
		if (this._video) {
			const playPromise = this._video.play()
			if (playPromise !== undefined) {
				playPromise
					.then(() => {
						// Play
					}, () => {
						// Caught error prevents play
					})
			}
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

	resize(sequenceFit) {
		if (sequenceFit) {
			const sequenceClipped = true
			super.resize(sequenceFit, sequenceClipped)
			return
		}

		const { pageNavigator } = this._player

		const fit = pageNavigator.metadata.forcedFit || this._resource.fit || pageNavigator.metadata.fit

		let clipped = false
		if (pageNavigator.metadata.forcedClipped === true
			|| pageNavigator.metadata.forcedClipped === false) {
			clipped = pageNavigator.metadata.forcedClipped
		} else if (this._resource.clipped === true || this._resource.clipped === false) {
			clipped = this._resource.clipped
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

	destroyTexturesIfPossible() {
		const pathsArray = this.unlinkTexturesAndGetPaths()

		if (this._parent && this._parent.updateLoadStatus) {
			this._parent.updateLoadStatus()
		}

		if (!pathsArray) {
			return
		}
		pathsArray.forEach((path) => {
			this.resourceManager.notifyTextureRemovalFromSlice(path)
		})
	}

	// Used above and in Player
	unlinkTexturesAndGetPaths() {
		if (this._loadStatus === 0 || this.role === "empty") {
			return []
		}

		this._loadStatus = 0
		// Note that we don't add this._setTexture(null): we're actually keeping the texture

		const { path } = this._getRelevantPathAndMediaFragment(this._resource)
		return (path) ? [path] : []
	}

	// Used in Layer, ultimately linked to PageNavigator's getFirstHrefInCurrentPage
	getFirstHref() {
		return this.href
	}

	// Called by Player on final destroy
	destroy() {
		// Clear textures
		super.destroy()

		// Remove event listeners
		if (this._video) {
			if (this._doOnEnd) {
				this._video.removeEventListener("ended", this._doOnEnd)
				this._doOnEnd = null
			}
			this._video = null
		}
	}

	// Used in StoryBuilder
	static createEmptySlice(player, neighbor) {
		const resource = { role: "empty" }
		const parentInfo = null
		const slice = new Slice(resource, player, parentInfo, neighbor)
		return slice
	}

}