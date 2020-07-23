import LayerPile from "./LayerPile"

import * as constants from "../constants"

export default class PageNavigator extends LayerPile {

	// Used in StateHandler
	get doOnStateChangeStart() { return this.updateLoadTasks }

	// Used in Player and ResourceManager
	get type() { return this._type }

	// Used in ResourceManager (and below)
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

	// Used below
	get nbOfPages() { return (this._pagesArray) ? this._pagesArray.length : 0 }

	constructor(type, metadata, pageLayersArray, player) {
		const name = `${type}PageNav`
		const parent = null
		super(name, parent, pageLayersArray)

		this._type = type
		this._metadata = metadata

		const {
			eventEmitter, interactionManager, resourceManager, options,
		} = player
		this._eventEmitter = eventEmitter
		this._interactionManager = interactionManager
		this._resourceManager = resourceManager

		const { allowsDestroy } = options
		this._allowsDestroy = (allowsDestroy === true || allowsDestroy === false)
			? allowsDestroy
			: constants.defaultAllowsDestroy

		const shouldStateLayersCoexistOutsideTransitions = false
		this._addStateHandler(shouldStateLayersCoexistOutsideTransitions, player)

		this._pagesArray = (this._layersArray)
			? this._layersArray.map(({ content }) => (content))
			: []

		this._currentPage = null // The current page will be the page pointed to by pageIndex

		this._targetSegmentIndex = null

		// Pages for which textures are required to be loaded
		this._loadingPageRange = {
			startIndex: null,
			endIndex: null,
		}

		this._tags = null
	}

	setLoadingProperties(maxNbOfPagesBefore, maxNbOfPagesAfter) {
		this._maxNbOfPagesBefore = maxNbOfPagesBefore
		this._maxNbOfPagesAfter = maxNbOfPagesAfter
	}

	// Used above and in Player
	updateLoadTasks(targetPageIndex, oldPathsSet = null) {
		const actualTargetPageIndex = (targetPageIndex === null) ? this.pageIndex : targetPageIndex

		// Update priorities for load tasks (if some tasks are still pending)
		this._resourceManager.updateForTargetPageIndex(actualTargetPageIndex)

		// Determine which pages have been added or removed

		if (oldPathsSet) { // On a reading mode or tag change
			this._loadingPageRange = {
				startIndex: null,
				endIndex: null,
			}
		}

		const { startIndex, endIndex } = this._getPageIndexLoadingRange(actualTargetPageIndex)
		// If start and end indices have not changed, do nothing
		if (startIndex !== this._loadingPageRange.startIndex
			|| endIndex !== this._loadingPageRange.endIndex) {

			const pagesToAddIndices = []
			const pagesToRemoveIndices = []
			// Determine added page indices
			for (let i = startIndex; i <= endIndex; i += 1) {
				if (this._loadingPageRange.startIndex === null
					|| (i < this._loadingPageRange.startIndex || i > this._loadingPageRange.endIndex)
					|| this._layersArray[i].loadStatus === 1
					|| this._layersArray[i].loadStatus === 0
					|| this._pagesArray[i].loadStatus === -1) {
					pagesToAddIndices.push(i)
				}
			}
			// Determine removed page indices
			if (this._loadingPageRange.startIndex !== null) {
				for (let i = this._loadingPageRange.startIndex;
					i <= this._loadingPageRange.endIndex; i += 1) {
					if (i < startIndex || i > endIndex) {
						pagesToRemoveIndices.push(i)
					}
				}
			}
			// Store active page range for next time (i.e. next page change)
			this._loadingPageRange = { startIndex, endIndex }

			// Load relevant textures
			const newPathsSet = new Set() // Used to list all *individual* paths
			pagesToAddIndices.forEach((pageIndex) => {
				const layer = this._getLayerWithIndex(pageIndex)
				if (layer) {
					const pathsArrayAndSliceIdsArray = layer.getPathsToLoad()
					pathsArrayAndSliceIdsArray.forEach(({ pathsArray, sliceId }) => {
						// Reminder: at this stage each pathsArray actually = { pathsArray, sliceId }
						this._resourceManager.loadTexturesAtPaths(pathsArray, sliceId, pageIndex)
						pathsArray.forEach((path) => {
							newPathsSet.add(path)
						})
					})
				}
			})

			// Destroy relevant textures
			if (this._allowsDestroy === true) {

				if (oldPathsSet) {
					const destroyablePathsArray = []
					// All those in old that are not in new!
					oldPathsSet.forEach((oldPath) => {
						let canBeDestroyed = true
						newPathsSet.forEach((newPath) => {
							if (newPath === oldPath) {
								canBeDestroyed = false
							}
						})
						if (canBeDestroyed === true) {
							destroyablePathsArray.push(oldPath)
						}
					})
					destroyablePathsArray.forEach((path) => {
						this._resourceManager.forceDestroyTexturesForPath(path)
					})
				}

				pagesToRemoveIndices.forEach((pageIndex) => {
					const layer = this._getLayerWithIndex(pageIndex)
					if (layer) {
						layer.destroyTexturesIfPossible()
					}
				})
			}
		}
	}

