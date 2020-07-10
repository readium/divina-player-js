import LayerPile from "./LayerPile"

export default class Segment extends LayerPile {

	// Used in StoryBuilder
	get segmentIndex() { return this._segmentIndex }

	constructor(segmentIndex, page, sliceLayersArray, player) {
		const { pageIndex } = page
		const name = `page${pageIndex}Segment${segmentIndex}`
		const isFirstSliceAParentSlice = (sliceLayersArray.length > 1)
		super(name, page, sliceLayersArray, isFirstSliceAParentSlice)

		this._pageIndex = pageIndex
		this._segmentIndex = segmentIndex

		// Add a StateHandler to the Segment if it has multiple layers
		if (sliceLayersArray.length > 1) {
			const shouldStateLayersCoexistOutsideTransitions = true
			this._addStateHandler(shouldStateLayersCoexistOutsideTransitions, player)
		}

		// It is useful to do the following right away for (double page) empty slices,
		// so that their loadStatus will always be = 2
		this.updateLoadStatus()
	}

}