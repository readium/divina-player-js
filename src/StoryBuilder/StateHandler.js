import * as constants from "../constants"

export default class StateHandler {

	get type() { return this._type }

	// Used in LayerPile

	get isAtStart() { return (this._statesArray.length === 0 || this._stateIndex === 0) }

	get isAtEnd() {
		return (this._statesArray.length === 0
			|| this._stateIndex === this._statesArray.length - 1)
	}

	get isUndergoingChanges() { return (this._currentTransition.status !== "none") }

	// Used in PageNavigator
	get stateIndex() { return this._stateIndex }

	constructor(layerPile, shouldStateLayersCoexistOutsideTransitions = false, player) {
		this._layerPile = layerPile
		this._shouldStateLayersCoexistOutsideTransitions = shouldStateLayersCoexistOutsideTransitions
		this._player = player // Useful only for viewportRect

		this._type = "stateHandler"

		// this._isLooping = false

		const { layersArray } = layerPile

		// The _statesArray lists for each state the indices of the layers to add
		// (shouldStateLayersCoexistOutsideTransitions specifies what to do with already present layers)
		this._statesArray = this._createStatesArray(layersArray)

		this._stateIndex = null
		this._reset()
	}

	_createStatesArray(layersArray) {
		// For a PageNavigator (in particular)
		if (this._shouldStateLayersCoexistOutsideTransitions === false) {
			return layersArray.map((_, i) => ([i]))
		}

		// While for a multi-layer Segment...
		const statesArray = []
		let newLayerIndicesForState = []
		for (let i = 0; i < layersArray.length; i += 1) {
			const layer = layersArray[i]
			const { entryForward } = layer || {} // Strong decision: only those are taken into account
			// (i.e. we're not considering possibly mismatched backwardEntries to build the list)
			if (entryForward && entryForward.isDiscontinuous === true && i !== 0) {
				statesArray.push(newLayerIndicesForState)
				newLayerIndicesForState = [i]
			} else {
				newLayerIndicesForState.push(i)
			}
		}
		statesArray.push(newLayerIndicesForState)
		return statesArray
	}

	_reset() {
		this._currentTransition = {
			status: "none",
			isGoingForward: true,
			layerTransitionsArray: [],
			nbOfRunningLayerTransitions: 0,
			shouldForceToEnd: false,
			endCallback: null,
			shouldForceToStop: false,
		}
	}

	// Used here and in PageNavigator
	forceChangesToEnd(callback, isGoingForward) {
		// Only run the callback if the movement directions differ
		if (isGoingForward !== this._currentTransition.isGoingForward) {
			if (this._currentTransition.status === "none") {
				if (callback) {
					callback()
				}
				return
			} // else
			this._currentTransition.endCallback = callback
		}
		this._currentTransition.shouldForceToEnd = true
	}

	goToState(stateIndex, isGoingForward, shouldCancelTransition = false) {
		if (stateIndex < 0 || stateIndex >= this._statesArray.length) {
			return
		}

		if (shouldCancelTransition === true) {
			// Ensure layerTransitions will be forced to end
			this._currentTransition.shouldForceToEnd = true
		}

		const oldStateIndex = this._stateIndex

		let layerIndicesToRemove = []
		let layerIndicesToAdd = []

		// For page transitions
		if (this._shouldStateLayersCoexistOutsideTransitions === false) {
			if (this._stateIndex !== null) { // No this._stateIndex on first goToState
				layerIndicesToRemove = this._statesArray[this._stateIndex]
			}

			layerIndicesToAdd = this._statesArray[stateIndex]

		// For layer transitions
		} else if (isGoingForward === true
			|| stateIndex === this._statesArray.length - 1) { // Same approach when coming back indeed
			let i = (stateIndex === this._statesArray.length - 1) ? 0 : (this._stateIndex || 0)
			while (i < stateIndex && i < this._statesArray.length) {
				this._statesArray[i].forEach((layerIndex) => {
					const layer = this._layerPile.getLayerAtIndex(layerIndex)
					this._addLayerContent(layer, layerIndex, isGoingForward, this._stateIndex || 0)
					const { content } = layer || {}
					content.setVisibility(true)
					layer.finalizeEntry()
					// Do note that those layers are added right away, and thus will not appear
					// in layerIndicesToAdd, which is only concerned with the final layer,
					// for which an entry layerTransition may play!
				})
				i += 1
			}
			if (i === stateIndex) {
				layerIndicesToAdd.push(...this._statesArray[i])
			}
		} else { // Going backward (i.e. stateIndex < this._stateIndex)
			let i = this._statesArray.length - 1
			while (i > stateIndex && i >= 0) {
				layerIndicesToRemove.push(...this._statesArray[i])
				i -= 1
			}
		}

		if (layerIndicesToAdd.length === 0 && layerIndicesToRemove === 0) {
			this._reset() // To counter the above shouldForceToEnd = true
			return
		}

		const layerTransitionsArray = this._createLayerTransitions(layerIndicesToAdd,
			layerIndicesToRemove, isGoingForward, oldStateIndex)
		this._currentTransition.status = "started"
		this._currentTransition.oldStateIndex = oldStateIndex
		this._currentTransition.newStateIndex = stateIndex
		this._currentTransition.isGoingForward = isGoingForward
		this._currentTransition.layerTransitionsArray = layerTransitionsArray
		this._currentTransition.nbOfRunningLayerTransitions = layerTransitionsArray.length

		if (this._layerPile.doOnStateChangeStart) {
			this._layerPile.doOnStateChangeStart(stateIndex)
		}

		this._currentTransition.status = "looping"
		this._startAllLayerTransitions()
	}

