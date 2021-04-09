import { Slice } from "../Slice"
import Slideshow from "./Slideshow"
import Page from "./Page"
import Segment from "./Segment"
import Layer from "./Layer"

export default class StoryBuilder {

	static createPageNavigator(pageNavType, pageNavData, sharedMetadata, slices, player) {
		const { metadata, globalSoundsArray } = pageNavData // Note that this metadata is specific
		const fullMetadata = { ...sharedMetadata, ...metadata }

		const pageLayersArray = StoryBuilder.buildPageLayersArray(pageNavType, pageNavData,
			fullMetadata, slices, player)
		const pageNavigator = new Slideshow(pageNavType, fullMetadata, pageLayersArray, player)

		if (globalSoundsArray) { // Global sounds are necessarily time animations
			globalSoundsArray.forEach(({ resourceId }) => {
				pageNavigator.addSoundData({ resourceId }) // No segment indices will mean all pages!
			})

			// Add to TimeAnimationsManager
			const pageIndex = null
			player.timeAnimationManager.addSoundAnimations(globalSoundsArray, pageIndex)
		}

		// Scan all sound animations, storing sound data on the one hand (see just below),
		// and adding time animations to the time animation manager on the other
		let segmentIndex = 0
		const soundDataByResourceId = {}
		const { pagesDataArray } = pageNavData
		pagesDataArray.forEach((pageData, i) => {
			const { segmentsDataArray } = pageData
			segmentsDataArray.forEach((segmentData) => {
				const { soundAnimationsArray } = segmentData
				if (soundAnimationsArray) {
					soundAnimationsArray.forEach((animation) => {
						const { type, resourceId } = animation
						if (!soundDataByResourceId[resourceId]) {
							soundDataByResourceId[resourceId] = []
						}
						const { length } = soundDataByResourceId[resourceId]
						if (length === 0
							|| soundDataByResourceId[resourceId][length - 1] !== i) {
							soundDataByResourceId[resourceId].push(segmentIndex)
						}
						if (type === "time") {
							player.timeAnimationManager.addSoundAnimations([animation], i)
						} // Progress and point animations are dealt with below
					})
				}
				segmentIndex += 1
			})
		})

		// Store all sound data in the page navigator to allow for related load tasks
		Object.entries(soundDataByResourceId).forEach(([resourceId, segmentIndicesArray]) => {
			pageNavigator.addSoundData({ resourceId, segmentIndicesArray })
		})

		return pageNavigator
	}

	static buildPageLayersArray(pageNavType, pageNavData, metadata, slices, player) {
		const { pagesDataArray } = pageNavData
		const { overflow, hAlign, vAlign } = metadata

		const isADoublePage = (pageNavType === "double")

		const pagesArray = []
		let segmentIndex = 0

		// For double pages
		let emptySlice = null
		let lastSlice = null

		pagesDataArray.forEach((pageData, i) => {

			const actualHAlign = pageData.hAlign || hAlign
			const actualVAlign = pageData.vAlign || vAlign

			const page = new Page(i, isADoublePage, overflow, actualHAlign, actualVAlign, player)

			const { segmentsDataArray } = pageData
			segmentsDataArray.forEach((segmentData, j) => {
				const {
					sliceId, childrenArray, snapPointsArray, soundAnimationsArray,
				} = segmentData
				const sliceLayersArray = []

				// If an empty slice (in a double page)
				if (sliceId === undefined) {
					emptySlice = Slice.createEmptySlice(player)
					const emptySliceLayersArray = [new Layer("slice", emptySlice)]
					const emptySegment = new Segment(j, segmentIndex, page, emptySliceLayersArray,
						player)
					page.addSegment(emptySegment)

					if (j === 1) {
						emptySlice._neighbor = lastSlice
						emptySlice = null
						lastSlice = null
					}

				// Otherwise, for a normal page
				} else {
					const slice = slices[sliceId]
					const sliceLayer = new Layer("slice", slice)
					sliceLayersArray.push(sliceLayer)

					// For double pages
					if (emptySlice) { // If emptySlice was in the first position in the page
						emptySlice._neighbor = slice
						emptySlice = null
					}
					lastSlice = slice

					// If there are child layers, add them (the parent one is used to define a reference size)
					if (childrenArray && childrenArray.length > 0) {
						childrenArray.forEach((child) => {
							const childSlice = slices[child.sliceId]
							const childSliceLayer = new Layer("slice", childSlice)

							// Add layer transitions, except for a continuous = true story
							if (pageNavType !== "scroll") {
								const {
									entryForward, exitForward, entryBackward, exitBackward,
								} = child
								if (entryForward) {
									StoryBuilder._setHalfTransition("entryForward", entryForward,
										childSliceLayer)
								}
								if (exitForward) {
									StoryBuilder._setHalfTransition("exitForward", exitForward,
										childSliceLayer)
								}
								if (entryBackward) {
									StoryBuilder._setHalfTransition("entryBackward", entryBackward,
										childSliceLayer)
								}
								if (exitBackward) {
									StoryBuilder._setHalfTransition("exitBackward", exitBackward,
										childSliceLayer)
								}
							}

							sliceLayersArray.push(childSliceLayer)

							if (child.visualAnimationsArray) {
								child.visualAnimationsArray.forEach((animation) => {
									const { type } = animation
									if (type === "progress" || type === "point") {
										page.addSliceAnimation(j, childSlice, animation)
									} else { // type === "time"
										player.timeAnimationManager.addSliceAnimation(childSlice,
											animation, i)
									}
								})
							}
						})
					}

					const segment = new Segment(0, segmentIndex, page, sliceLayersArray, player)
					page.addSegment(segment)

					if (soundAnimationsArray) { // Non-global sounds are linked to a page
						soundAnimationsArray.forEach((animation) => {
							const { type } = animation
							// However time animations will be directly handled by timeAnimationManager
							if (type === "progress" || type === "point") {
								page.addSoundAnimation(j, animation)
							}
						})
					}

					lastSlice = slice
				}

				if (snapPointsArray) {
					page.addSnapPoints(j, snapPointsArray)
				}

				segmentIndex += 1
			})

			pagesArray.push(page)
		})

		// Create pageLayersArray
		const pageLayersArray = pagesArray.map((page) => (new Layer("page", page)))

		// Now assign entry and exit half transitions
		// (if forcedTransitionType="cut", don't add transitions at all)
		const { forcedTransitionType } = metadata
		if (!forcedTransitionType || forcedTransitionType !== "cut") {
			pagesDataArray.forEach((pageData, i) => {
				const {
					entryForward, exitForward, entryBackward, exitBackward,
				} = pageData
				const pageLayer = pageLayersArray[i]
				if (entryForward) {
					StoryBuilder._setHalfTransition("entryForward", entryForward, pageLayer)
				}
				if (exitForward) {
					StoryBuilder._setHalfTransition("exitForward", exitForward, pageLayer)
				}
				if (entryBackward) {
					StoryBuilder._setHalfTransition("entryBackward", entryBackward, pageLayer)
				}
				if (exitBackward) {
					StoryBuilder._setHalfTransition("exitBackward", exitBackward, pageLayer)
				}
			})
		}

		return pageLayersArray
	}

	static _setHalfTransition(type, value, pageLayer) {
		const { slice } = value
		if (slice) {
			const page = pageLayer.content
			slice.setParent(page)
		}
		pageLayer.setHalfTransition(type, value)
	}

}