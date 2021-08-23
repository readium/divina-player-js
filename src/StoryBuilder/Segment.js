import LayerPile from "./LayerPile"

export default class Segment extends LayerPile {

	// Used in StoryBuilder and PageNavigator
	get pageSegmentIndex() { return this._pageSegmentIndex }

	// Used in PageNavigator
	get pageIndex() { return this._pageIndex }

	// Used in Camera and Slice
	get segmentIndex() { return this._segmentIndex }

	// Used in Camera
	get unscaledSize() {
		return (this.layersArray.length > 0)
			? this.layersArray[0].content.unscaledSize
			: { width: 0, height: 0 }
	}

	constructor(pageSegmentIndex, segmentIndex, page, sliceLayersArray, player) {
		const { pageIndex } = page
		const name = `page${pageIndex}Segment${pageSegmentIndex}`
		const isFirstSliceAParentSlice = (sliceLayersArray.length > 1)
		super("segment", name, page, sliceLayersArray, isFirstSliceAParentSlice)

		this._pageIndex = pageIndex
		this._pageSegmentIndex = pageSegmentIndex // Segment index in page
		this._segmentIndex = segmentIndex

		// Add a StateHandler to the Segment if it has multiple layers
		if (sliceLayersArray.length > 1) {
			const shouldStateLayersCoexistOutsideTransitions = true
			this.addStateHandler(shouldStateLayersCoexistOutsideTransitions, player)
		}

		// It is useful to do the following right away for (double page) empty slices,
		// so that their loadStatus equal 2
		this.updateLoadStatus()
	}

	resize() {
		super.resize()

		// If the segment has multiple layers, clip it to its actual size
		if (this.layersArray.length > 1) {
			this.clipToSize(this.size)
		}
	}

}