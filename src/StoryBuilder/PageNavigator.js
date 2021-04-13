import LayerPile from "./LayerPile"

export default class PageNavigator extends LayerPile {

	// Used in Player and Slice
	get pageNavType() { return this._pageNavType }

	// Used below and in Camera
	get loadingMode() { return this._resourceManager.loadingMode }

	// Used in Camera (for segment loading mode, when using a target goTo
	get isInAGoTo() { return (this._targetPageSegmentIndex !== null) }

	// Used in StateHandler
	get doOnStateChangeStartOrCancel() {
		return (stateIndex, isGoingForward) => this.updatePageLoadTasks(stateIndex, isGoingForward)
	}

	// Used below, in Player and in ResourceManager
	get pageIndex() {
		const pageIndex = (this._handler && this._handler.type === "stateHandler")
			? this._handler.stateIndex
			: 0
		return pageIndex
	}

	// Used in InteractionManager
	get currentPage() { return this._currentPage }

	// Used in Slice

	get metadata() { return this._metadata }

	get segmentRange() { return this._segmentRange }

	// Used below and in Slideshow
	get nbOfPages() { return this._layersArray.length }

	constructor(pageNavType, metadata, pageLayersArray, player) {
		const name = `${pageNavType}PageNav`
		const parent = null
		super("pageNavigator", name, parent, pageLayersArray)

		this._pageNavType = pageNavType
		this._metadata = metadata

		const {
			eventEmitter, interactionManager, resourceManager, timeAnimationManager,
		} = player
		this._eventEmitter = eventEmitter
		this._interactionManager = interactionManager
		this._resourceManager = resourceManager
		this._timeAnimationManager = timeAnimationManager

		const shouldStateLayersCoexistOutsideTransitions = false
		this._addStateHandler(shouldStateLayersCoexistOutsideTransitions, player)

		// Pages and segments have been fully populated by the time we create the PageNavigator
		const allSegmentLayersArray = []
		this._layersArray.forEach((layer) => {
			const page = layer.content
			const { layersArray } = page || {}
			if (layersArray) {
				allSegmentLayersArray.push(...layersArray)
			}
		})
		this._allSegmentLayersArray = allSegmentLayersArray

		this._currentPage = null // The current page will be the page pointed to by pageIndex

		this._targetPageSegmentIndex = null // A segment index in the considered page

		// Segments for which resources are required to be loaded
		this._segmentRange = {
			startIndex: null,
			endIndex: null,
			segmentIndex: null,
		}

		this._tags = null

		this._pageDeltaForTransitionControl = null
	}

	// Used in StoryBuilder
	addSoundData(soundData) {
		if (!this._soundsDataArray) {
			this._soundsDataArray = []
		}
		this._soundsDataArray.push(soundData)
	}

	// Used in Player (targetSegmentIndex can be null in the case of a tag change)
	updateLoadTasks(targetSegmentIndex) {
		// Kill tasks in the async task queue
		this._resourceManager.killPendingLoads()

		// Create async tasks for destroying and loading resources
		// (force an update of teh load tasks within the segment range
		// even if its start and end indices have not changed)
		const forceUpdate = true
		this.updateSegmentLoadTasks(targetSegmentIndex, forceUpdate)
	}

	// Used above (on starting a page change)
	updatePageLoadTasks(targetPageIndex, isGoingForward) {
		const actualTargetSegmentIndex = (isGoingForward === true)
			? this.getIndexOfFirstSegmentInPage(targetPageIndex)
			: this.getIndexOfFirstSegmentInPage(targetPageIndex + 1) - 1

		let segmentRange = {}
		if (this.loadingMode === "page") {
			const pageRange = this._getPageOrSegmentRange("page", targetPageIndex)
			segmentRange = this._getSegmentRangeFromPageRange(pageRange)
		} else {
			segmentRange = this._getPageOrSegmentRange("segment", actualTargetSegmentIndex)
		}
		segmentRange.segmentIndex = actualTargetSegmentIndex

		const forceUpdate = false
		this._updateLoadTasksForSegmentRange(actualTargetSegmentIndex, segmentRange, forceUpdate)
	}

