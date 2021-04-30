import { Renderer } from "../Renderer"

import TextManager from "./TextManager"
import InteractionManager from "./InteractionManager"
import ResourceManager from "../ResourceManager"
import TimeAnimationManager from "./TimeAnimationManager"
import EventEmitter from "./EventEmitter"
import DivinaParser from "../DivinaParser"
import TagManager from "./TagManager"
import StoryBuilder from "../StoryBuilder"

import * as Utils from "../utils"

export default class Player {

	// Size of the effective viewport (i.e. once viewport ratio constraint is applied),
	// used in TextureElement, InteractionManager, StateHandler, PageNavigator and Camera
	get viewportRect() { return this._viewportRect }

	// Used in Camera
	get viewportBoundingRect() { return this._renderer.size }

	// Used in Camera
	get options() { return this._options }

	// Used in TextureElement
	get readingMode() { return (this._pageNavigator) ? this._pageNavigator.pageNavType : null }

	// Used in PageNavigator
	get interactionManager() { return this._interactionManager }

	// Used in SliceResource, TextureElement, PageNavigator and TagManager
	get resourceManager() { return this._resourceManager }

	// Used in StoryBuilder
	get timeAnimationManager() { return this._timeAnimationManager }

	// Used in ResourceManager and TagManager
	get slices() { return this._slices }

	// Used in Slice and InteractionManager
	get pageNavigator() { return this._pageNavigator }

	// Used below and in InteractionManager
	get canConsiderInteractions() {
		return (this._pageNavigator && this._resourceManager.haveFirstResourcesLoaded === true)
	}

	// Used in outside app and PageNavigator
	get eventEmitter() { return this._eventEmitter }

	// Used in AudioResource
	get isMuted() { return this._isMuted }

	// The rootElement is the parent DOM element (HTML page's body)
	constructor(rootElement, backgroundColor = null) {
		this._rootElement = rootElement

		// Create the player's renderer
		this._renderer = new Renderer(rootElement, backgroundColor)

		// Create the container that will hold the loading message
		this._textManager = new TextManager(this._renderer.mainContainer)

		// Size the player for the first time
		this._viewportRect = {
			x: 0, y: 0, width: 0, height: 0,
		}
		this.resize()

		// Create the interaction manager (which will deal with user gestures)
		this._interactionManager = new InteractionManager(this, rootElement)

		// Initialize story data
		this._minRatio = null
		this._maxRatio = null
		const shouldReturnDefaultValue = true
		this._spread = Utils.returnValidValue("spread", null, shouldReturnDefaultValue)

		this._tagManager = null
		this._options = {}

		this._startLocator = null
		this._target = { pageIndex: 0, pageSegmentIndex: 0, segmentIndex: 0 }
		this._resourceManager = new ResourceManager(this)

		this._isMuted = true

		this._timeAnimationManager = new TimeAnimationManager(this)

		this._storyData = {}
		this._slices = {}
		this._pageNavigatorsData = {}
		this._pageNavigator = null
		this._wasDoublePageReadingModeAvailable = false

		// Add a resize event listener
		this.resize = this.resize.bind(this)
		window.addEventListener("resize", this.resize)
		window.addEventListener("orientationchange", this._doOnOrientationChange)
		this._timeout = null

		this._eventEmitter = new EventEmitter()

		// Create DivinaParser
		this._divinaParser = new DivinaParser(this)
	}

	// The resize function is called on creating the Player, at the end of _setRatioConstraint
	// and whenever a "resize" event is detected (e.g. after an orientation change)
	resize() {
		if (this._timeout) {
			clearTimeout(this._timeout)
		}
		requestAnimationFrame(() => {
			// Size the renderer based on the rootElement's size
			const { width, height } = this._rootElement.getBoundingClientRect()
			this._renderer.setSize(width, height)

			this._sizeViewport(width, height) // The list of available page navigators may be updated
		})
	}

