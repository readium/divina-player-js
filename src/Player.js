import { Renderer } from "./Renderer"

import TextManager from "./TextManager"
import InteractionManager from "./InteractionManager"
import DivinaParser from "./DivinaParser"
import ResourceManager from "./ResourceManager"
import StoryBuilder from "./StoryBuilder"
import EventEmitter from "./EventEmitter"

import * as Utils from "./utils"
import * as constants from "./constants"

export default class Player {

	// Size of the rootElement (used in Camera)
	get rootSize() { return this._renderer.size }

	// Size of the effective viewport (i.e. once viewport ratio constraint is applied),
	// used in TextureElement, InteractionManager, StateHandler, PageNavigator and Cameram
	get viewportRect() { return this._viewportRect }

	// Used in PageNavigator and Camera
	get options() { return this._options }

	// Used in TextureElement
	get readingMode() { return (this._pageNavigator) ? this._pageNavigator.type : null }

	// Used in PageNavigator
	get interactionManager() { return this._interactionManager }

	// Used in TextureElement and PageNavigator
	get resourceManager() { return this._resourceManager }

	// Used in ResourceManager
	get slices() { return this._slices }

	// Used in Slice

	get pageNavigator() { return this._pageNavigator }

	get tags() { return this._tags }

	// Used in outside app and PageNavigator
	get eventEmitter() { return this._eventEmitter }

	// The rootElement is the parent DOM element (HTML page's body)
	constructor(rootElement) {
		this._rootElement = rootElement

		// Create the player's renderer
		this._renderer = new Renderer(rootElement, constants.defaultBackgroundColor)

		// Create the container that will hold the loading message
		this._textManager = new TextManager(this._renderer.mainContainer)

		// Create an object that will pass important variables around
		const defaultRect = {
			x: 0, y: 0, width: 0, height: 0,
		}
		this._rootSize = defaultRect
		this._viewportRect = defaultRect
		this._tags = {}
		this._options = {}

		// Size those managers
		const shouldResizeImmediately = true
		this.resize(shouldResizeImmediately)

		// Create the interaction manager (which will deal with user gestures)
		this._interactionManager = new InteractionManager(this, rootElement)

		// Initialize story data
		this._minRatio = null
		this._maxRatio = null
		this._spread = constants.defaultSpread

		this._startHref = null
		this._haveFirstResourcesLoaded = false
		this._resourceManager = null

		this._maxNbOfPagesBefore = 0
		this._maxNbOfPagesAfter = 0
		this._priorityFactor = 1

		this._storyData = {}
		this._slices = {}
		this._pageNavigatorsInfo = {}
		this._pageNavigator = null
		this._wasDoublePageReadingModeAvailable = false

		this._eventEmitter = new EventEmitter()

		// Add resize event listener
		this.resize = this.resize.bind(this)
		window.addEventListener("resize", this.resize)
	}

	// The resize function is called on creating the Player
	// and whenever a "resize" event is detected (e.g. after an orientation change)
	resize(shouldResizeImmediately = false) {
		const callback = () => {
			const { width, height } = this._rootElement.getBoundingClientRect()

			// Size viewport based on _rootElement's size (and applicable viewport ratio constraints)
			this._sizeViewport(width, height)

			// Now resize the current pageNavigator if there is one
			if (this._pageNavigator) {
				this._pageNavigator.resize()
			}
			// Note that the list of available story navigators can also be updated
		}
		if (shouldResizeImmediately === true) {
			callback()
		} else {
			requestAnimationFrame(callback)
		}
	}