	_addLayerContent(layer, layerIndex, isGoingForward, oldStateIndex) {
		// Make content invisible (in case a fade-in has to be run)
		const { content } = layer || {}
		content.setVisibility(false)

		// Add new layer at appropriate depth
		const depth = this._layerPile.getDepthOfNewLayer(oldStateIndex, isGoingForward)
		this._layerPile.addChildAtIndex(content, depth)

		layer.setupForEntry(isGoingForward)
	}

	_createLayerTransitions(layerIndicesToAdd, layerIndicesToRemove, isGoingForward, oldStateIndex) {
		const layerTransitionsArray = []

		layerIndicesToAdd.forEach((layerIndex) => {
			const layer = this._layerPile.getLayerAtIndex(layerIndex)

			// Add layer content
			this._addLayerContent(layer, layerIndex, isGoingForward, oldStateIndex)

			// Now create layerTransitions

			const { content, entryForward, entryBackward } = layer || {}
			const entry = (isGoingForward === true) ? entryForward : entryBackward
			const {
				type, duration, direction, sliceType, slice, controlled,
			} = entry || {}

			let layerTransition = {
				layer,
				isExiting: false,
			}

			if (entry && (type === "fade-in" || type === "fade-out" // No "remove" transition here
				|| type === "slide-in" || type === "slide-out" || type === "animation")) {

				let actualDuration = duration // May still be undefined
				if (sliceType !== "video" || !slice) {
					actualDuration = (duration !== undefined) ? duration : constants.defaultDuration
				}
				layerTransition = {
					...layerTransition,
					type,
					duration: actualDuration,
				} // All start with same zero date as the first one in the list!

				if (type === "slide-in" || type === "slide-out") {
					layerTransition.direction = direction
					// Prevent resize from impacting the content's position
					if (direction === "ltr" || direction === "rtl") {
						content.setIsXPositionUpdating(true)
					} else if (direction === "ttb" || direction === "btt") {
						content.setIsYPositionUpdating(true)
					}
				} else if (type === "animation" && slice) {
					layerTransition.sliceType = sliceType
					layerTransition.slice = slice
					if (sliceType === "video" && slice && !actualDuration) {
						slice.setDoOnEnd(this.forceChangesToEnd.bind(this, null,
							this._currentTransition.isGoingForward))
					}
					slice.resize()
					this._layerPile.addChild(slice)
				}
			}
			layerTransitionsArray.push(layerTransition)
		})

		layerIndicesToRemove.forEach((layerIndex) => {
			const layer = this._layerPile.getLayerAtIndex(layerIndex)
			const { content, exitForward, exitBackward } = layer || {}
			const exit = (isGoingForward === true) ? exitForward : exitBackward
			const {
				type, duration, direction, sliceType, slice, controlled,
			} = exit || {}

			let layerTransition = {
				layer,
				isExiting: true,
			}

			if (exit && (type === "remove" || type === "fade-in" || type === "fade-out"
				|| type === "slide-in" || type === "slide-out" || type === "animation")) {

				let actualDuration = duration // Can be undefined!
				if (type !== "animation") {
					actualDuration = (duration !== undefined) ? duration : constants.defaultDuration
				}
				layerTransition = {
					...layerTransition,
					type,
					duration: actualDuration,
				} // All start with same zero date as the first one in the list!

				if (type === "slide-in" || type === "slide-out") {
					layerTransition.direction = direction
					// Prevent resize from impacting the content's position
					if (direction === "ltr" || direction === "rtl") {
						content.setIsXPositionUpdating(true)
					} else if (direction === "ttb" || direction === "btt") {
						content.setIsYPositionUpdating(true)
					}
				} else if (type === "animation" && slice) {
					layerTransition.sliceType = sliceType
					layerTransition.slice = slice
				}
			}
			layerTransitionsArray.push(layerTransition)
		})

		return layerTransitionsArray
	}