	// Used in Player and Camera
	updateSegmentLoadTasks(segmentIndex, forceUpdate) { // Which is an absolute segment index
		if (segmentIndex === null) { // In the case of a tag change, keep current segmentRange
			this._updateLoadTasksForSegmentRange(this._segmentRange.segmentIndex, this._segmentRange,
				forceUpdate)

		} else {
			const segmentRange = this._getPageOrSegmentRange("segment", segmentIndex)
			segmentRange.segmentIndex = segmentIndex
			this._updateLoadTasksForSegmentRange(segmentIndex, segmentRange, forceUpdate)
		}
	}

	_updateLoadTasksForSegmentRange(targetSegmentIndex, segmentRange, forceUpdate = false) {
		// Update priorities for load tasks (if some tasks are still pending)
		this._resourceManager.updateForTargetSegmentIndex(targetSegmentIndex)

		// Determine which pages have been added or removed
		const { startIndex, endIndex } = segmentRange
		if (forceUpdate === false // forceUpdate = true on a reading mode or tag change, false otherwise
			&& (startIndex === null || endIndex === null
			|| (startIndex === this._segmentRange.startIndex // start and end indices have not changed
				&& endIndex === this._segmentRange.endIndex))) {
			return
		}

		const segmentsToAddIndices = []
		const segmentsToRemoveIndices = []
		// Determine added page indices
		for (let i = startIndex; i <= endIndex; i += 1) {
			if (forceUpdate === true || this._segmentRange.startIndex === null
				|| (i < this._segmentRange.startIndex || i > this._segmentRange.endIndex)
				|| this._allSegmentLayersArray[i].loadStatus === 0) {
				segmentsToAddIndices.push(i)
			}
		}
		// Determine removed page indices
		if (forceUpdate === false // No need to populate the list on a reading mode or tag change
			&& this._segmentRange.startIndex !== null && this._segmentRange.endIndex !== null) {
			for (let i = this._segmentRange.startIndex;
				i <= this._segmentRange.endIndex; i += 1) {
				if (i < startIndex || i > endIndex) {
					segmentsToRemoveIndices.push(i)
				}
			}
		}
		// Store active page range for next time (i.e. next page change)
		this._segmentRange = segmentRange

		// Load relevant resources
		const newResourceIdsSet = new Set() // Used to list all *individual* resource ids
		segmentsToAddIndices.forEach((segmentIndex) => {
			const segmentLayer = this._getSegmentLayerWithIndex(segmentIndex)
			if (segmentLayer) {
				const arrayOfSliceResourceDataArray = []

				// Get ids for resources in transitions (which are stored at page layer level)
				const segment = segmentLayer.content
				const { pageSegmentIndex, pageIndex } = segment
				if (pageSegmentIndex === 0 && pageIndex < this._layersArray.length) {
					const pageLayer = this._layersArray[pageIndex]
					const recursive = false
					const array = pageLayer.getResourceIdsToLoad(recursive, forceUpdate)
					arrayOfSliceResourceDataArray.push(...array)
				}

				// Get ids for resources in slices (including child layers/slices)
				const recursive = true
				const array = segmentLayer.getResourceIdsToLoad(recursive, forceUpdate)
				arrayOfSliceResourceDataArray.push(...array)

				arrayOfSliceResourceDataArray.forEach((sliceResourceDataArray) => {
					this._resourceManager.loadResources(sliceResourceDataArray, segmentIndex)
					sliceResourceDataArray.forEach(({ resourceId }) => {
						newResourceIdsSet.add(resourceId)
					})
				})
			}

			// Handle sound resources
			if (this._soundsDataArray) {
				this._soundsDataArray.forEach((soundData) => {
					const { resourceId, segmentIndicesArray } = soundData
					if (!segmentIndicesArray) { // For a global sound
						this._resourceManager.loadResources([{ resourceId }], segmentIndex)
						newResourceIdsSet.add(resourceId)
					} else {
						let result = false
						segmentsToAddIndices.forEach((index) => {
							if (segmentIndicesArray.includes(index) === true) {
								result = true
							}
						})
						if (result === true) { // SHOULD ONLY BE TRIGGERED ON A PAGE CHANGE, IDEALLY!
							this._resourceManager.loadResources([{ resourceId }], segmentIndex) // SAME AS ABOVE!
							newResourceIdsSet.add(resourceId)
						}
					}
				})
			}
		})

		// Destroy relevant resources
		if (this._resourceManager.allowsDestroy === true) {

			if (forceUpdate === true) {
				// Destroy all resources except those whose ids are in newResourceIdsSet
				const newResourceIdsArray = []
				newResourceIdsSet.forEach((resourceId) => {
					newResourceIdsArray.push(resourceId)
				})
				this._resourceManager.forceDestroyAllResourcesExceptIds(newResourceIdsArray)
			}

			segmentsToRemoveIndices.forEach((segmentIndex) => {
				const segmentLayer = this._getSegmentLayerWithIndex(segmentIndex)
				if (segmentLayer) {
					// Destroy resources in transitions and sound animations
					// (which are stored at page layer level)
					const segment = segmentLayer.content
					const { pageSegmentIndex, pageIndex } = segment
					if (pageSegmentIndex === 0 && pageIndex < this._layersArray.length) {
						const pageLayer = this._layersArray[pageIndex]
						pageLayer.destroyResourcesIfPossible()
					}
					segmentLayer.destroyResourcesIfPossible()
				}
			})
		}
	}