	// This function sizes the viewport based on _rootElement's size and viewport ratio constraints
	_sizeViewport(width, height) {
		let viewportWidth = width
		let viewportHeight = height

		// Get the (target) ratio value that conforms to the viewport ratio constraints
		const applicableRatio = this._getApplicableRatio(width, height)
		const rootElementRatio = width / height

		const topLeftPoint = { x: 0, y: 0 }

		if (rootElementRatio >= applicableRatio) {
			// The _rootElement's height becomes the viewport's and constrains the viewport's width
			viewportWidth = height * applicableRatio
			topLeftPoint.x = (width - viewportWidth) / 2

		} else if (rootElementRatio < applicableRatio) {
			// The _rootElement's width becomes the viewport's and constrains the viewport's height
			viewportHeight = width / applicableRatio
			topLeftPoint.y = (height - viewportHeight) / 2
		}

		// Resize the renderer
		this._renderer.setSize(width, height)

		// Store the viewport's rectangle
		this._viewportRect = {
			x: topLeftPoint.x,
			y: topLeftPoint.y,
			width: viewportWidth,
			height: viewportHeight,
		}

		// Update the renderer's display (note that zoomFactor is forced to 1 on a resize)
		this.updateDisplayForZoomFactor(1, this._viewportRect)

		// Update availability of double reading mode if necessary
		if (this._pageNavigator
			&& this._isDoublePageReadingModeAvailable() !== this._wasDoublePageReadingModeAvailable) {

			const customData = { readingMode: this._pageNavigator.type }
			const actualReadingModes = { ...this._pageNavigatorsInfo }
			delete actualReadingModes.metadata
			if (this._wasDoublePageReadingModeAvailable === true) {
				delete actualReadingModes.double
				this.setReadingMode("single")
			}
			customData.readingModesArray = Object.keys(actualReadingModes)
			this._eventEmitter.emit("readingmodesupdate", customData)

			this._wasDoublePageReadingModeAvailable = !this._wasDoublePageReadingModeAvailable
		}
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

	// Used above (after a resize) and in Camera (when changing zoom)
	updateDisplayForZoomFactor(zoomFactor, viewportRect = this._viewportRect) {
		this._renderer.updateDisplay(viewportRect, zoomFactor)
	}

	_isDoublePageReadingModeAvailable() {
		return (this._spread === "both"
			|| (this._spread === "landscape" && this._viewportRect.width >= this._viewportRect.height))
	}

	// For loading the divina data from a manifest path
	openDivinaFromManifestPath(path, href = null, options = null) {
		const textureSource = { folderPath: Utils.getFolderPathFromManifestPath(path) }
		const parseAndHandleDivinaData = (divinaParser) => { divinaParser.loadFromPath(path, "manifest") }
		this._parseDivina(href, textureSource, options, parseAndHandleDivinaData)
	}

	// For loading the divina data from a folder path
	openDivinaFromFolderPath(path, href = null, options = null) {
		const textureSource = { folderPath: path }
		const parseAndHandleDivinaData = (divinaParser) => { divinaParser.loadFromPath(path, "folder") }
		this._parseDivina(href, textureSource, options, parseAndHandleDivinaData)
	}

	// For loading the divina data from data = { json, base64DataByHref }
	openDivinaFromData(data, href = null, options = null) {
		const textureSource = { data }
		const json = (data && data.json) ? data.json : null
		const parseAndHandleDivinaData = (divinaParser) => { divinaParser.loadFromJson(json) }
		this._parseDivina(href, textureSource, options, parseAndHandleDivinaData)
	}

	_parseDivina(href = null, textureSource, options, parseAndHandleDivinaData) {
		this._startHref = href
		this._options = options || {}

		// Set loading properties, which shall be common to all page navigators
		this._setLoadingProperties()

		// Set allowed story interactions based on options
		this._interactionManager.setStoryInteractions(options)

		const updatedTextureSource = textureSource

		const doWithParsedDivinaData = (parsedDivinaData, updatedFolderPath) => {

			// Create resource manager (now that options and possibly data exist)
			if (updatedFolderPath) {
				updatedTextureSource.folderPath = updatedFolderPath
			}
			this._createResourceManager(updatedTextureSource)

			const { metadata } = parsedDivinaData || {}
			const { readingProgression, orientation } = metadata || {}
			const customData = { readingProgression, orientation }
			this._eventEmitter.emit("jsonload", customData)

			this._buildStoryFromStoryData(parsedDivinaData)
		}
		const divinaParser = new DivinaParser(this, this._textManager, doWithParsedDivinaData)
		parseAndHandleDivinaData(divinaParser)
	}

	_setLoadingProperties() {
		const { maxNbOfPagesAfter } = this._options || {}
		const nbOfPages = (maxNbOfPagesAfter > 0)
			? maxNbOfPagesAfter
			: constants.defaultMaxNbOfPagesAfter
		this._maxNbOfPagesAfter = Math.ceil(nbOfPages)
		this._maxNbOfPagesBefore = Math.ceil(this._maxNbOfPagesAfter * constants.maxShareOfPagesBefore)
		this._priorityFactor = (this._maxNbOfPagesAfter / this._maxNbOfPagesBefore) || 1
	}

	_createResourceManager(textureSource) {
		const doWithLoadPercent = (loadPercent) => {
			if (this._textManager) {
				this._textManager.showMessage({ type: "loading", data: loadPercent })
			}
		}
		this._resourceManager = new ResourceManager(doWithLoadPercent, textureSource, this)
	}

	_buildStoryFromStoryData(storyData) {
		this._storyData = storyData

		const { metadata, mainLinkObjectsArray, guidedLinkObjectsArray } = storyData
		const { spread, viewportRatio } = metadata || {}

		// Set spread (used to check whether the double reading mode is available)
		this._spread = spread

		// Update HTML canvas size to conform to viewportRatio constraints (will trigger a resize)
		this._setRatioConstraint(viewportRatio)

		// Store all slices
		this._slices = this._getSlices(mainLinkObjectsArray, guidedLinkObjectsArray)

		// Store all tags
		const { languagesArray } = metadata
		this._tags = {
			language: {
				array: languagesArray,
				index: null,
			},
		}
		Player.addTagsForSlices(this._tags, this._slices)

		// Now create build info for all available page navigators
		// (note that _pageNavigatorsInfo.metadata will be a (c)leaner version of the above metadata)
		this._pageNavigatorsInfo = StoryBuilder.createPageNavigatorsInfo(storyData)

		// If required, do something with the information on available reading modes and languages
		const actualReadingModes = { ...this._pageNavigatorsInfo }
		delete actualReadingModes.metadata

		if (this._pageNavigatorsInfo.double) {
			if (this._isDoublePageReadingModeAvailable() === true) {
				this._wasDoublePageReadingModeAvailable = true
			} else {
				this._wasDoublePageReadingModeAvailable = false
				delete actualReadingModes.double
			}
		}
		const customData = {
			readingModesArray: Object.keys(actualReadingModes),
			languagesArray,
		}
		this._eventEmitter.emit("pagenavigatorscreation", customData)

		// Now build (and set) the page navigator to start with
		if (this._pageNavigatorsInfo.single) {
			this._setPageNavigator("single")
		} else if (this._pageNavigatorsInfo.guided) {
			this._setPageNavigator("guided")
		} else if (this._pageNavigatorsInfo.scroll) {
			this._setPageNavigator("scroll")
		}
	}

	_setRatioConstraint(viewportRatio) {
		if (!viewportRatio) {
			return
		}

		// Parse viewportRatio properties to compute the applicable min and max ratio
		let minRatio
		let maxRatio
		const { aspectRatio, constraint } = viewportRatio
		const ratio = Utils.parseAspectRatio(aspectRatio)
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
		const shouldResizeImmediately = true
		this.resize(shouldResizeImmediately)
	}

	_getSlices(mainLinkObjectsArray, guidedLinkObjectsArray = null) {
		let slices = {}
		const mainSlices = this._getSlicesFromLinkObjectsArray(mainLinkObjectsArray)
		slices = { ...mainSlices }

		if (guidedLinkObjectsArray) {
			const guidedSlices = this._getSlicesFromLinkObjectsArray(guidedLinkObjectsArray)
			slices = {
				...slices,
				...guidedSlices,
			}
		}

		return slices
	}

	_getSlicesFromLinkObjectsArray(linkObjectsArray) {
		let slices = {}
		linkObjectsArray.forEach((linkObject) => {
			const newSlices = this._getSlicesFromLinkObject(linkObject)
			slices = {
				...slices,
				...newSlices,
			}
		})
		return slices
	}

	_getSlicesFromLinkObject(linkObject) {
		let slices = {}
		const {
			slice, transitionForward, transitionBackward, children,
		} = linkObject
		const { id } = slice
		slices[id] = slice

		if (transitionForward && transitionForward.slice) {
			slices[transitionForward.slice.id] = transitionForward.slice
		}
		if (transitionBackward && transitionBackward.slice) {
			slices[transitionBackward.slice.id] = transitionBackward.slice
		}

		children.forEach((child) => {
			const childSlices = this._getSlicesFromLinkObject(child.linkObject)
			slices = {
				...slices,
				...childSlices,
			}
		})

		return slices
	}

	static addTagsForSlices(tags, slices) {
		Object.values(slices).forEach((slice) => {
			const { resource, resourcesArray } = slice
			if (resource) {
				Player.updateTagsArrayForResource(tags, resource)
			} else if (resourcesArray) {
				resourcesArray.forEach((sequenceResource) => {
					Player.updateTagsArrayForResource(tags, sequenceResource)
				})
			}
		})
	}

	static updateTagsArrayForResource(tags, sliceResource) {
		const updatedTags = { ...tags }
		if (sliceResource && sliceResource.usedTags) {
			Object.entries(sliceResource.usedTags).forEach(([tagName, possibleTagValues]) => {
				if (!updatedTags[tagName]) {
					updatedTags[tagName] = {
						array: [],
						index: null,
					}
				}
				possibleTagValues.forEach((tagValue) => {
					if (updatedTags[tagName].array.indexOf(tagValue) < 0) {
						updatedTags[tagName].array.push(tagValue)
					}
				})
			})
		}
		return tags
	}

	// Set the pageNavigator, load its first resources and start playing the story
	_setPageNavigator(pageNavigatorType) {
		const oldPageNavigator = this._pageNavigator

		const pageNavigatorInfo = this._pageNavigatorsInfo[pageNavigatorType]

		const defaultMetadata = this._pageNavigatorsInfo.metadata

		const { mainLinkObjectsArray, guidedLinkObjectsArray } = this._storyData
		if (pageNavigatorType === "guided") {
			this._pageNavigator = StoryBuilder.createPageNavigator(pageNavigatorType,
				guidedLinkObjectsArray, pageNavigatorInfo, defaultMetadata, this)
		} else {
			this._pageNavigator = StoryBuilder.createPageNavigator(pageNavigatorType,
				mainLinkObjectsArray, pageNavigatorInfo, defaultMetadata, this)
		}

		this._pageNavigator.setLoadingProperties(this._maxNbOfPagesBefore, this._maxNbOfPagesAfter)

		// Set language if none has been defined yet (otherwise keep it)
		const { index, array } = this._tags.language
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
			const shouldUpdatePageNavigator = false
			this.setLanguage(currentLanguage, shouldUpdatePageNavigator)
		}

		// Repopulate the main container
		this._renderer.mainContainer.addChild(this._pageNavigator)

		// Configure _interactionManager depending on the divina's features
		this._interactionManager.setPageNavigator(this._pageNavigator)

		// Create (or update) the _resourceManager's priority function based on the number of pages,
		// while also (killing tasks and re)building the async task queue (and clearing sliceIdsSets
		// so they can be populated again for the considered pageNavigatorType)
		const maxPriority = this._maxNbOfPagesAfter || this._pageNavigator.nbOfPages
		this._resourceManager.reset(maxPriority, this._priorityFactor)


		// Get target page and segment indices
		let href = this._startHref
		if (this._haveFirstResourcesLoaded === true) {
			href = (oldPageNavigator) ? oldPageNavigator.getFirstHrefInCurrentPage() : null
		}
		const canUseShortenedHref = true
		const target = this._getTargetPageAndSegmentIndices(href, canUseShortenedHref)

		// Now clean old story navigator
		if (oldPageNavigator) {
			oldPageNavigator.finalizeExit() // Will also remove its container from its parent
		}

		this._resourceManager.killPendingLoads()

		// Store a list (Set) of used paths
		const oldPathsSet = new Set()
		Object.values(this._slices).forEach((slice) => {
			const pathsArray = slice.unlinkTexturesAndGetPaths()
			pathsArray.forEach((path) => {
				oldPathsSet.add(path)
			})
		})

		// Do any required updates on the calling app side (e.g. color loadViewer cells differently)
		const customData = {
			readingMode: pageNavigatorType,
			nbOfPages: this._pageNavigator.nbOfPages,
		}
		this._eventEmitter.emit("readingmodechange", customData)

		// Populate the resourceManager's textureResources with relevant sliceIds,
		// i.e. only for those slices actually used in this page navigator
		Object.values(this._slices).forEach((slice) => {
			const {
				pageNavInfo, id, resource, resourcesArray,
			} = slice
			if (pageNavInfo[pageNavigatorType]) { // If slice used in this PageNavigator
				const virtualResourcesArray = resourcesArray || [resource]
				virtualResourcesArray.forEach((virtualResource) => {
					this._resourceManager.storeResourceInfo(virtualResource, id)
				})
			}
		})

		// Create async tasks for destroying and loading resources
		this._pageNavigator.updateLoadTasks(target.pageIndex, oldPathsSet)

		// If the story navigator change occurred before the first resources were loaded
		if (this._haveFirstResourcesLoaded === false) {

			// Add a last task to trigger doAfterInitialLoad and start async queue
			// (if not already running)

			const doAfterLoadingFirstPagesOrSegments = () => {
				this._haveFirstResourcesLoaded = true

				// Remove the _textManager
				if (this._textManager) {
					this._textManager.destroy()
					this._textManager = null
				}

				// Signal the end of the initial load
				this._eventEmitter.emit("initialload", {})

				// Now go to required resource in current story navigator
				this._goToTargetPageAndSegmentIndices(target)
			}

			this._resourceManager.addStoryOpenTaskAndLoad(doAfterLoadingFirstPagesOrSegments,
				maxPriority)

		// Otherwise determine what page the new story navigator should start on by getting the href
		// of the first resource in the page (in the old story navigator)
		} else {
			this._goToTargetPageAndSegmentIndices(target)
		}
	}