	_startAllLayerTransitions() {
		this._startTime = Date.now()
		this._currentTransition.layerTransitionsArray.forEach((layerTransition) => {
			const { sliceType, slice } = layerTransition

			// If the layerTransition is a video or sequence with no duration,
			// or a sequence with no frames loaded, skip it
			if (sliceType && (!slice || slice.canPlay === false)) {
				this._endLayerTransition(layerTransition)

			// Otherwise play the layerTransition
			} else {
				if (slice) {
					slice.finalizeEntry()
				}
				this._runLayerTransition(layerTransition, null)
			}
		})
	}

	// The function will below shall loop if layerTransitionPercent !== null
	_runLayerTransition(layerTransition, layerTransitionPercent = null) {
		const {
			layer,
			type, // Type is layerTransition type (not layer type)
			duration, // Can be undefined for a video (or controlled sequence)
			direction,
			sliceType,
			slice,
		} = layerTransition

		let percent = 1
		if (layerTransitionPercent !== null) {
			percent = layerTransitionPercent
		} else if (duration && duration > 0) {
			percent = (Date.now() - this._startTime) / duration
		} else if (sliceType === "video" && slice) { // Play a video transition until percent = 1
			percent = 0
		}

		// If the user has forced the transition to its end...
		if (this._currentTransition.shouldForceToEnd === true
			// ... or it is not a video running to its end, and it has actually ended
			|| percent >= 1) {
			this._endLayerTransition(layerTransition)

		// Otherwise just apply the required changes based on time
		} else if (type === "animation") {
			// Continue playing the layerTransition, waiting for its eventual end
			requestAnimationFrame(this._runLayerTransition.bind(this, layerTransition, null))

		} else {
			const { viewportRect } = this._player
			const { width, height } = viewportRect
			const { content } = layer

			if (type === "fade-in") {
				content.setAlpha(percent)
			} else if (type === "fade-out") {
				content.setAlpha(1 - percent)
			} else if (type === "slide-in") {
				switch (direction) {
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
			} else if (type === "slide-out") {
				switch (direction) {
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
			content.setVisibility(true)

			if (layerTransitionPercent === null) {
				requestAnimationFrame(this._runLayerTransition.bind(this, layerTransition, null))
			}
		}
	}

	_endLayerTransition(layerTransition) {
		const { layer, isExiting, slice } = layerTransition

		if (slice) {
			slice.finalizeExit()
			slice.removeFromParent()
		}

		const { content } = layer
		content.setAlpha(1)
		content.setVisibility(true)
		content.setIsXPositionUpdating(false)
		content.setIsYPositionUpdating(false)
		content.resetPosition()

		if (isExiting === true) {
			layer.finalizeExit()
			content.removeFromParent()
		} else {
			layer.finalizeEntry()
		}

		this._currentTransition.nbOfRunningLayerTransitions -= 1

		if (this._currentTransition.nbOfRunningLayerTransitions === 0) {
			const { newStateIndex, endCallback } = this._currentTransition
			this._stateIndex = newStateIndex

			this._layerPile.finalizeEntry()
			this._reset()

			// Run the callback if there was one
			if (endCallback) {
				endCallback()
			}
		}
	}

	// Functions linked to role in LayerPile

	attemptToGoForward(shouldCancelTransition = false, doIfIsUndergoingChanges = null,
		percent = null) { // Go to next state
		const isGoingForward = true
		if (this.isUndergoingChanges === true) { // If has looping layerTransitions
			this.forceChangesToEnd(doIfIsUndergoingChanges, isGoingForward)
			return true
		}
		if (this._statesArray.length === 0 || this._stateIndex >= this._statesArray.length - 1) {
			return false
		}
		this.goToState(this._stateIndex + 1, isGoingForward, shouldCancelTransition, percent)
		return true
	}

	attemptToGoBackward(shouldCancelTransition = false, doIfIsUndergoingChanges = null,
		percent = null) { // Go to previous state
		const isGoingForward = false
		if (this.isUndergoingChanges === true) { // If has looping layerTransitions
			this.forceChangesToEnd(doIfIsUndergoingChanges, isGoingForward)
			return true
		}
		if (this._statesArray.length === 0 || this._stateIndex === 0) {
			return false
		}
		this.goToState(this._stateIndex - 1, isGoingForward, shouldCancelTransition, percent)
		return true
	}

	// Go to start or end state depending on whether goes forward or not
	setupForEntry(isGoingForward) {
		this._reset()

		if (isGoingForward === true) {
			this.goToState(0, isGoingForward)
		} else { // Go to last state
			this.goToState(this._statesArray.length - 1, isGoingForward)
		}
	}

	finalizeExit() {
		this._stateIndex = null
	}

	resize() {
		if (this.isUndergoingChanges === false) {
			return
		}
		this._currentTransition.layerTransitionsArray.forEach((layerTransition) => {
			const { slice } = layerTransition
			if (slice) {
				slice.resize()
			}
		})
	}

}