import LayerTransition from "./LayerTransition"

export default class StateHandler {

	get type() { return this._type }

	// Used in LayerPile

	get isAtStart() { return (this._statesArray.length === 0 || this._stateIndex === 0) }

	get isAtEnd() {
		return (this._statesArray.length === 0
			|| this._stateIndex === this._statesArray.length - 1)
	}

	get isUndergoingChanges() { return (this._currentStateChange.status !== "none") }

	// Used in PageNavigator

	get isUndergoingControlledChanges() { return (this._currentStateChange.status === "controlled") }

	get stateIndex() { return this._stateIndex }

	// User in LayerTransition

	get stateChange() { return this._currentStateChange }

	get viewportRect() { return this._player.viewportRect }

	constructor(layerPile, shouldStateLayersCoexistOutsideTransitions = false, player) {
		this._layerPile = layerPile
		this._shouldStateLayersCoexistOutsideTransitions = shouldStateLayersCoexistOutsideTransitions
		this._player = player

		this._type = "stateHandler"

		// this._isLooping = false

		const { layersArray } = layerPile

		// The _statesArray lists for each state the indices of the layers to add
		// (shouldStateLayersCoexistOutsideTransitions specifies what to do with already present layers)
		this._statesArray = this._createStatesArray(layersArray)

		this._stateIndex = null
		this._resetStateChange()

		this._stateDeltaForTransitionControl = null
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

	_resetStateChange() {
		this._currentStateChange = {
			status: "none",
			isGoingForward: true,
			layerTransitionsArray: [],
			shouldForceToEnd: false,
			endCallback: null,
			newStateIndex: null,
		}
	}

	// Used here and in PageNavigator
	forceChangesToEnd(callback, isGoingForward) {
		// Only run the callback if the movement directions differ
		if (isGoingForward !== this._currentStateChange.isGoingForward) {
			if (this._currentStateChange.status === "none") {
				if (callback) {
					callback()
				}
				return
			} // else
			this._currentStateChange.endCallback = callback
		}
		this._currentStateChange.shouldForceToEnd = true
	}

	goToState(stateIndex, isGoingForward, shouldSkipTransition = false, isChangeControlled = false) {
		if (stateIndex < 0 || stateIndex >= this._statesArray.length) {
			return false
		}

		const {
			layerIndicesToAdd, layerIndicesToRemove,
		} = this._createLayerIndicesToAddAndRemove(stateIndex, isGoingForward)

		if (layerIndicesToAdd.length === 0 && layerIndicesToRemove === 0) {
			this._resetStateChange() // To counter the above shouldForceToEnd = true
			return false
		}

		const layerTransitionsArray = this._createLayerTransitions(layerIndicesToAdd,
			layerIndicesToRemove, isGoingForward)

		if (isChangeControlled === true) {
			let hasControlledTransitions = false
			layerTransitionsArray.forEach((layerTransition) => {
				const { controlled } = layerTransition
				if (controlled === true) {
					hasControlledTransitions = true
				}
			})

			if (hasControlledTransitions === false) {
				return false
			}
		}

		const oldStateIndex = this._stateIndex
		layerIndicesToAdd.forEach((layerIndex) => {
			const layer = this._layerPile.getLayerAtIndex(layerIndex)
			this._addLayerContent(layer, layerIndex, isGoingForward, oldStateIndex)
		})

		layerTransitionsArray.forEach((layerTransition) => {
			const { slice } = layerTransition
			if (slice) {
				this._layerPile.addChild(slice)
			}
		})

		this._currentStateChange.status = "initiated"
		this._currentStateChange.isGoingForward = isGoingForward
		this._currentStateChange.layerTransitionsArray = layerTransitionsArray
		this._currentStateChange.newStateIndex = stateIndex

		// If transitions are to be cancelled, force them to end
		if (shouldSkipTransition === true) {
			this._currentStateChange.shouldForceToEnd = true
		}

		if (this._layerPile.doOnStateChangeStartOrCancel) {
			this._layerPile.doOnStateChangeStartOrCancel(stateIndex, isGoingForward)
		}

		if (isChangeControlled === true) {
			this._currentStateChange.status = "controlled"

		} else {
			this._currentStateChange.status = "looping"

			// Start all layer transitions
			const startTime = Date.now()
			layerTransitionsArray.forEach((layerTransition) => {
				layerTransition.start(startTime)
			})
		}

		return true
	}

	_createLayerIndicesToAddAndRemove(stateIndex, isGoingForward) {
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

		return { layerIndicesToAdd, layerIndicesToRemove }
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

	_createLayerTransitions(layerIndicesToAdd, layerIndicesToRemove, isGoingForward) {
		const layerTransitionsArray = []

		layerIndicesToAdd.forEach((layerIndex) => {
			const layer = this._layerPile.getLayerAtIndex(layerIndex)
			const { entryForward, entryBackward } = layer || {}
			const entry = (isGoingForward === true) ? entryForward : entryBackward
			const isExiting = false
			const layerTransition = new LayerTransition(this, layer, isExiting, entry)
			layerTransitionsArray.push(layerTransition)
		})

		layerIndicesToRemove.forEach((layerIndex) => {
			const layer = this._layerPile.getLayerAtIndex(layerIndex)
			const { exitForward, exitBackward } = layer || {}
			const exit = (isGoingForward === true) ? exitForward : exitBackward
			const isExiting = true
			const layerTransition = new LayerTransition(this, layer, isExiting, exit)
			layerTransitionsArray.push(layerTransition)
		})

		return layerTransitionsArray
	}

	notifyTransitionEnd() {
		const { layerTransitionsArray } = this._currentStateChange
		let nbOfRunningLayerTransitions = 0
		layerTransitionsArray.forEach((layerTransition) => {
			if (layerTransition.isRunning === true) {
				nbOfRunningLayerTransitions += 1
			}
		})

		if (nbOfRunningLayerTransitions === 0) {
			this._endStateChange()
		}
	}

	_endStateChange() {
		const { newStateIndex, endCallback } = this._currentStateChange

		this._stateIndex = newStateIndex

		this._layerPile.finalizeEntry()
		this._resetStateChange()

		// Run the callback if there was one
		if (endCallback) {
			endCallback()
		}
	}

	_cancelStateChange() {
		const { layerTransitionsArray } = this._currentStateChange
		layerTransitionsArray.forEach((layerTransition) => {
			layerTransition.cancel()
		})

		this._resetStateChange()

		if (this._layerPile.doOnStateChangeStartOrCancel) {
			this._layerPile.doOnStateChangeStartOrCancel(this.stateIndex)
		}
	}

	// Functions linked to role in LayerPile

	attemptToGoForward(shouldSkipTransition = false, doIfIsUndergoingChanges = null,
		percent = null) {
		// Disable any new change while a controlled state change is under way
		if (this.isUndergoingControlledChanges === true) {
			return true
		}
		const isGoingForward = true
		// If a (discontinuous) state change is under way
		if (this.isUndergoingChanges === true) {
			// Force it to end if the movement goes the same way
			if (this._currentStateChange.isGoingForward === true) {
				this._currentStateChange.shouldForceToEnd = true
			// Otherwise cancel it to bring the situation back to the initial state
			} else {
				this._cancelStateChange()
			}
			return true
		}
		if (this._statesArray.length === 0 || this._stateIndex >= this._statesArray.length - 1) {
			return false
		}
		this.goToState(this._stateIndex + 1, isGoingForward, shouldSkipTransition, percent)
		return true
	}

	attemptToGoBackward(shouldSkipTransition = false, doIfIsUndergoingChanges = null,
		percent = null) {
		if (this.isUndergoingControlledChanges === true) {
			return true
		}
		const isGoingForward = false
		if (this.isUndergoingChanges === true) {
			if (this._currentStateChange.isGoingForward === false) {
				this._currentStateChange.shouldForceToEnd = true
			} else {
				this._cancelStateChange()
			}
			return true
		}
		if (this._statesArray.length === 0 || this._stateIndex === 0) {
			return false
		}
		this.goToState(this._stateIndex - 1, isGoingForward, shouldSkipTransition, percent)
		return true
	}

	// Go to start or end state depending on whether goes forward or not
	setupForEntry(isGoingForward) {
		this._resetStateChange()

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
		const { layerTransitionsArray } = this._currentStateChange
		layerTransitionsArray.forEach((layerTransition) => {
			layerTransition.resize()
		})
	}

	handleScroll(scrollData, isWheelScroll) {
		if (this._stateIndex === null) {
			return true
		}

		const layersArray = this._statesArray[this._stateIndex]
		if (layersArray.length === 1) {
			const layerIndex = layersArray[0]
			const layer = this._layerPile.getLayerAtIndex(layerIndex)
			const { content } = layer
			if (content.handleScroll
				&& content.handleScroll(scrollData, isWheelScroll) === true) {
				return true
			}
		}

		if (isWheelScroll === true) {
			return true
		}

		const { viewportPercent } = scrollData

		if (!this._stateDeltaForTransitionControl
			|| this.isUndergoingControlledChanges === false) {
			if (viewportPercent > 0) {
				this._stateDeltaForTransitionControl = 1
			} else if (viewportPercent < 0) {
				this._stateDeltaForTransitionControl = -1
			}

		} else if (this.isUndergoingControlledChanges === true) {
			let newStateDelta = null
			if (viewportPercent > 0) {
				newStateDelta = 1
			} else if (viewportPercent < 0) {
				newStateDelta = -1
			}
			if (newStateDelta !== this._stateDeltaForTransitionControl) {
				const shouldBeAnimated = false
				this.endControlledTransition(0, shouldBeAnimated)

				this._stateDeltaForTransitionControl = newStateDelta
				const isGoingForward = (this._stateDeltaForTransitionControl > 0)
				const shouldSkipTransition = false
				const isChangeControlled = true
				return (this.goToState(this._stateIndex + this._stateDeltaForTransitionControl,
					isGoingForward, shouldSkipTransition, isChangeControlled) === true)
			}
		}

		if (this._stateDeltaForTransitionControl === 1
			|| this._stateDeltaForTransitionControl === -1) {

			// Continue controlling changes if controlled changed are under way
			if (this.isUndergoingControlledChanges === true) {
				let percent = viewportPercent * this._stateDeltaForTransitionControl
				percent = Math.min(Math.max(percent, 0), 1)
				this.goToIntermediateState(percent)
				return true
			}

			// Otherwise attempt to start controlled changes
			const isGoingForward = (this._stateDeltaForTransitionControl > 0)
			const shouldSkipTransition = false
			const isChangeControlled = true
			return (this.goToState(this._stateIndex + this._stateDeltaForTransitionControl,
				isGoingForward, shouldSkipTransition, isChangeControlled) === true)
		}

		return false
	}

	goToIntermediateState(percent) {
		const { layerTransitionsArray } = this._currentStateChange
		layerTransitionsArray.forEach((layerTransition) => {
			layerTransition.goToIntermediateState(percent)
		})
	}

	endControlledTransition(viewportPercent, shouldBeAnimated) {
		if (this._stateIndex === null) {
			return true
		}

		const layersArray = this._statesArray[this._stateIndex]
		if (layersArray.length === 1) {
			const layerIndex = layersArray[0]
			const layer = this._layerPile.getLayerAtIndex(layerIndex)
			const { content } = layer
			if (content.endControlledTransition
				&& content.endControlledTransition(viewportPercent, shouldBeAnimated) === true) {
				return true
			}
		}

		if (this.isUndergoingControlledChanges === false) {
			return false
		}

		const percent = Math.abs(viewportPercent)
		if (percent >= 0.5) {
			const { layerTransitionsArray } = this._currentStateChange
			layerTransitionsArray.forEach((layerTransition) => {
				layerTransition.end()
			})

		} else {
			this._cancelStateChange()
		}

		this._stateDeltaForTransitionControl = null
		return true
	}

}