	// This function sizes the viewport based on the rootElement's size and possible ratio constraints
	_sizeViewport(width, height) {
		let viewportWidth = width
		let viewportHeight = height

		// Get the (target) ratio value that conforms to the viewport ratio constraints
		const applicableRatio = this._getApplicableRatio(width, height)
		const boundingRectRatio = width / height

		const topLeftPoint = { x: 0, y: 0 }

		if (boundingRectRatio >= applicableRatio) {
			// The _rootElement's height becomes the viewport's and constrains the viewport's width
			viewportWidth = height * applicableRatio
			topLeftPoint.x = (width - viewportWidth) / 2

		} else {
			// The _rootElement's width becomes the viewport's and constrains the viewport's height
			viewportHeight = width / applicableRatio
			topLeftPoint.y = (height - viewportHeight) / 2
		}

		// Store the viewport's rectangle
		this._viewportRect = {
			x: topLeftPoint.x, // NOTE THAT x AND y VALUES ARE ONLY USED IN CAMERA, FOR ZOOM!
			y: topLeftPoint.y,
			width: viewportWidth,
			height: viewportHeight,
		}

		// Update the renderer's display (note that zoomFactor is forced to 1 on a resize)
		this.updateDisplayForZoomFactor(1, this._viewportRect)

		// Now resize the current pageNavigator if there is one
		if (this._pageNavigator) {
			this._pageNavigator.resize()
		}

		// Update availability of double reading mode if necessary
		if (this._pageNavigator
			&& this._isDoublePageReadingModeAvailable() !== this._wasDoublePageReadingModeAvailable) {

			const data = { readingMode: this._pageNavigator.pageNavType }
			const actualReadingModes = { ...this._pageNavigatorsData }
			delete actualReadingModes.metadata
			if (this._wasDoublePageReadingModeAvailable === true) {
				delete actualReadingModes.double
				this.setReadingMode("single")
			}
			data.readingModesArray = Object.keys(actualReadingModes)
			this._eventEmitter.emit("readingmodesupdate", data)

			this._wasDoublePageReadingModeAvailable = !this._wasDoublePageReadingModeAvailable
		}
	}

	// Called above and externally
	setReadingMode(readingMode) {
		if (!this._pageNavigator || !readingMode
			|| readingMode === this._pageNavigator.pageNavType) {
			return
		}
		this._setPageNavigator(readingMode)
	}

	// _getApplicableRatio computes the (target) ratio that conforms to viewportRatio constraints
	// Reminder: viewportRatio = { min, max } where both min and max are written as "width:height"
	_getApplicableRatio(width, height) {
		// The default ratio is that of the rootElement's dimensions
		const currentRatio = width / height

		// If there are no viewportRatio constraints, then keep the rootElement's ratio
		if (!this._minRatio && !this._maxRatio) {
			return currentRatio
		}

		// If there's only a min, or only a max, then apply the constraint
		if (this._minRatio && !this._maxRatio) {
			return Math.max(this._minRatio, currentRatio)
		}
		if (this._maxRatio && !this._minRatio) {
			return Math.min(this._maxRatio, currentRatio)
		}

		// If both a min and max are defined, then apply both constraints
		return Math.min(Math.max(currentRatio, this._minRatio), this._maxRatio)
	}

	// Used in _sizeViewport above (after a resize) and in Camera (when changing zoom)
	updateDisplayForZoomFactor(zoomFactor, viewportRect = this._viewportRect) {
		this._renderer.updateDisplay(zoomFactor, viewportRect)
	}

	// If an orientation change is detected, trigger a resize event after half a second
	// (an awkward hack to deal with orientation changes on iOS devices...)
	_doOnOrientationChange() {
		if (this._timeout) {
			clearTimeout(this._timeout)
		}
		this._timeout = setTimeout(this.resize, 500)
	}

	zoom(zoomData) {
		this._pageNavigator.zoom(zoomData)
	}

	_isDoublePageReadingModeAvailable() {
		return (this._spread === "both"
			|| (this._spread === "landscape" && this._viewportRect.width >= this._viewportRect.height))
	}

	// For loading the divina data from a folder path
	openDivinaFromFolderPath(path, locator = null, options = null) {
		const resourceSource = { folderPath: path }
		const asyncLoadFunction = () => (this._divinaParser.loadFromPath(path, "folder"))
		this._loadDataAndBuildStory(asyncLoadFunction, locator, options, resourceSource)
	}