	// For reaching a specific resource directly in the story (typically via a table of contents,
	// however it is also used as the first step into the story navigation)
	_getTargetPageAndSegmentIndices(targetHref, canUseShortenedHref = false) {
		if (!this._pageNavigator) {
			return { pageIndex: 0, segmentIndex: 0 }
		}
		const { mainLinkObjectsArray, guidedLinkObjectsArray } = this._storyData
		if (this._pageNavigator.type === "guided") {
			return this._getTargetInLinkObjectsArray(targetHref, canUseShortenedHref,
				guidedLinkObjectsArray)
		}
		return this._getTargetInLinkObjectsArray(targetHref, canUseShortenedHref, mainLinkObjectsArray)
	}

	_getTargetInLinkObjectsArray(targetHref, canUseShortenedHref = false, linkObjectsArray) {
		const targetPath = (canUseShortenedHref === true)
			? Utils.getShortenedHref(targetHref) // Which is actually the resource path
			: null

		let hardTarget = null
		let softTarget = null

		linkObjectsArray.forEach((linkObject) => {
			const { slice } = linkObject || {}
			const { resource, pageNavInfo } = slice || {}
			const { href, path } = resource || {}
			if (hardTarget === null && targetHref === href) {
				hardTarget = pageNavInfo[this._pageNavigator.type]
			} else if (softTarget === null && targetPath === path) {
				softTarget = pageNavInfo[this._pageNavigator.type]
			}
		})

		if (hardTarget) {
			return hardTarget
		}
		if (softTarget) {
			return softTarget
		}
		return { pageIndex: 0, segmentIndex: 0 }
	}

