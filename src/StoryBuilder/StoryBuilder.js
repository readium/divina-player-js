import { Slice } from "../Slice"
import Slideshow from "./Slideshow"
import Page from "./Page"
import Segment from "./Segment"
import Layer from "./Layer"

export default class StoryBuilder {

	static createPageNavigatorsInfo(storyData) {
		const { metadata, mainLinkObjectsArray, guidedLinkObjectsArray } = storyData || {}
		const {
			readingProgression, continuous, fit, overflow, clipped, spread,
		} = metadata || {}

		const cleanMetadata = {
			direction: readingProgression,
			fit,
			overflow,
			clipped,
		}

		const pageNavigatorsInfo = { metadata: cleanMetadata }

		if (continuous === true) {
			pageNavigatorsInfo.scroll = StoryBuilder.createPageNavigatorInfo("scroll",
				mainLinkObjectsArray)
		} else {
			pageNavigatorsInfo.single = StoryBuilder.createPageNavigatorInfo("single",
				mainLinkObjectsArray)

			// If the double page reading mode is a possibility
			if (spread !== "none") {
				const direction = (readingProgression === "rtl") ? "rtl" : "ltr"
				pageNavigatorsInfo.double = StoryBuilder.createPageNavigatorInfo("double",
					mainLinkObjectsArray, direction)
			}
		}

		if (guidedLinkObjectsArray) {
			pageNavigatorsInfo.guided = StoryBuilder.createPageNavigatorInfo("guided",
				guidedLinkObjectsArray)
		}

		return pageNavigatorsInfo
	}

	static createPageNavigatorInfo(type, linkObjectsArray, direction) {
		let metadata = {}
		let grouping = null

		switch (type) {
		case "single":
			grouping = "single"
			break
		case "double": // Transitions will be discarded
			metadata = {
				direction, // Force direction to be ltr or rtl
				forcedFit: "contain",
				forcedTransitionType: "cut",
			}
			grouping = "double"
			break
		case "scroll":
			grouping = "stitched"
			break
		case "guided":
			metadata = {
				forcedFit: "contain",
			}
			grouping = "single"
			break
		default:
			break
		}

		const pageNavInfo = { metadata }

		let pageIndex = -1
		let segmentIndex = 0

		if (grouping === "single" || grouping === "stitched") {
			const transitionsArray = []

			linkObjectsArray.forEach((linkObject) => {
				const {
					slice, transitionForward, transitionBackward, children,
				} = linkObject

				// It is time to create a new page...
				if (pageIndex === -1 // ... if we are at the beginning of the story
					|| grouping === "single" // ... or with each new resource in a discontinuous story
					|| transitionForward) { // ... or with each new "chapter" in a "chaptered webtoon"
					pageIndex += 1
					segmentIndex = 0
				}

				slice.setPageNavInfo(type, { pageIndex, segmentIndex })

				// Only consider transitions on the first segment of a page
				if (transitionForward && segmentIndex === 0) {
					transitionsArray.push({
						transition: transitionForward, isForward: true, pageIndex,
					})
					if (transitionForward.slice) {
						transitionForward.slice.setPageNavInfo(type, { pageIndex, segmentIndex })
					}
				}
				if (transitionBackward && segmentIndex === 0) {
					transitionsArray.push({
						transition: transitionBackward, isForward: false, pageIndex,
					})
					if (transitionBackward.slice) {
						transitionBackward.slice.setPageNavInfo(type, { pageIndex, segmentIndex })
					}
				}

				// For layer slices
				if (children) {
					children.forEach((child) => {
						if (child.linkObject && child.linkObject.slice) {
							const childSlice = child.linkObject.slice
							childSlice.setPageNavInfo(type, { pageIndex, segmentIndex })
						}
					})
				}

				segmentIndex += 1
			})

			pageNavInfo.transitionsArray = transitionsArray

		} else if (grouping === "double") { // Transitions are discarded in double page reading mode

			let lastPageSide = null
			let isLonely = false

			linkObjectsArray.forEach((linkObject, i) => {
				const { slice } = linkObject
				const { resource } = slice || {}
				const { pageSide } = resource || {}

				if (!lastPageSide
					|| lastPageSide === "center" || lastPageSide === null
					|| pageSide === "center" || pageSide === null
					|| (direction === "ltr" && (lastPageSide === "right" || pageSide === "left"))
					|| (direction === "rtl" && (lastPageSide === "left" || pageSide === "right"))) {

					pageIndex += 1

					const nextLinkObject = (i < linkObjectsArray.length - 1)
						? linkObjectsArray[i + 1]
						: null
					const nextPageSide = (nextLinkObject && nextLinkObject.slice
						&& nextLinkObject.slice.resource)
						? nextLinkObject.slice.resource.pageSide
						: null
					if (direction === "ltr") {
						segmentIndex = (pageSide === "right") ? 1 : 0
						if (pageSide === "left" && nextPageSide !== "right") {
							isLonely = true
						}
					} else { // direction === "rtl"
						segmentIndex = (pageSide === "left") ? 1 : 0
						if (pageSide === "right" && nextPageSide !== "left") {
							isLonely = true
						}
					}
				}
				slice.setPageNavInfo(type, { pageIndex, segmentIndex, isLonely })

				isLonely = false
				lastPageSide = pageSide

				segmentIndex += 1
			})
		}

		// Do not forget to add the last created page to the list
		pageIndex += 1

		pageNavInfo.nbOfPages = pageIndex

		return pageNavInfo
	}

