import LinkObject from "./LinkObject"
import Transition from "./Transition"

import * as Utils from "../utils"
import * as constants from "../constants"

export default class DivinaParser {

	constructor(player) {
		this._player = player
	}

	loadFromPath(path, pathType) {
		return new Promise((resolve, reject) => {
			DivinaParser.loadJson(path, pathType)
				.then((json) => {
					resolve(this._buildStoryFromJson(json))
				})
				.catch((error) => {
					reject(error)
				})
		})
	}

	static loadJson(path, pathType) { // pathType = "manifest" || "folder"
		return new Promise((resolve, reject) => {
			if (!path) {
				reject(new Error("No path was specified"))
			}
			const xhr = new XMLHttpRequest()
			const manifestPath = (pathType === "manifest")
				? path
				: `${path}/${constants.DEFAULT_MANIFEST_FILENAME}`
			xhr.open("GET", manifestPath)
			xhr.responseType = "text"
			xhr.onload = () => {
				const text = xhr.response
				try {
					const json = JSON.parse(text)
					resolve(json)
				} catch (error) {
					reject(error)
				}
			}
			xhr.onerror = (error) => {
				reject(error)
			}
			xhr.send()
		})
	}

	loadFromJson(json = null) {
		return new Promise((resolve, reject) => {
			if (json) {
				resolve(this._buildStoryFromJson(json))
			} else {
				reject(new Error("No json was passed"))
			}
		})
	}

	_buildStoryFromJson(json) {
		if (!json) {
			return { error: new Error("Manifest is null") }
		}

		const {
			metadata, links, readingOrder, guided,
		} = json
		if (!metadata) {
			return { error: new Error("No metadata") }
		}
		if (!readingOrder) {
			return { error: new Error("No readingOrder") }
		}

		// If there is a link with rel="self" that has a scheme, then use the part of the href
		// before the manifest's filename as the default folder path
		const folderPath = DivinaParser._getFolderPathFromLinks(links)

		// Get relevant metadata
		this._metadata = this._parseMetadata(metadata)

		// Create link objects for readingOrder and guided (if present)
		this._mainLinkObjectsArray = this._parseObjectsList(readingOrder)
		if (guided) {
			this._guidedLinkObjectsArray = this._parseObjectsList(guided)
		}

		// Now create relevant building information for all possible page navigators
		const pageNavigatorsData = this._createPageNavigatorsData()

		return { folderPath, pageNavigatorsData }
	}

	static _getFolderPathFromLinks(links) {
		if (!links || Array.isArray(links) === false || links.length === 0) {
			return null
		}
		let folderPath = null
		links.forEach((link) => {
			const { rel, href } = link
			if (rel === "self" && href && Utils.hasAScheme(href) === true) {
				folderPath = Utils.getFolderPathFromManifestPath(href)
			}
		})
		return folderPath
	}

	_parseMetadata(metadata) {
		const {
			readingProgression,
			language,
			presentation,
		} = metadata

		const shouldReturnDefaultValue = true

		const direction = Utils.returnValidValue("direction", readingProgression, shouldReturnDefaultValue)

		const {
			continuous,
			fit,
			clipped,
			overflow,
			hAlign,
			vAlign,
			spread,
			viewportRatio,
			// orientation,
			sounds,
			backgroundColor,
			fillColor,
			fontFamily,
			fontSize,
			lineHeight,
			letterSpacing,
		} = presentation || {}

		const storyContinuous = Utils.returnValidValue("continuous", continuous, shouldReturnDefaultValue)
		const storyFit = Utils.returnValidValue("fit", fit, shouldReturnDefaultValue)
		const storyClipped = Utils.returnValidValue("clipped", clipped, shouldReturnDefaultValue)
		const storyOverflow = Utils.returnValidValue("overflow", overflow, shouldReturnDefaultValue)
		const storyHAlign = Utils.returnValidValue("hAlign", hAlign, shouldReturnDefaultValue)
		const storyVAlign = Utils.returnValidValue("vAlign", vAlign, shouldReturnDefaultValue)
		const storySpread = Utils.returnValidValue("spread", spread, shouldReturnDefaultValue)

		// Keep viewport ratio if valid
		const storyViewportRatio = DivinaParser._getValidViewportRatio(viewportRatio)

		// Create a languagesArray that will always contain at least "unspecified"
		let languagesArray = ["unspecified"]
		if (language) {
			if (Array.isArray(language) === true) {
				languagesArray = []
				language.forEach((languageItem) => {
					if (Utils.isAString(languageItem) === true) {
						languagesArray.push(languageItem)
					}
				})
			} else if (Utils.isAString(language) === true) {
				languagesArray = [language]
			}
		}

		// Create a soundsArray with valid (global) sounds only (global => no start or end values!)
		const soundsArray = []
		if (sounds && Array.isArray(sounds) === true && sounds.length > 0) {
			sounds.forEach((sound) => {
				const shouldConsiderStartAndEnd = false
				const soundAnimation = LinkObject.getValidSoundAnimation(sound, this._player,
					shouldConsiderStartAndEnd)
				if (soundAnimation) {
					soundsArray.push(soundAnimation)
				}
			})
		}

		// Create text options

		const storyBackgroundColor = Utils.returnValidValue("backgroundColor", backgroundColor,
			shouldReturnDefaultValue)
		const storyFillColor = Utils.returnValidValue("fillColor", fillColor, shouldReturnDefaultValue)
		const storyFontFamily = Utils.returnValidValue("fontFamily", fontFamily, shouldReturnDefaultValue)
		const storyFontSize = Utils.returnValidValue("fontSize", fontSize, shouldReturnDefaultValue)
		const storyLineHeight = Utils.returnValidValue("lineHeight", lineHeight, shouldReturnDefaultValue)
		const storyLetterSpacing = Utils.returnValidValue("letterSpacing", letterSpacing,
			shouldReturnDefaultValue)

		this._textOptions = {
			hAlign: storyHAlign,
			vAlign: storyVAlign,
			backgroundColor: storyBackgroundColor,
			fillColor: storyFillColor,
			fontFamily: storyFontFamily,
			fontSize: storyFontSize,
			lineHeight: storyLineHeight,
			letterSpacing: storyLetterSpacing,
		}

		return {
			direction,
			continuous: storyContinuous,
			fit: storyFit,
			clipped: storyClipped,
			overflow: storyOverflow,
			hAlign: storyHAlign,
			vAlign: storyVAlign,
			spread: storySpread,
			viewportRatio: storyViewportRatio || {},
			languagesArray,
			soundsArray,
		}
	}