	// Used in Slideshow
	getLastPageSegmentIndexForPage(pageIndex) {
		const page = this._layersArray[pageIndex].content
		const pageSegmentIndex = page.getLastPageSegmentIndex()
		return pageSegmentIndex
	}

	// Used above, in Slideshow and in Player
	getIndexOfFirstSegmentInPage(targetPageIndex) {
		let i = 0
		let nbOfSegments = 0
		while (i < this.nbOfPages && i !== targetPageIndex) {
			const layer = this._layersArray[i]
			const page = layer.content
			const { layersArray } = page
			nbOfSegments += layersArray.length
			i += 1
		}
		return nbOfSegments
	}

	_getPageOrSegmentRange(type, index) {
		let maxIndex = null

		switch (type) {
		case "segment":
			maxIndex = (this._allSegmentLayersArray.length > 0)
				? (this._allSegmentLayersArray.length - 1)
				: null
			break
		default: // "page"
			maxIndex = (this.nbOfPages > 0) ? (this.nbOfPages - 1) : null
			break
		}
		if (maxIndex === null) {
			return { startIndex: null, endIndex: null }
		}

		const { maxNbOfUnitsToLoadAfter, maxNbOfUnitsToLoadBefore } = this._resourceManager

		let startIndex = 0
		let endIndex = maxIndex
		if (maxNbOfUnitsToLoadAfter !== null) {
			startIndex = (maxNbOfUnitsToLoadBefore === null)
				? 0
				: Math.max(0, index - maxNbOfUnitsToLoadBefore)
			endIndex = (maxNbOfUnitsToLoadAfter === null)
				? maxIndex
				: Math.min(maxIndex, index + maxNbOfUnitsToLoadAfter)
		}

		return { startIndex, endIndex }
	}

	_getSegmentRangeFromPageRange(pageRange) {
		let startIndex = 0
		let endIndex = 0
		let currentNbOfSegments = 0
		let hasEndBeenReached = false
		let i = 0
		while (i < this.nbOfPages && hasEndBeenReached === false) {
			if (i === pageRange.startIndex) {
				startIndex = currentNbOfSegments
			}
			const layer = this._layersArray[i]
			const page = layer.content
			const { layersArray } = page
			const nbOfSegmentsInPage = layersArray.length
			currentNbOfSegments += nbOfSegmentsInPage
			if (i === pageRange.endIndex) {
				endIndex = currentNbOfSegments - 1
				hasEndBeenReached = true
			}
			i += 1
		}
		if (hasEndBeenReached === false) {
			endIndex = currentNbOfSegments - 1
		}
		if (endIndex < 0) {
			return { startIndex: null, endIndex: null }
		}
		return { startIndex, endIndex }
	}

	_getSegmentLayerWithIndex(segmentIndex) { // Which is an absolute segment index
		if (this._allSegmentLayersArray.length > 0
			&& segmentIndex >= 0 && segmentIndex < this._allSegmentLayersArray.length) {
			const layer = this._allSegmentLayersArray[segmentIndex]
			return layer
		}
		return null
	}

