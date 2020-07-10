import * as Utils from "../utils"
import * as constants from "../constants"

export default class SliceResource {

	get role() { return this._role }

	get fit() { return this._fit }

	get clipped() { return this._clipped }

	get pageSide() { return this._pageSide }

	get type() { return this._type }

	get href() { return this._href }

	get path() { return this._path }

	get mediaFragment() { return this._mediaFragment }

	get width() { return this._width }

	get height() { return this._height }

	// Note that fallback and each alternate[tag] objects will have
	// the same structure = { type, path, mediaFragment, href }

	get fallback() { return this._fallback }

	get alternate() { return this._alternate }

	// Used in Player to list a story's tags
	get usedTags() {
		const tags = {}
		Object.entries(this._alternate || {}).forEach(([tagName, tagData]) => {
			tags[tagName] = Object.keys(tagData)
		})
		return tags
	}

	constructor(object, role, fit, clipped = true, pageSide = null) {
		this._role = role
		this._fit = fit
		this._clipped = clipped
		this._pageSide = pageSide

		const {
			href,
			type,
			width,
			height,
			fallbackHref,
			alternate,
		} = object || {}

		this._type = type
		this._href = href
		this._width = width
		this._height = height

		// If no href is specified, at least dimensions have already been stored
		// to allow for correctly-sized dummy slices (i.e. slices with dummy textures)
		if (!href) {
			return
		}

		const { path, mediaFragment } = Utils.getPathAndMediaFragment(href)
		this._path = path
		this._mediaFragment = mediaFragment

		let resourceType = null
		// To assign a general resourceType, first check the specified value for type
		if (type) {
			const generalType = type.split("/")[0]
			if (generalType === "image" || generalType === "video") {
				resourceType = generalType
			}
		}
		// If the specified value did not provide a relevant resourceType, check the path's extension
		if (!resourceType) {
			resourceType = (Utils.isAVideo(path) === true) ? "video" : "image"
			/*// Other possibility (to allow the image resourceType on allowed extensions only)
			if (isAVideo(path) === true) {
				resourceType = "video"
			} else if (isAnImage(path) === true) {
				resourceType = "image"
			} else {
				return
			}*/
		}
		// Note that the "image" resourceType is thus favored (by default)

		this._type = resourceType

		if (fallbackHref) {
			const fallbackInfo = Utils.getPathAndMediaFragment(fallbackHref)
			this._fallback = {
				...fallbackInfo,
				href: fallbackHref,
			}
		}

		this._alternate = null
		if (alternate) {
			alternate.forEach((alternateObject) => {
				if (alternateObject.href) {
					constants.possibleTagNames.forEach((possibleTagName) => {
						const tagValue = alternateObject[possibleTagName]
						if (tagValue !== undefined) { // Assumption: same type and dimensions
							if (!this._alternate) {
								this._alternate = {}
							}
							if (!this._alternate[possibleTagName]) {
								this._alternate[possibleTagName] = {}
							}
							const alternateInfo = Utils.getPathAndMediaFragment(alternateObject.href)
							this._alternate[possibleTagName][tagValue] = {
								...alternateInfo,
								type: resourceType,
								href: alternateObject.href,
							}
						}
					})
				}
			})
		}
	}

}