	// Check viewport ratio (note that the "exact" constraint is forced as the default)
	static _getValidViewportRatio(viewportRatio) {
		if (!viewportRatio) {
			return null
		}
		const { constraint, aspectRatio } = viewportRatio
		if (Utils.isAString(aspectRatio) === false) {
			return null
		}
		const numeratorAndDenominator = aspectRatio.split(":")
		if (numeratorAndDenominator.length !== 2) {
			return null
		}
		const numerator = Number(numeratorAndDenominator[0])
		const denominator = Number(numeratorAndDenominator[1])
		if (Utils.isANumber(numerator) === false || numerator <= 0
			|| Utils.isANumber(denominator) === false || denominator <= 0) {
			return null
		}
		const shouldReturnDefaultValue = true
		const storyConstraint = Utils.returnValidValue("constraint", constraint, shouldReturnDefaultValue)
		return { constraint: storyConstraint, aspectRatio }
	}

	_parseObjectsList(divinaObjectsList) {
		if (!divinaObjectsList || Array.isArray(divinaObjectsList) === false) {
			return []
		}
		const objectsArray = []
		divinaObjectsList.forEach((divinaObject) => {
			if (divinaObject) {
				const linkObject = new LinkObject(divinaObject, this._player, this._textOptions)
				objectsArray.push(linkObject)
			}
		})
		return objectsArray
	}

	_createPageNavigatorsData() {
		const {
			direction,
			continuous,
			fit,
			clipped,
			overflow,
			hAlign,
			vAlign,
			spread,
			viewportRatio,
			languagesArray,
			soundsArray,
		} = this._metadata

		// Keep only useful data in the metadata object shared by all page navigators
		const cleanMetadata = {
			direction,
			continuous,
			fit,
			clipped,
			overflow,
			hAlign,
			vAlign,
			spread,
			viewportRatio,
			languagesArray,
		}
		const pageNavigatorsData = { metadata: cleanMetadata }

		// Create a "scroll" page navigator for a Divina with continuous=true
		if (continuous === true) {
			pageNavigatorsData.scroll = DivinaParser._createPageNavigatorData("scroll",
				this._mainLinkObjectsArray, soundsArray)

		// Create a "single" page navigator for a Divina with continuous=false
		} else {
			pageNavigatorsData.single = DivinaParser._createPageNavigatorData("single",
				this._mainLinkObjectsArray, soundsArray)

			// Also create a "double" page navigator if the double page reading mode is allowed
			if (spread !== "none") {
				const pageNavDirection = (direction === "rtl") ? "rtl" : "ltr"
				pageNavigatorsData.double = DivinaParser._createPageNavigatorData("double",
					this._mainLinkObjectsArray, soundsArray, pageNavDirection)
			}
		}

		// Create a "guided" page navigator if the Divina has a guided object
		if (this._guidedLinkObjectsArray && this._guidedLinkObjectsArray.length > 0) {
			pageNavigatorsData.guided = DivinaParser._createPageNavigatorData("guided",
				this._guidedLinkObjectsArray, soundsArray)
		}

		return pageNavigatorsData
	}