	_goToTargetPageAndSegmentIndices(target) {
		const { pageIndex, segmentIndex } = target

		const shouldSkipTransition = true
		this._pageNavigator.goToPageWithIndex(pageIndex || 0, segmentIndex, shouldSkipTransition)
	}

	setReadingMode(readingMode) { // Called externally
		if (!readingMode || readingMode === this._pageNavigator.type) {
			return
		}
		this._setPageNavigator(readingMode)
	}

	// Used above or externally (in the latter case the change will be validated here)
	setLanguage(language, shouldUpdatePageNavigator) {
		this.setTag("language", language, shouldUpdatePageNavigator)
	}

	setTag(tagName, tagValue, shouldUpdatePageNavigator = true) {
		if (!this._tags[tagName]) {
			return
		}

		const { array } = this._tags[tagName]
		const index = array.indexOf(tagValue)
		if (index < 0) {
			return
		}

		this._tags[tagName].index = index

		if (shouldUpdatePageNavigator === true) {
			this._resourceManager.killPendingLoads()

			const oldPathsSet = new Set()
			Object.values(this._slices).forEach((slice) => {
				const pathsArray = slice.unlinkTexturesAndGetPaths()
				pathsArray.forEach((path) => {
					oldPathsSet.add(path)
				})
			})

			// Create async tasks for destroying and loading resources
			const targetPageIndex = null // Keep the same page index
			this._pageNavigator.updateLoadTasks(targetPageIndex, oldPathsSet)
		}

		if (tagName === "language") {
			const customData = { language: tagValue }
			this._eventEmitter.emit("languagechange", customData)
		}
	}