	// For loading the divina data from a manifest path
	openDivinaFromManifestPath(path, locator = null, options = null) {
		const resourceSource = { folderPath: Utils.getFolderPathFromManifestPath(path) }
		const asyncLoadFunction = () => (this._divinaParser.loadFromPath(path, "manifest"))
		this._loadDataAndBuildStory(asyncLoadFunction, locator, options, resourceSource)
	}

	// For loading the divina data from a json and folder path
	openDivinaFromJsonAndFolderPath(json, path, locator = null, options = null) {
		const resourceSource = { folderPath: path }
		const asyncLoadFunction = () => (this._divinaParser.loadFromJson(json))
		this._loadDataAndBuildStory(asyncLoadFunction, locator, options, resourceSource)
	}

	// For loading the divina data from a json
	openDivinaFromJson(json, locator = null, options = null) {
		const path = null
		this.openDivinaFromJsonAndFolderPath(json, path, locator, options)
	}

	// For loading the divina data from data = { json, base64DataByHref }
	openDivinaFromData(data, locator = null, options = null) {
		const resourceSource = { data }
		const json = (data && data.json) ? data.json : null
		const asyncLoadFunction = () => (this._divinaParser.loadFromJson(json))
		this._loadDataAndBuildStory(asyncLoadFunction, locator, options, resourceSource)
	}

	_loadDataAndBuildStory(asyncLoadFunction, locator, options, resourceSource) {
		asyncLoadFunction()
			.then((result) => {
				if (!result || result.error) {
					this._showErrorMessage((result) ? result.error : null)
				} else {
					const { folderPath, pageNavigatorsData } = result
					this._buildStory(locator, options, resourceSource, folderPath, pageNavigatorsData)
				}
			})
			.catch((error) => {
				if (this._textManager) {
					this._showErrorMessage(error)
				} else {
					throw error
				}
			})
	}

	_showErrorMessage(error) {
		if (!this._textManager || !error || !error.message) {
			return
		}
		this._textManager.showMessage({ type: "error", data: error.message })
	}

	_buildStory(locator = null, options = null, resourceSource, folderPath, pageNavigatorsData) {
		this._startLocator = locator
		this._options = options || {}

		// Set allowed story interactions based on options
		this._interactionManager.setStoryInteractions(this._options)

		// Configure resource manager
		const actualResourceSource = resourceSource
		if (folderPath) {
			actualResourceSource.folderPath = folderPath
		}
		this._resourceManager.setResourceSourceAndOptions(actualResourceSource, options)

		const doWithLoadPercentChange = (loadPercent) => {
			if (this._textManager) {
				this._textManager.showMessage({ type: "loading", data: loadPercent })
			}
		}
		this._resourceManager.setDoWithLoadPercentChange(doWithLoadPercentChange)

		this._buildStoryFromPageNavigatorsData(pageNavigatorsData)
	}

	// Used in Slice (on creating the Slice)
	addSlice(id, slice) {
		this._slices[id] = slice
	}

	_buildStoryFromPageNavigatorsData(pageNavigatorsData) {
		this._pageNavigatorsData = pageNavigatorsData

		const { metadata } = this._pageNavigatorsData // Common/shared metadata
		const {
			direction, spread, viewportRatio, languagesArray,
		} = metadata || {}

		// Set spread (used to check whether the double reading mode is available)
		this._spread = spread

		// Update HTML canvas size to conform to viewportRatio constraints (will trigger a resize)
		this._setRatioConstraint(viewportRatio)

		// Create TagManager to store all tags
		// (note that this._slices has been populated thanks to the Slice's constructor)
		this._tagManager = new TagManager(languagesArray, this._slices, this._resourceManager)

		// If required, do something with the information on available reading modes and languages
		const actualReadingModes = { ...this._pageNavigatorsData }
		delete actualReadingModes.metadata

		if (this._pageNavigatorsData.double) {
			if (this._isDoublePageReadingModeAvailable() === true) {
				this._wasDoublePageReadingModeAvailable = true
			} else {
				this._wasDoublePageReadingModeAvailable = false
				delete actualReadingModes.double
			}
		}

		const data = {
			readingProgression: direction,
			readingModesArray: Object.keys(actualReadingModes),
			languagesArray,
		}
		this._eventEmitter.emit("dataparsing", data)

		// Now build (and set) the page navigator to start with
		if (this._pageNavigatorsData.single) {
			this._setPageNavigator("single")
		} else if (this._pageNavigatorsData.scroll) {
			this._setPageNavigator("scroll")
		}
	}