	static createPageNavigator(type, linkObjectsArray, pageNavigatorInfo, defaultMetadata, player) {
		const { metadata, transitionsArray } = pageNavigatorInfo
		const fullMetadata = {
			...defaultMetadata,
			...metadata,
		}
		const pageLayersArray = StoryBuilder.buildPageLayersArray(type, fullMetadata, linkObjectsArray,
			transitionsArray, player)
		const pageNavigator = new Slideshow(type, fullMetadata, pageLayersArray, player)
		return pageNavigator
	}

	static buildPageLayersArray(type, metadata, linkObjectsArray, transitionsArray, player) {
		const { overflow } = metadata

		const pagesArray = []

		let currentPageIndex = -1
		let currentSegmentIndex = 0
		let currentPage = null

		linkObjectsArray.forEach((linkObject) => {
			const { slice, children, snapPoints } = linkObject
			const { pageNavInfo } = slice
			const info = pageNavInfo[type]
			if (info) {
				const { pageIndex, segmentIndex, isLonely } = info

				if (pageIndex > currentPageIndex) {
					if (currentPage) {
						pagesArray.push(currentPage)
					}
					currentPageIndex += 1
					currentSegmentIndex = 0

					currentPage = new Page(currentPageIndex, overflow, player)
				}

				const sliceLayersArray = [new Layer("slice", slice)]

				if (children) {
					children.forEach((child) => {
						const {
							entryForward, exitForward, entryBackward, exitBackward,
						} = child
						const layerSlice = child.linkObject.slice
						const sliceLayer = new Layer("slice", layerSlice)
						if (entryForward) {
							sliceLayer.setEntryForward(entryForward)
						}
						if (exitForward) {
							sliceLayer.setExitForward(exitForward)
						}
						if (entryBackward) {
							sliceLayer.setEntryBackward(entryBackward)
						}
						if (exitBackward) {
							sliceLayer.setExitBackward(exitBackward)
						}
						sliceLayersArray.push(sliceLayer)
					})
				}

				// Now create a segment for the slice and add it to the page
				// (do note that, for a divina, a page can only have several segments if continuous=true)

				let segment = null

				if (type === "double" && currentSegmentIndex === 0 && segmentIndex === 1) {
					currentSegmentIndex = 1
					segment = new Segment(currentSegmentIndex, currentPage, sliceLayersArray, player)

					const neighbor = segment
					StoryBuilder.addEmptySegmentToPage(currentPage, 0, neighbor, player)

				} else {
					segment = new Segment(currentSegmentIndex, currentPage, sliceLayersArray, player)
				}

				currentPage.addSegment(segment)

				// If the linkObject has snapPoints, add them to the page too
				if (snapPoints) {
					currentPage.addSnapPointsForLastSegment(snapPoints)
				}

				if (type === "double" && segmentIndex === 0 && isLonely === true) {
					const neighbor = segment
					StoryBuilder.addEmptySegmentToPage(currentPage, 1, neighbor, player)
				}

				currentSegmentIndex += 1
			}
		})

		// Do not forget to add the last created page to the list
		if (currentPage) {
			pagesArray.push(currentPage)
		}

		// Create pageLayerDataArray
		const pageLayersArray = pagesArray.map((page) => (new Layer("page", page)))

		// Now assign entry and exit (half-)transitions
		// If forcedTransitionType === "cut", don't add a transition at all!
		const { forcedTransitionType } = metadata

		if (!forcedTransitionType && transitionsArray) {
			transitionsArray.forEach(({ transition, isForward, pageIndex }) => {
				const { slice } = transition
				if (slice) {
					// Set the second page in the readingOrder as parent for a transition slice
					slice.setParent(pagesArray[pageIndex])
				}

				const { entry, exit } = transition.getEntryAndExitTransitions(isForward)

				if (isForward === true) {
					if (pageIndex > 0) {
						pageLayersArray[pageIndex - 1].setExitForward(exit)
					}
					pageLayersArray[pageIndex].setEntryForward(entry)

				} else {
					if (pageIndex > 0) {
						pageLayersArray[pageIndex - 1].setEntryBackward(entry)
					}
					pageLayersArray[pageIndex].setExitBackward(exit)
				}

			})
		}

		return pageLayersArray
	}

	static addEmptySegmentToPage(page, segmentIndex, neighbor, player) {
		const emptySlice = Slice.createEmptySlice(player, neighbor)
		const emptySliceLayersArray = [new Layer("slice", emptySlice)]
		const emptySegment = new Segment(segmentIndex, page, emptySliceLayersArray, player)
		const shouldAddSegmentAtStart = (segmentIndex === 0)
		page.addSegment(emptySegment, shouldAddSegmentAtStart)
	}

}