	_getPageIndexLoadingRange(pageIndex) {
		let startIndex = 0
		let endIndex = this.nbOfPages - 1
		if (this._maxNbOfPagesAfter) {
			startIndex = Math.max(0, pageIndex - this._maxNbOfPagesBefore)
			endIndex = Math.min(this.nbOfPages - 1, pageIndex + this._maxNbOfPagesAfter)
		}
		return { startIndex, endIndex }
	}

	// On a successful page change (post-transition), when this.pageIndex (= stateIndex) has changed
	finalizeEntry() {
		if (this.pageIndex < this._pagesArray.length) {
			this._currentPage = this._pagesArray[this.pageIndex]
		} else {
			return
		}
		if (!this._currentPage) {
			return
		}

		// If _doOnStateChangeEnd has been called by a goTo, go to the relevant segment directly
		if (this._targetSegmentIndex !== null) {
			this._currentPage.goToSegmentIndex(this._targetSegmentIndex)
			this._targetSegmentIndex = null
		}

		// If required, do something with the page change information (e.g. signal it via an event)
		const customData = { pageIndex: this.pageIndex, nbOfPages: this.nbOfPages, currentPage: this.currentPage }
		this._eventEmitter.emit("pagechange", customData)
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

	handleScroll(scrollData, isWheelScroll) {
		// If the page is being changed, do nothing
		if (!this._currentPage || this.isUndergoingChanges === true) {
			return
		}
		this._currentPage.handleScroll(scrollData, isWheelScroll)
	}

	zoom(zoomData) {
		if (!this._currentPage || this.isUndergoingChanges === true) {
			return
		}
		this._currentPage.zoom(zoomData)
	}

	// Player functions

	goToPageWithIndex(pageIndex, segmentIndex = null, shouldCancelTransition = false) {
		const isGoingForward = true
		this._targetSegmentIndex = segmentIndex

		if (!this._handler || this._handler.type !== "stateHandler") {
			return
		}

		const callback = () => {
			// If changing pages
			if (pageIndex !== this.pageIndex) {
				this._handler.goToState(pageIndex, isGoingForward, shouldCancelTransition)
				// And then the finalizeEntry above will ensure we go to segmentIndex directly

			// Or if staying on the same page but changing segments
			} else if (this._targetSegmentIndex !== null) {
				this._currentPage.goToSegmentIndex(this._targetSegmentIndex, isGoingForward)
				this._targetSegmentIndex = null
			}
		}

		// If forcing a page change (e.g. via ToC while a transition is running)
		if (this._handler.isUndergoingChanges === true) {
			this._handler.forceChangesToEnd(callback)
		} else {
			callback()
		}
	}

	_getLayerWithIndex(pageIndex) {
		if (this._layersArray.length > 0 && pageIndex >= 0 && pageIndex < this.nbOfPages) {
			const layer = this._layersArray[pageIndex]
			return layer
		}
		return null
	}

	finalizeExit() { // But no need for a setupForEntry
		super.finalizeExit()
		this._currentPage = null
		this.removeFromParent()
	}

	setPercentInCurrentPage(percent) {
		if (!this._currentPage) {
			return
		}
		this._currentPage.setPercent(percent)
	}

	getFirstHrefInCurrentPage() {
		if (!this._currentPage) {
			return null
		}
		return this._currentPage.getFirstHref()
	}

	destroy() {
		this.removeFromParent()
	}

}