	_setRatioConstraint(viewportRatio) {
		if (!viewportRatio) {
			this._minRatio = null
			this._maxRatio = null
			return
		}

		// Parse viewportRatio properties to compute the applicable min and max ratio
		let minRatio = null
		let maxRatio = null
		const { aspectRatio, constraint } = viewportRatio
		const ratio = Utils.parseAspectRatio(aspectRatio)
		if (!ratio) {
			return
		}
		switch (constraint) {
		case "min":
			minRatio = ratio
			break
		case "max":
			maxRatio = ratio
			break
		case "exact":
			minRatio = ratio
			maxRatio = ratio
			break
		default:
			return
		}

		// If the min and max values are contradictory, then discard them
		if (minRatio && maxRatio && minRatio > maxRatio) {
			return
		}

		// Now store those min and max values and resize the viewport
		this._minRatio = minRatio
		this._maxRatio = maxRatio
		this.resize()
	}

	// Set the pageNavigator, load its first resources and start playing the story
	_setPageNavigator(pageNavType) {
		const oldPageNavigator = this._pageNavigator

		// Get target page and segment indices
		let { href } = this._startLocator || {}
		if (this._resourceManager.haveFirstResourcesLoaded === true) {
			href = (oldPageNavigator) ? oldPageNavigator.getCurrentHref() : null
		}
		if (href) {
			const canUseShortenedHref = true
			this._target = this._getTargetFromHref(pageNavType, href, canUseShortenedHref)
		} else if (this._startLocator && this._startLocator.locations) {
			const { locations, type } = this._startLocator
			const { position, progression } = locations
			if (position !== undefined) {
				const segmentIndex = position
				if (progression !== undefined) {
					this._target = this._getTargetFromSegmentIndex(type || "scroll", segmentIndex)
					this._target.progress = progression
				} else {
					this._target = this._getTargetFromSegmentIndex(type || "single", segmentIndex)
				}
			}
		}

		// Now clean old page navigator
		if (oldPageNavigator) {
			oldPageNavigator.finalizeExit() // Will also remove its container from its parent
		}

		// Create the page navigator
		const pageNavData = this._pageNavigatorsData[pageNavType]
		const sharedMetadata = this._pageNavigatorsData.metadata
		this._pageNavigator = StoryBuilder.createPageNavigator(pageNavType,
			pageNavData, sharedMetadata, this._slices, this)

		// Repopulate the main container
		this._renderer.mainContainer.addChild(this._pageNavigator)

		// Set language if none has been defined yet (otherwise keep it)
		const { tags } = this._tagManager
		const { index, array } = tags.language
		if (index === null) {
			let languageIndex = 0 // The language array is always at least ["unspecified"]
			if (this._options.language) {
				const { language } = this._options
				const foundLanguageIndex = array.indexOf(language)
				if (foundLanguageIndex >= 0) {
					languageIndex = foundLanguageIndex
				}
			}
			const currentLanguage = array[languageIndex]
			const shouldUpdateLoadTasks = false // Since the first ones haven't been created yet
			this.setLanguage(currentLanguage, shouldUpdateLoadTasks)
		}

		// Do any required updates on the calling app side (e.g. color loadViewer cells differently)
		const data = {
			readingMode: pageNavType,
			nbOfPages: this._pageNavigator.nbOfPages,
			hasSounds: (this._pageNavigator.metadata.hasSounds === true),
			isMuted: this._isMuted,
		}
		this._eventEmitter.emit("readingmodechange", data)

		this._updateLoadTasks(this._target)

		// If the story navigator change occurred before the first resources were loaded
		if (this._resourceManager.haveFirstResourcesLoaded === false) {

			// Add a last task to trigger doAfterInitialLoad and start async queue
			// (if not already running)

			const doAfterRunningInitialLoadTasks = () => {

				// Signal the end of the initial load
				this._eventEmitter.emit("initialload", {})

				// Remove the _textManager
				if (this._textManager) {
					this._textManager.destroy()
					this._textManager = null
				}

				this._renderer.applyViewportConstraints() // Before that, would have impacted textManager

				// Now go to the required resource in the current page navigator
				this._goToTarget(this._target)
			}

			const { initialNbOfResourcesToLoad } = this._options
			const forcedNb = (initialNbOfResourcesToLoad !== undefined
				&& Utils.isANumber(initialNbOfResourcesToLoad) && initialNbOfResourcesToLoad > 0)
				? initialNbOfResourcesToLoad
				: null
			this._resourceManager.runInitialTasks(doAfterRunningInitialLoadTasks, forcedNb)

		// Otherwise determine what page the new story navigator should start on by getting the href
		// of the first resource in the page (in the old story navigator)
		} else {
			this._goToTarget(this._target)
		}
	}