	static _createPageNavigatorData(pageNavType, linkObjectsArray, globalSoundsArray, direction) {
		// Each page navigator will also have a metadata object
		// (in adddition to shared metadata) with specific information
		let metadata = { hasSounds: false }
		let grouping = null

		switch (pageNavType) {
		case "single":
			grouping = "single"
			break
		case "double":
			metadata = {
				direction, // Direction will be forced to either "ltr" or "rtl"
				forcedFit: "contain",
				forcedClipped: false,
				forcedTransitionType: "cut", // Transitions will be discarded
			}
			grouping = "double"
			break
		case "scroll":
			grouping = "stitched"
			break
		case "guided":
			metadata = {
				forcedFit: "contain",
				forcedClipped: false,
			}
			grouping = "single"
			break
		default:
			break
		}

		const pageNavData = { metadata, pagesDataArray: [] }

		if (globalSoundsArray && globalSoundsArray.length > 0) {
			pageNavData.metadata.hasSounds = true
			pageNavData.globalSoundsArray = globalSoundsArray
		}

		let pageData = { segmentsDataArray: [] }
		let segmentData = {}

		let pageIndex = -1
		let pageSegmentIndex = 0
		let segmentIndex = 0

		if (grouping === "single" || grouping === "stitched") {
			linkObjectsArray.forEach((linkObject) => {
				const {
					slice,
					hAlign,
					vAlign,
					transitionForward,
					transitionBackward,
					snapPointsArray,
					soundAnimationsArray,
					childrenArray,
				} = linkObject
				// Note that visualAnimationsArray will only be considered in a child link object

				// It is time to create a new page...
				if (pageIndex === -1 // ... if we are at the beginning of the story
					|| grouping === "single" // ... or with each new resource in a discontinuous story
					|| transitionForward) { // ... or with each new "chapter" in a "chaptered webtoon"
					if (pageIndex !== -1) {
						pageNavData.pagesDataArray.push(pageData)
					}
					pageIndex += 1
					pageSegmentIndex = 0
					pageData = { segmentsDataArray: [] }
					segmentData = {}
				}

				// Add information to the slice to specify in which page and segment it appears
				slice.setPageNavInfo(pageNavType, { pageIndex, pageSegmentIndex, segmentIndex })
				segmentData.sliceId = slice.id

				// Store align values at segment level for future use (see below)
				if (hAlign) {
					segmentData.hAlign = hAlign
				}
				if (vAlign) {
					segmentData.vAlign = vAlign
				}

				// Only consider transitions on the first segment of a page
				if (transitionForward && pageSegmentIndex === 0) {
					const isForward = true
					const { entry, exit } = Transition.getEntryAndExitTransitions(transitionForward,
						isForward)
					if (pageIndex > 0 && exit) {
						pageNavData.pagesDataArray[pageIndex - 1].exitForward = exit
					}
					pageData.entryForward = entry

					if (transitionForward.slice) {
						transitionForward.slice.setPageNavInfo(pageNavType, {
							pageIndex, pageSegmentIndex, segmentIndex,
						})
					}
				}
				if (transitionBackward && pageSegmentIndex === 0) {
					const isForward = false
					const { entry, exit } = Transition.getEntryAndExitTransitions(transitionBackward,
						isForward)
					if (pageIndex > 0 && entry) {
						pageNavData.pagesDataArray[pageIndex - 1].entryBackward = entry
					}
					pageData.exitBackward = exit

					if (transitionBackward.slice) {
						transitionBackward.slice.setPageNavInfo(pageNavType, {
							pageIndex, pageSegmentIndex, segmentIndex,
						})
					}
				}

				// Handle snap points
				if (snapPointsArray && snapPointsArray.length > 0) {
					segmentData.snapPointsArray = snapPointsArray
				}

				// Handle sounds
				if (soundAnimationsArray && soundAnimationsArray.length > 0) {
					pageNavData.metadata.hasSounds = true
					segmentData.soundAnimationsArray = soundAnimationsArray
				}

				// Handle child link objects
				if (childrenArray && childrenArray.length > 0) {
					segmentData.childrenArray = []
					childrenArray.forEach((child, i) => {
						if (child.linkObject && child.linkObject.slice) {
							const childLinkObject = child.linkObject
							const childSlice = childLinkObject.slice
							childSlice.setPageNavInfo(pageNavType, {
								pageIndex, pageSegmentIndex, segmentIndex,
							})
							const childData = { sliceId: childSlice.id }

							// Deal with transitions
							if (child.entryForward) {
								childData.entryForward = child.entryForward
							}
							if (child.entryBackward) {
								childData.entryBackward = child.entryBackward
							}
							if (child.exitForward) {
								childData.exitForward = child.exitForward
							}
							if (child.exitBackward) {
								childData.exitBackward = child.exitBackward
							}
							if (childLinkObject.transitionForward) {
								const transition = childLinkObject.transitionForward
								const isForward = true
								const { entry, exit } = Transition.getEntryAndExitTransitions(transition, isForward)
								if (i > 0 && exit) {
									segmentData.childrenArray[i - 1].exitForward = exit
								}
								childData.entryForward = entry
							}
							if (childLinkObject.transitionBackward) {
								const transition = childLinkObject.transitionBackward
								const isForward = false
								const { entry, exit } = Transition.getEntryAndExitTransitions(transition, isForward)
								if (i > 0 && entry) {
									segmentData.childrenArray[i - 1].entryBackward = entry
								}
								childData.exitBackward = exit
							}

							// For visual animations (necessarily carried by a child)
							if (childLinkObject.visualAnimationsArray
								&& childLinkObject.visualAnimationsArray.length > 0) {
								childData.visualAnimationsArray = childLinkObject.visualAnimationsArray
							}

							// Note that animation transitions are not allowed for child layers
							segmentData.childrenArray.push(childData)
						}
					})
				}

				pageSegmentIndex += 1
				segmentIndex += 1

				pageData.segmentsDataArray.push(segmentData)
				segmentData = {}
			})

		} else if (grouping === "double") {
			// Snap points, animations and non-global sounds are discarded - and transitions forced to cut

			let lastPageSide = null
			let isLonely = false

			linkObjectsArray.forEach((linkObject, i) => {
				const { slice } = linkObject
				const { pageSide } = slice || {}

				if (pageIndex === -1
					|| (direction === "ltr" && (lastPageSide !== "left" || pageSide !== "right"))
					|| (direction === "rtl" && (lastPageSide !== "right" || pageSide !== "left"))) {

					if (pageIndex !== -1) {
						pageNavData.pagesDataArray.push(pageData)
					}

					pageIndex += 1
					pageSegmentIndex = 0
					pageData = { segmentsDataArray: [] }

					const nextLinkObject = (i < linkObjectsArray.length - 1)
						? linkObjectsArray[i + 1]
						: null
					const nextPageSide = (nextLinkObject && nextLinkObject.slice)
						? nextLinkObject.slice.pageSide
						: null
					if (direction === "ltr") {
						pageSegmentIndex = (pageSide === "right") ? 1 : 0
						if (pageSide === "right"
							|| (pageSide === "left" && nextPageSide !== "right")) {
							// A segment is "alone" if pageSide="center", but it is not "lonely",
							// in the sense that we don't need to create an empty segment next to it
							isLonely = true
						}
					} else { // direction === "rtl"
						pageSegmentIndex = (pageSide === "left") ? 1 : 0
						if (pageSide === "left"
							|| (pageSide === "right" && nextPageSide !== "left")) {
							// Same as above
							isLonely = true
						}
					}
				}

				slice.setPageNavInfo(pageNavType, {
					pageIndex, pageSegmentIndex, segmentIndex, isLonely,
				})

				if (isLonely === true) {
					if (pageSegmentIndex === 0) {
						segmentData = { sliceId: slice.id }
						pageData.segmentsDataArray.push(segmentData)

						// Add an empty segment
						segmentData = {}
						pageData.segmentsDataArray.push(segmentData)
						segmentIndex += 1 // Note that empty segments will also have an index

					} else { // pageSegmentIndex === 1
						// Add an empty segment
						segmentData = {}
						pageData.segmentsDataArray.push(segmentData)
						segmentIndex += 1 // Note that empty segments will also have an index

						segmentData = { sliceId: slice.id }
						pageData.segmentsDataArray.push(segmentData)
					}

				} else {
					segmentData = { sliceId: slice.id }
					pageData.segmentsDataArray.push(segmentData)
				}

				isLonely = false
				lastPageSide = pageSide

				pageSegmentIndex += 1
				segmentIndex += 1
			})
		}

		// Do not forget to add the last created page to the page count and pagesDataArray
		pageIndex += 1
		pageNavData.pagesDataArray.push(pageData)

		// Set hAlign and vAlign for each page based on their first link objects (if there is
		// more than one link object in the page, hAlign and vAlign will not be taken into account
		// in Camera anyway, since the size getter in Page will force a non-overflowing size)
		pageNavData.pagesDataArray.forEach(({ segmentsDataArray = [] }, i) => {
			if (segmentsDataArray.length === 1) {
				const firstSegmentData = segmentsDataArray[0]
				if (firstSegmentData.hAlign) {
					pageNavData.pagesDataArray[i].hAlign = firstSegmentData.hAlign
				}
				if (firstSegmentData.vAlign) {
					pageNavData.pagesDataArray[i].vAlign = firstSegmentData.vAlign
				}
			}
		})

		return pageNavData
	}

}