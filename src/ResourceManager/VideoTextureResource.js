import TextureResource from "./TextureResource"
import { Texture } from "../Renderer"

export default class VideoTextureResource extends TextureResource {

	constructor(coreResourceData, player) {
		super(coreResourceData, player)

		this._type = "video"

		this._video = null
		this._timeout = null
		this._doOnLoadSuccess = null
		this._doOnLoadFail = null
		this._fallbackFragment = null
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
			const forceFailIfNeeded = false
			this._clear(forceFailIfNeeded)

			if (doOnVideoLoadFail && this._fallbacksArray.length > 0) {
				this._loadStatus = -1

				// Let's create the baseTexture from the appropriate fallback image
				// (note that we don't care that the type will not be the right one anymore!)

				const { path, fragment } = this._player.getBestMatchForCurrentTags(this._fallbacksArray)
				if (fragment) {
					this._fallbackFragment = fragment
				}

				const fallbackPath = path
				doOnVideoLoadFail(resolve, fallbackPath)

			} else {
				this._loadStatus = 0
				resolve()
			}
		}
		this._doOnLoadFail = doOnLoadFail
		video.addEventListener("error", doOnLoadFail)

		// Event to track should be loadedmetadata, but duration change proved more reliable
		const doOnLoadSuccess = () => {
			this._doOnDurationChange(resolve, doOnVideoLoadSuccess)
		}
		this._doOnLoadSuccess = doOnLoadSuccess
		video.addEventListener("durationchange", doOnLoadSuccess)

		// If resources are loaded serially, a failing video load should not block loading
		if (allowsParallel === false) {
			this._timeout = setTimeout(doOnLoadFail, videoLoadTimeout)
		}
	}

	_clear(forceFailIfNeeded) {
		this._removeTracesOfVideoLoad(forceFailIfNeeded)
		this._video = null
	}

	_removeTracesOfVideoLoad(forceFailIfNeeded) {
		if (this._timeout) {
			clearTimeout(this._timeout)
			this._timeout = null
			if (forceFailIfNeeded === true) {
				this._doOnLoadFail()
			}
		}
		if (this._video && this._doOnLoadFail) {
			this._video.removeEventListener("error", this._doOnLoadFail)
		}
		this._doOnLoadFail = null
		if (this._video && this._doOnLoadSuccess) {
			this._video.removeEventListener("durationchange", this._doOnLoadSuccess)
		}
		this._doOnLoadSuccess = null
		this._fallbackFragment = null
	}

	// Once a video's duration is different from zero, get useful information
	_doOnDurationChange(resolve, doOnVideoLoadSuccess) {
		const { duration } = this._video || {}

		if (this._loadStatus !== 0 // Loading may indeed have been cancelled
			&& duration && doOnVideoLoadSuccess) {
			this._removeTracesOfVideoLoad() // But keep this._video, so don't clear()!

			const { baseTexture, texture } = Texture.createVideoTexture(this._video)
			const textureData = {
				resourceId: this._id,
				texture: {
					base: baseTexture,
					full: texture,
				},
			}

			doOnVideoLoadSuccess(resolve, textureData)

		// If the video failed loading
		} else if (this._doOnLoadFail) {
			this._doOnLoadFail()
		}
	}

	cancelLoad(slices) {
		const forceFailIfNeeded = true
		this._clear(forceFailIfNeeded)
		super.cancelLoad(slices)
	}

	_forceDestroy(slices) {
		const forceFailIfNeeded = true
		this._clear(forceFailIfNeeded)
		this._forceDestroyTextures(slices)
	}

}