	// For reaching a specific resource directly in the story (typically via a table of contents,
	// however it is also used as the first step into the story navigation)
	_getTargetFromHref(readingMode, targetHref, canUseShortenedHref = false) {
		if (!targetHref) {
			return { pageIndex: 0, pageSegmentIndex: 0, segmentIndex: 0 }
		}

		const targetPath = (canUseShortenedHref === true)
			? Utils.getShortenedHref(targetHref) // Which is actually the resource path
			: null

		let hardTarget = null
		let softTarget = null

		Object.values(this._slices).forEach((slice) => {
			const { pageNavInfo } = slice
			const info = pageNavInfo[readingMode]
			if (info) {
				const { href, path } = slice.getHrefAndPath() || {}
				if (hardTarget === null && targetHref === href) {
					hardTarget = info
				} else if (softTarget === null && targetPath === path) {
					softTarget = info
				}
			}
		})

		if (hardTarget) {
			return hardTarget
		}
		if (softTarget) {
			return softTarget
		}
		return { pageIndex: 0, pageSegmentIndex: 0, segmentIndex: 0 }
	}

	_getTargetFromSegmentIndex(readingMode, segmentIndex) {
		let target = { pageIndex: 0, pageSegmentIndex: 0, segmentIndex: 0 }
		if (segmentIndex === undefined) {
			return target
		}

		Object.values(this._slices).forEach((slice) => {
			const { pageNavInfo } = slice
			const info = pageNavInfo[readingMode]
			const { pageIndex, pageSegmentIndex } = info || {}
			if (info && info.segmentIndex === segmentIndex) {
				target = { pageIndex, pageSegmentIndex, segmentIndex }
			}
		})

		return target
	}

	_updateLoadTasks(target) {
		const targetSegmentIndex = (target) ? target.segmentIndex : null
		this._pageNavigator.updateLoadTasks(targetSegmentIndex)
	}

	// Used above or externally (in the latter case the change will be validated here,
	// and note that shouldUpdateLoadTasks is false on first language set)
	setLanguage(language, shouldUpdateLoadTasks = true) {
		this.setTag("language", language, shouldUpdateLoadTasks)
	}

	setTag(tagName, tagValue, shouldUpdateLoadTasks = true) {
		const hasSucceeded = this._tagManager.setTag(tagName, tagValue)
		if (hasSucceeded === false) {
			return
		}

		if (shouldUpdateLoadTasks === true) { // False only on first set
			this._updateLoadTasks(null)
		}

		if (tagName === "language") {
			const data = { language: tagValue }
			this._eventEmitter.emit("languagechange", data)
		}
	}

	_goToTarget(target) {
		const { pageIndex, pageSegmentIndex, progress } = target
		this._target = null
		const shouldSkipTransition = true
		this._pageNavigator.goToPageWithIndex(pageIndex, pageSegmentIndex, progress,
			shouldSkipTransition)
	}

