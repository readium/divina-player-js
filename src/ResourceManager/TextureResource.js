import { Texture } from "../Renderer"

export default class TextureResource {

	get id() { return this._id }

	get type() { return this._type }

	get fallback() { return this._fallback }

	get href() { return this._href }

	get hasStartedLoading() { return (this._loadStatus !== 0) }

	get hasLoaded() { return (this._loadStatus === -1 || this._loadStatus === 2) }

	static get counter() {
		TextureResource._counter = (TextureResource._counter === undefined)
			? 0
			: (TextureResource._counter + 1)
		return TextureResource._counter
	}

	constructor(textureInfo, sliceId) {
		this._id = TextureResource.counter

		const {
			type, path, href, fallback,
		} = textureInfo

		this._type = type
		this._path = path
		this._href = href
		this._fallback = fallback

		this._video = null
		this._timeout = null
		this._doOnLoadSuccess = null
		this._doOnLoadFail = null

		this._loadStatus = 0
		this._baseTexture = null
		this._textures = {}

		this._addOrUpdateMediaFragment("full")
		this.addTextureInfo(textureInfo, sliceId)
	}

	_addOrUpdateMediaFragment(mediaFragment, sliceId) {
		if (!this._textures[mediaFragment]) {
			this._textures[mediaFragment] = {
				texture: null,
				sliceIdsSet: new Set(),
			}
		}
		// On a readingMode change, the baseTexture may already be present,
		// so adding new media fragments imply that the corresponding textures be created
		if (this._baseTexture && this._textures.full && this._textures.full.texture) {
			const fullTexture = this._textures.full.texture
			const croppedTexture = Texture.cropToFragment(fullTexture, mediaFragment)
			this._textures[mediaFragment].texture = croppedTexture
		}
		if (sliceId !== undefined) {
			this._textures[mediaFragment].sliceIdsSet.add(sliceId)
		}
	}

	// Also used in ResourceManager
	addTextureInfo(textureInfo, sliceId) {
		const { mediaFragment } = textureInfo
		if (mediaFragment) {
			this._addOrUpdateMediaFragment(mediaFragment, sliceId)
		} else {
			this._addOrUpdateMediaFragment("full", sliceId)
		}
	}

	resetSliceIdsSets() {
		Object.keys(this._textures).forEach((mediaFragment) => {
			this._textures[mediaFragment].sliceIdsSet = new Set()
		})
	}

	attemptToLoadVideo(src, doOnVideoLoadSuccess, doOnVideoLoadFail, videoLoadTimeout,
		allowsParallel, resolve) {

		// Create video element
		const video = document.createElement("video")
		video.preload = "auto"
		video.loop = true // All videos will loop by default
		video.autoplay = false // Prevent autoplay at start
		video.muted = true // Only a muted video can autoplay
		video.setAttribute("playsinline", "") // Required to play in iOS
		video.crossOrigin = "anonymous"
		video.src = src
		this._video = video

		const doOnLoadFail = () => {
			clearTimeout(this._timeout)
			this._removeTracesOfVideoLoad()
			this._video = null

			if (this._fallback && doOnVideoLoadFail) {
				this._loadStatus = -1
				// Let's create the baseTexture from the fallback image
				// (we don't care that the type will thus not be the right one anymore)
				doOnVideoLoadFail(this._path, this._fallback.path)
			} else {
				this._loadStatus = 0
				resolve()
			}
		}
		this._doOnLoadFail = doOnLoadFail
		video.addEventListener("error", doOnLoadFail)

		// Event to track should be loadedmetadata, but duration change proved more reliable
		const doOnLoadSuccess = () => {
			this._doOnDurationChange(doOnVideoLoadSuccess)
		}
		this._doOnLoadSuccess = doOnLoadSuccess
		video.addEventListener("durationchange", doOnLoadSuccess)

		// If resources are loaded serially, a failing video load should not block loading
		if (allowsParallel === false) {
			this._timeout = setTimeout(doOnLoadFail, videoLoadTimeout)
		}
	}

	_removeTracesOfVideoLoad() {
		if (!this._video) {
			return
		}
		if (this._doOnLoadFail) {
			this._video.removeEventListener("error", this._doOnLoadFail)
			this._doOnLoadFail = null
		}
		if (this._doOnLoadSuccess) {
			this._video.removeEventListener("durationchange", this._doOnLoadSuccess)
			this._doOnLoadSuccess = null
		}
	}

