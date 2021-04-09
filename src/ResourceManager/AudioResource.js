import CoreResource from "./CoreResource"

export default class AudioResource extends CoreResource {

	// Used in Timer
	get shouldPlay() { return this._shouldPlay }

	constructor(coreResourceData, player) {
		super(coreResourceData, player)

		this._type = "audio"

		this._audio = null
		this._timeout = null
		this._doOnLoadSuccess = null
		this._doOnLoadFail = null

		const { looping } = coreResourceData
		this._looping = looping

		this._shouldPlay = false
		this._hasPlayedOnceInPage = false
	}

	attemptToLoadAudio(src, doOnAudioLoadSuccess, doOnAudioLoadFail, audioLoadTimeout,
		allowsParallel, resolve) {

		this._hasPlayedOnceInPage = false

		// Create audio element
		const audio = document.createElement("audio")
		audio.preload = "auto"
		audio.autoplay = false // Prevent autoplay at start
		audio.setAttribute("playsinline", "") // Required to play in iOS
		audio.crossOrigin = "anonymous"
		audio.loop = this._looping
		audio.src = src
		this._audio = audio

		const doOnLoadFail = () => {
			this._clear()

			if (this._fallback && doOnAudioLoadFail) {
				this._loadStatus = -1
				doOnAudioLoadFail(this._path, this._fallback.path)
			} else {
				this._loadStatus = 0
				resolve()
			}
		}
		this._doOnLoadFail = doOnLoadFail
		audio.addEventListener("error", doOnLoadFail)

		// Event to track should be loadedmetadata, but duration change proved more reliable
		const doOnLoadSuccess = () => {
			this._doOnDurationChange(doOnAudioLoadSuccess)
		}
		this._doOnLoadSuccess = doOnLoadSuccess
		audio.addEventListener("durationchange", doOnLoadSuccess)

		// If resources are loaded serially, a failing audio load should not block loading
		if (allowsParallel === false) {
			this._timeout = setTimeout(doOnLoadFail, audioLoadTimeout)
		}
	}

	mute() {
		if (!this._audio) {
			return
		}
		this._audio.volume = 0
	}

	unmute() {
		if (!this._audio) {
			return
		}
		this._audio.volume = 0.2
		if (this._shouldPlay === true) {
			const shouldCheckVolume = false
			this._play(shouldCheckVolume)
		}
	}

	_play(shouldCheckVolume = true) {
		if (!this._audio || this._hasPlayedOnceInPage === true) {
			return
		}

		// Deal with volume
		if (shouldCheckVolume === true) {
			const { isMuted } = this._player
			this._audio.volume = (isMuted === true) ? 0 : 0.2
		}

		const playPromise = this._audio.play()
		if (playPromise !== undefined) {
			playPromise.then(() => {
				// Play
			}).catch(() => {
				// Caught error prevents play
			})
		}
	}

	_clear() {
		this._removeTracesOfAudioLoad()
		if (this._doOnEnded) {
			this._audio.removeEventListener("ended", this._doOnEnded)
		}
		this._audio = null
	}

	_removeTracesOfAudioLoad() {
		clearTimeout(this._timeout)
		this._timeout = null
		if (this._audio && this._doOnLoadFail) {
			this._audio.removeEventListener("error", this._doOnLoadFail)
		}
		this._doOnLoadFail = null
		if (this._audio && this._doOnLoadSuccess) {
			this._audio.removeEventListener("durationchange", this._doOnLoadSuccess)
		}
		this._doOnLoadSuccess = null
	}

	// Once an audio's duration is different from zero, get useful information
	_doOnDurationChange(doOnAudioLoadSuccess) {
		if (this._loadStatus === 0) { // If loading was cancelled
			this._clear()
			return
		}

		const { duration } = this._audio

		if (duration && doOnAudioLoadSuccess) {
			this._removeTracesOfAudioLoad()

			if (this._looping === false) {
				this._doOnEnded = () => {
					this._hasPlayedOnceInPage = true
				}
				this._audio.addEventListener("ended", this._doOnEnded)
			}

			if (this._shouldPlay === true) {
				this._play()
			}

			doOnAudioLoadSuccess()

		// If the audio failed loading
		} else if (this._doOnLoadFail) {
			this._doOnLoadFail()
		}
	}

	playIfNeeded() {
		if (this._shouldPlay === true) {
			return
		}
		this._shouldPlay = true
		this._play()
	}

	stopIfNeeded() {
		this._shouldPlay = false
		if (!this._audio) {
			return
		}
		this._audio.pause()
		this._audio.currentTime = 0
	}

	resetForPlay() {
		this._shouldPlay = false
		this._hasPlayedOnceInPage = false
		if (!this._audio) {
			return
		}
		this._audio.pause()
		this._audio.currentTime = 0
	}

	cancelLoad() {
		this._clear()
		super.cancelLoad()
	}

	forceDestroy() {
		this._clear()
		super.forceDestroy()
	}

}