	// Used in VideoTexture (for fallbacks) and Slice (for alternates)
	getBestMatchForCurrentTags(idPathFragmentAndTagsArray) {
		return this._tagManager.getBestMatchForCurrentTags(idPathFragmentAndTagsArray)

	}

	// For accessing a resource in the story from the table of contents
	// (note that this is the only goTo function that can be called before pageNavigator creation)
	goTo(href, canUseShortenedHref = false) { // T
		this._target = this._getTargetFromHref(this.readingMode, href, canUseShortenedHref)
		if (!this._pageNavigator) {
			return
		}

		this._updateLoadTasks(this._target)

		if (this.canConsiderInteractions === true) {
			this._goToTarget(this._target)
		}
	}

	goToPageWithIndex(pageIndex) {
		if (!this._pageNavigator) {
			return
		}
		const actualPageIndex = pageIndex || 0
		const segmentIndex = this._pageNavigator.getIndexOfFirstSegmentInPage(actualPageIndex)
		this._target = { pageIndex: actualPageIndex, pageSegmentIndex: 0, segmentIndex }

		this._updateLoadTasks(this._target)

		if (this.canConsiderInteractions === true) {
			this._goToTarget(this._target)
		}
	}

	goRight() {
		if (this.canConsiderInteractions === false) {
			return
		}
		const shouldGoToMax = false
		this._pageNavigator.go("right", shouldGoToMax)
	}

	goLeft() {
		if (this.canConsiderInteractions === false) {
			return
		}
		const shouldGoToMax = false
		this._pageNavigator.go("left", shouldGoToMax)
	}

	goDown() {
		if (this.canConsiderInteractions === false) {
			return
		}
		const shouldGoToMax = false
		this._pageNavigator.go("down", shouldGoToMax)
	}

	goUp() {
		if (this.canConsiderInteractions === false) {
			return
		}
		const shouldGoToMax = false
		this._pageNavigator.go("up", shouldGoToMax)
	}

	goToMaxRight() {
		if (this.canConsiderInteractions === false) {
			return
		}
		const shouldGoToMax = true
		this._pageNavigator.go("right", shouldGoToMax)
	}

	goToMaxLeft() {
		if (this.canConsiderInteractions === false) {
			return
		}
		const shouldGoToMax = true
		this._pageNavigator.go("left", shouldGoToMax)
	}

	goToMaxDown() {
		if (this.canConsiderInteractions === false) {
			return
		}
		const shouldGoToMax = true
		this._pageNavigator.go("down", shouldGoToMax)
	}

	goToMaxUp() {
		if (this.canConsiderInteractions === false) {
			return
		}
		const shouldGoToMax = true
		this._pageNavigator.go("up", shouldGoToMax)
	}

	setPercentInPage(percent) {
		if (this.canConsiderInteractions === false) {
			return
		}
		this._pageNavigator.setPercentInPage(percent)
	}

	unmute() {
		this._isMuted = false
		if (this._pageNavigator) {
			this._pageNavigator.setIsMuted(false)
		}
	}

	mute() {
		this._isMuted = true
		if (this._pageNavigator) {
			this._pageNavigator.setIsMuted(true)
		}
	}

	// For exiting the application
	destroy() {
		window.removeEventListener("resize", this.resize)
		window.removeEventListener("orientationchange", this._doOnOrientationChange)
		if (this._timeout) {
			clearTimeout(this._timeout)
		}

		if (this._timeAnimationManager) {
			this._timeAnimationManager.destroy()
			this._timeAnimationManager = null
		}

		// Remove textures and event listeners from slices
		Object.values(this._slices).forEach((slice) => {
			slice.destroy()
		})

		if (this._pageNavigator) {
			this._pageNavigator.destroy()
			this._pageNavigator = null
		}

		if (this._resourceManager) {
			this._resourceManager.destroy()
			this._resourceManager = null
		}

		if (this._interactionManager) {
			this._interactionManager.destroy()
			this._interactionManager = null
		}

		if (this._textManager) {
			this._textManager.destroy()
			this._textManager = null
		}

		if (this._renderer) {
			this._renderer.destroy()
			this._renderer = null
		}
	}

}