	// For accessing a resource in the story from the table of contents
	goTo(href, canUseShortenedHref = false) {
		// Get target page and segment indices
		const target = this._getTargetPageAndSegmentIndices(href, canUseShortenedHref)

		// Now go to target page and segment indices
		this._goToTargetPageAndSegmentIndices(target)
	}

	goToPageWithIndex(pageIndex) {
		if (!this._pageNavigator || pageIndex === null || pageIndex === undefined) {
			return
		}
		const segmentIndex = null
		const shouldSkipTransition = true
		this._pageNavigator.goToPageWithIndex(pageIndex, segmentIndex, shouldSkipTransition)
	}

	goRight() {
		if (!this._pageNavigator) {
			return
		}
		const shouldGoToTheMax = false
		this._pageNavigator.go("right", shouldGoToTheMax)
	}

	goLeft() {
		if (!this._pageNavigator) {
			return
		}
		const shouldGoToTheMax = false
		this._pageNavigator.go("left", shouldGoToTheMax)
	}

	goDown() {
		if (!this._pageNavigator) {
			return
		}
		const shouldGoToTheMax = false
		this._pageNavigator.go("down", shouldGoToTheMax)
	}

	goUp() {
		if (!this._pageNavigator) {
			return
		}
		const shouldGoToTheMax = false
		this._pageNavigator.go("up", shouldGoToTheMax)
	}

