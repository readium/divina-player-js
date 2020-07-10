import { Slice } from "../Slice"
import SliceResource from "./SliceResource"
import Transition from "./Transition"

export default class LinkObject {

	get slice() { return this._slice }

	get transitionForward() { return this._transitionForward }

	get transitionBackward() { return this._transitionBackward }

	get snapPoints() { return this._snapPoints }

	get children() { return this._children }

	constructor(object, parentInfo, player, forcedRole = null) {
		this._slice = null

		// For transitions (will eventually be stored at page level)
		this._transitionForward = null
		this._transitionBackward = null

		// For link object layers (will eventually result in the creation of a segment with states)
		this._children = []

		// For snap points (will eventually be stored at page level)
		this._snapPoints = []

		// Now build slice, children (and their slices) and transitions (and their slices) as required
		this._buildSlicesAndTransitions(object, parentInfo, player, forcedRole)
	}

	_buildSlicesAndTransitions(object, parentInfo = null, player, forcedRole = null) {
		const { properties } = object || {}
		const {
			fit,
			clipped,
			page,
			layers,
			transitionForward,
			transitionBackward,
			snapPoints,
		} = properties || {}

		let sliceFit = null
		if (fit === "contain" || fit === "cover" || fit === "width" || fit === "height") {
			sliceFit = fit
		} else if (parentInfo) { // If a layer slice
			sliceFit = "pixel"
		}

		const sliceClipped = (clipped === true || clipped === false)
			? clipped
			: null

		const pageSide = (page === "left" || page === "right" || page === "center")
			? page
			: null

		let role = forcedRole || "standard"
		if (parentInfo) {
			role = "layersLayer"
		} else if (layers) {
			role = "layersParent"
		}

		const sliceResource = new SliceResource(object, role, sliceFit, sliceClipped, pageSide)

		this._slice = new Slice(sliceResource, player, parentInfo)

		if (!parentInfo && layers) { // No need to consider layers for a child link object
			this._children = layers.map((layerObject, i) => {
				const layerProperties = layerObject.properties || {}
				const {
					entryForward, exitForward, entryBackward, exitBackward,
				} = layerProperties
				// Create a new link object, using this link object's slice as the parent slice
				const parentInformation = {
					slice: this._slice,
					layerIndex: i,
				}
				const linkObject = new LinkObject(layerObject, parentInformation, player)
				return {
					linkObject, entryForward, exitForward, entryBackward, exitBackward,
				}
			})
		}

		// Store more detailed transition information
		if (transitionForward) {
			this._transitionForward = new Transition(transitionForward, player)
		}
		if (transitionBackward) {
			this._transitionBackward = new Transition(transitionBackward, player)
		}

		// Store snap points
		this._snapPoints = snapPoints
	}

}