	// On a successful page change (post-transition), when this.pageIndex (= stateIndex) has changed
	finalizeEntry() {
		if (this.pageIndex < this.nbOfPages) {
			const pageLayer = this._layersArray[this.pageIndex]
			this._currentPage = pageLayer.content
		} else {
			return
		}
		if (!this._currentPage) {
			return
		}

		// If the pageNavigator has sounds to play, and they haven't started playing yet, do it
		if (this._timeAnimationManager) { // DO NOT CREATE IT IF NO ANIMATIONS!!!
			this._timeAnimationManager.initializeAnimations(this.pageIndex)
		}

		// If _doOnStateChangeEnd has been called by a goTo, go to the relevant segment directly
		if (this._targetPageSegmentIndex !== null) { // In a normal page change, this will be null, yes!
			const targetPageSegmentIndex = this._targetPageSegmentIndex
			this._targetPageSegmentIndex = null // To ensure segmentRange update in "segment" loading mode
			this._currentPage.goToSegmentIndex(targetPageSegmentIndex)
		}

		// Signal the page change
		const data = { pageIndex: this.pageIndex, nbOfPages: this.nbOfPages }
		this._eventEmitter.emit("pagechange", data)
	}

	// Used in StateHandler
	getDepthOfNewLayer(oldPageIndex, isGoingForward) {
		if (oldPageIndex < 0 || oldPageIndex >= this._layersArray.length
			|| !this._layersArray[oldPageIndex]) {
			return 1
		}
		const { exitForward, exitBackward } = this._layersArray[oldPageIndex]
		if ((isGoingForward === true && exitForward && exitForward.type === "slide-out")
			|| (isGoingForward === false && exitBackward
				&& (exitBackward.type === "fade-out" || exitBackward.type === "slide-out"))) {
			return 0
		}
		return 1
	}

	attemptStickyStep() {
		if (!this._currentPage || this.isUndergoingChanges === true
			|| this._metadata.overflow !== "paginated") {
			return false
		}
		return this._currentPage.attemptStickyStep()
	}

	zoom(zoomData) {
		if (!this._currentPage || this.isUndergoingChanges === true) {
			return
		}
		this._currentPage.zoom(zoomData)
	}

	// Player functions

	goToPageWithIndex(pageIndex, pageSegmentIndex, shouldSkipTransition = false,
		isChangeControlled = false) {
		let isGoingForward = true
		this._targetPageSegmentIndex = pageSegmentIndex
		if (pageSegmentIndex === null) {
			const targetPage = this._layersArray[pageIndex].content
			this._targetPageSegmentIndex = targetPage.layersArray.length - 1
		}
		if (!this._handler || this._handler.type !== "stateHandler") {
			return
		}

		const callback = () => {
			// If changing pages
			if (pageIndex !== this.pageIndex) {
				if (this.pageIndex !== null) { // isGoingForward remains true otherwise
					isGoingForward = (pageIndex - this.pageIndex > 0)
				}
				this._isInAGoTo = true
				this._handler.goToState(pageIndex, isGoingForward, shouldSkipTransition, isChangeControlled)
				// And then the finalizeEntry above will ensure that
				// we go to _targetPageSegmentIndex directly via goToSegmentIndex

			// Or if staying on the same page but changing segments
			// (in this case, we only need to do the goToSegmentIndex)
			} else {
				this._currentPage.goToSegmentIndex(this._targetPageSegmentIndex, isGoingForward)
				this._targetPageSegmentIndex = null
			}
		}

		// If forcing a page change (e.g. via ToC while a transition is running)
		if (this._handler.isUndergoingChanges === true) {
			this._handler.forceChangesToEnd(callback)
		} else {
			callback()
		}
	}

	setPercentInPage(percent) {
		if (!this._currentPage) {
			return
		}
		this._currentPage.setPercent(percent)
	}

	// On changing PageNavigators

	getCurrentHref() {
		if (!this._currentPage) {
			return null
		}
		return this._currentPage.getCurrentHref()
	}

	finalizeExit() {
		super.finalizeExit()
		this._currentPage = null
		this.removeFromParent()
	}

	setIsMuted(isMuted) {
		if (!this._soundsDataArray) {
			return
		}
		this._soundsDataArray.forEach(({ resourceId }) => {
			const audioResource = this._resourceManager.getResourceWithId(resourceId)
			if (audioResource) {
				if (isMuted === true) {
					audioResource.mute()
				} else {
					audioResource.unmute()
				}
			}
		})
	}

	destroy() {
		this.removeFromParent()
	}

}