	// Once a video's duration is different from zero, get useful information
	_doOnDurationChange(doOnVideoLoadSuccess) {
		clearTimeout(this._timeout)

		const { duration } = this._video

		if (duration && doOnVideoLoadSuccess) {
			const texture = Texture.createVideoTexture(this._video)

			this._removeTracesOfVideoLoad()

			const textureData = {
				name: this._path,
				baseTexture: texture.baseTexture,
				texture,
			}
			doOnVideoLoadSuccess(textureData)

		// If the video failed loading
		} else if (this._doOnLoadFail) {
			this._doOnLoadFail() // Which involves removing the event listener too
		}
	}

	notifyLoadStart() {
		if (this._loadStatus === 0) {
			this._loadStatus = 1 // Means that loader has started loading the resource
		}
	}

	cancelLoad(slices) {
		this._loadStatus = 0
		Object.values(this._textures).forEach(({ sliceIdsSet }) => {
			sliceIdsSet.forEach((sliceId) => {
				const slice = slices[sliceId]
				slice.cancelTextureLoad()
			})
		})

		this.clearVideoTraces()
	}

	clearVideoTraces() {
		if (this._video) {
			if (this._doOnLoadFail) {
				this._video.removeEventListener("error", this._doOnLoadFail)
				this._doOnLoadFail = null
			}
			if (this._doOnLoadSuccess) {
				this._video.removeEventListener("durationchange", this._doOnLoadSuccess)
				this._doOnLoadSuccess = null
			}
			this._video = null
		}
	}

	setBaseTexture(baseTexture, fullTexture) {
		if (this._baseTexture || !baseTexture || !fullTexture) {
			return
		}
		this._baseTexture = baseTexture

		// For the texture, store the (clipped) media fragment texture directly if it is a fallback
		if (this._loadStatus === -1 && this._fallback && this._fallback.mediaFragment) {
			const croppedTexture = Texture.cropToFragment(fullTexture, this._fallback.mediaFragment)

			this._textures.full.texture = croppedTexture

		// Otherwise just store the texture as the full texture
		// (reminder: this._loadStatus = 1 or -1 - if no fallback - at this stage)...
		} else {
			this._textures.full.texture = fullTexture
			// ...and create other fragments as needed
			this._createFragmentsIfNeeded(fullTexture)
			if (this._loadStatus !== -1) {
				this._loadStatus = 2
			}
		}
	}

	_createFragmentsIfNeeded(fullTexture) {
		Object.keys(this._textures).forEach((mediaFragment) => {
			if (mediaFragment !== "full") {
				const croppedTexture = Texture.cropToFragment(fullTexture, mediaFragment)
				this._textures[mediaFragment].texture = croppedTexture
			}
		})
	}

	applyAllTextures(slices) {
		const fullTexture = this._textures.full.texture
		Object.values(this._textures).forEach(({ texture, sliceIdsSet }) => {
			sliceIdsSet.forEach((sliceId) => {
				const slice = slices[sliceId]
				if (slice) {
					const sliceTexture = (this._loadStatus === -1) ? fullTexture : texture
					const isAFallback = (this._loadStatus === -1)
					slice.updateTextures(sliceTexture, isAFallback)
				}
			})
		})
	}

	// Used for a SequenceSlice only
	getTextureForMediaFragment(mediaFragment = null) {
		const fragment = (this._loadStatus === -1)
			? "full" // The full texture for a fallback is already sized correctly
			: (mediaFragment || "full")
		if (!this._textures[fragment]) {
			return null
		}
		const { texture } = this._textures[fragment]
		return texture
	}

	destroyTexturesIfPossible(slices) {
		let shouldBeKept = false
		Object.values(this._textures).forEach((mediaFragmentData) => {
			const { sliceIdsSet } = mediaFragmentData
			sliceIdsSet.forEach((sliceId) => {
				const slice = slices[sliceId]
				if (slice) {
					const { loadStatus } = slice
					if (loadStatus === -1 || loadStatus === 1 || loadStatus === 2) {
						shouldBeKept = true
					}
				}
			})
		})
		if (shouldBeKept === false) {
			this.forceDestroyTextures()
		}
	}

	forceDestroyTextures() {
		if (this._loadStatus === 0) {
			return
		}

		Object.keys(this._textures).forEach((mediaFragment) => {
			this._textures[mediaFragment].texture = null
		})
		if (this._baseTexture) {
			this._baseTexture.destroy()
		}
		this._baseTexture = null

		this.clearVideoTraces()

		this._loadStatus = 0
	}

}