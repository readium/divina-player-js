import * as constants from "../../constants"

export default class LayerTransition {

	get controlled() { return this._controlled }

	get slice() { return this._slice }

	get isRunning() { return this._isRunning }

	constructor(handler, layer, isExiting, entryOrExit) {
		this._handler = handler
		this._layer = layer
		this._isExiting = isExiting
		this._type = "cut"
		this._controlled = false

		this._startTime = null
		this._isRunning = true

		const {
			type, duration, direction, sliceType, slice, controlled,
		} = entryOrExit || {}

		if (!entryOrExit
			|| !(type === "show" || type === "hide" || type === "fade-in" || type === "fade-out"
				|| type === "slide-in" || type === "slide-out" || type === "animation")) {
			return
		}
		this._type = type
		this._controlled = controlled

		let actualDuration = duration
		if (type !== "animation" || sliceType !== "video") {
			actualDuration = (duration !== undefined) ? duration : constants.defaultDuration
			// Note that duration can be 0 for a "hide" layer transition
		}
		this._duration = actualDuration // May still be undefined (but only for a video)

		if (type === "slide-in" || type === "slide-out") {
			this._direction = direction

		} else if (type === "animation" && slice) {
			this._sliceType = sliceType
			this._slice = slice

			if (sliceType === "video" && slice && !actualDuration) {
				this._slice.setDoOnEnd(this.end.bind(this))
			}
			this._slice.resize()
		}
	}

	start(startTime) {
		// If the layerTransition is a video or sequence with no duration,
		// or a sequence with no frames loaded, skip it
		if (this._sliceType && (!this._slice || this._slice.canPlay === false)) {
			this.end()

		// Otherwise play the layerTransition
		} else {

			if (this._slice) {
				this._slice.finalizeEntry() // Start playing the transition sequence or video

			} else if (this._type === "slide-in" || this._type === "slide-out") {
				// Prevent resize from impacting the content's position
				const { content } = this._layer
				if (this._direction === "ltr" || this._direction === "rtl") {
					content.setIsXPositionUpdating(true)
				} else if (this._direction === "ttb" || this._direction === "btt") {
					content.setIsYPositionUpdating(true)
				}
			}

			this._startTime = startTime
			this._run()
		}
	}

	// The function will below shall loop if layerTransitionPercent !== null
	_run(layerTransitionPercent = null) {
		if (this._isRunning === false) {
			return
		}

		let percent = 1

		// For an intermediate state (i.e. a controlled transition - not applicable
		// to videos for now since we do not want to seek a specific point in a video)
		if (layerTransitionPercent !== null && this._sliceType !== "video") {
			percent = layerTransitionPercent

		// For an uncontrolled (i.e. timed) transition
		// Note: bear in mind that this._duration may still be undefined at this stage for a video
		} else if (this._duration && this._duration > 0) {
			percent = (Date.now() - this._startTime) / this._duration

		// For a video transition (keep playing until percent = 1)
		} else if (this._sliceType === "video" && this._slice) {
			percent = 0
		}

		const { stateChange } = this._handler

		// If the user has forced the transition to its end...
		if (stateChange.shouldForceToEnd === true
			// ... or the transition is not a video running to its end, and it has actually ended
			// (except if the percent value is given by layerTransitionPercent, i.e. controlled)
			|| (this._sliceType !== "video" && percent >= 1 && layerTransitionPercent !== 1)) {
			this.end()

		} else if (this._type === "animation") {

			// If the transition is a sequence, we can seek a specific point in it
			if (this._sliceType === "sequence" && this._slice && layerTransitionPercent !== null) {
				this._slice.pauseAtPercent(percent)
			} else {
				// Bear in mind we do not want to seek a specific point in a video,
				// so keep on playing the transition, waiting until its eventual end
				requestAnimationFrame(this._run.bind(this, null))
			}

		// Otherwise just apply the required changes based on time
		} else {
			const { viewportRect } = this._handler
			const { width, height } = viewportRect
			const { content } = this._layer

			if (this._type === "fade-in") {
				content.setAlpha(percent)
			} else if (this._type === "fade-out") {
				content.setAlpha(1 - percent)
			} else if (this._type === "slide-in") {
				switch (this._direction) {
				case "ltr":
					content.setXOffset((percent - 1) * width)
					break
				case "rtl":
					content.setXOffset((1 - percent) * width)
					break
				case "ttb":
					content.setYOffset((percent - 1) * height)
					break
				case "btt":
					content.setYOffset((1 - percent) * height)
					break
				default:
					break
				}
			} else if (this._type === "slide-out") {
				switch (this._direction) {
				case "ltr":
					content.setXOffset(percent * width)
					break
				case "rtl":
					content.setXOffset(-percent * width)
					break
				case "ttb":
					content.setYOffset(percent * height)
					break
				case "btt":
					content.setYOffset(-percent * height)
					break
				default:
					break
				}
			}
			if (this._type !== "hide") {
				content.setVisibility(true)
			}

			if (layerTransitionPercent === null) {
				requestAnimationFrame(this._run.bind(this, null))
			}
		}
	}

	end() {
		this._isRunning = false

		const { content } = this._layer || {}
		LayerTransition._resetLayerContent(content)
		LayerTransition._removeTemporarySlice(this._slice)

		if (this._isExiting === true) {
			this._layer.finalizeExit()
			content.removeFromParent()
		} else {
			this._layer.finalizeEntry()
		}

		this._handler.notifyTransitionEnd()
	}

	static _resetLayerContent(content) {
		if (!content) {
			return
		}
		content.setAlpha(1)
		content.setVisibility(true)
		content.setIsXPositionUpdating(false)
		content.setIsYPositionUpdating(false)
		content.resetPosition()
	}

	static _removeTemporarySlice(sequenceOrVideoSlice) {
		if (!sequenceOrVideoSlice) {
			return
		}
		sequenceOrVideoSlice.finalizeExit()
		sequenceOrVideoSlice.removeFromParent()
	}

	goToIntermediateState(percent) {
		this._run(percent)
	}

	cancel() {
		this._isRunning = false

		const { content } = this._layer || {}
		LayerTransition._resetLayerContent(content)
		LayerTransition._removeTemporarySlice(this._slice)

		// Stop and remove an added layer
		if (this._isExiting === false) {
			this._layer.finalizeExit()
			content.removeFromParent()
		}
	}

	resize() {
		if (!this._slice) {
			return
		}
		this._slice.resize()
	}

}