	goToMaxRight() {
		if (!this._pageNavigator) {
			return
		}
		const shouldGoToTheMax = true
		this._pageNavigator.go("right", shouldGoToTheMax)
	}

	goToMaxLeft() {
		if (!this._pageNavigator) {
			return
		}
		const shouldGoToTheMax = true
		this._pageNavigator.go("left", shouldGoToTheMax)
	}

	goToMaxDown() {
		if (!this._pageNavigator) {
			return
		}
		const shouldGoToTheMax = true
		this._pageNavigator.go("down", shouldGoToTheMax)
	}

	goToMaxUp() {
		if (!this._pageNavigator) {
			return
		}
		const shouldGoToTheMax = true
		this._pageNavigator.go("up", shouldGoToTheMax)
	}

	setPercentInPage(percent) {
		if (!this._pageNavigator) {
			return
		}
		this._pageNavigator.setPercentInCurrentPage(percent)
	}

	// For exiting the application
	destroy() {
		window.removeEventListener("resize", this.resize)

		if (this._pageNavigator) {
			this._pageNavigator.destroy()
		}

		// Remove textures and event listeners from slices
		Object.values(this._slices).forEach((slice) => {
			slice.destroy()
		})

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

		this._renderer.destroy()
		this._renderer = null
	}

}
