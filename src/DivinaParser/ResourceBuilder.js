import * as Utils from "../utils"
import * as constants from "../constants"

export default class ResourceBuilder {

	static createResourceInfoArray(object, player) {
		const {
			href,
			type,
			text,
			width,
			height,
			language,
			alternate,
		} = object || {}

		const shouldReturnDefaultValue = false
		const actualWidth = Utils.returnValidValue("positive", width, shouldReturnDefaultValue)
		const actualHeight = Utils.returnValidValue("positive", height, shouldReturnDefaultValue)

		let sliceType = null
		let main = {}

		let mediaFragment = null // Only useful for a "resource" slice

		let resourceInfoArray = []
		let result = {}

		// If no valid href is specified, an object will be returned with the specified dimensions
		// to allow for correctly-sized dummy slices (i.e. slices with dummy textures)
		// - and we shall use a textSlice with no text string to handle that!

		if (text || !href || Utils.isAString(href) === false) {
			sliceType = "text"

			const actualText = (text && Utils.isAString(text) === true) ? text : ""
			main = { text: actualText }

			result = {
				...result,
				width: actualWidth,
				height: actualHeight,
			}

		} else {
			sliceType = "resource"

			const pathAndMediaFragment = Utils.getPathAndMediaFragment(href)
			const { path } = pathAndMediaFragment
			mediaFragment = pathAndMediaFragment.mediaFragment
			const { resourceType, mimeType } = Utils.getResourceAndMimeTypes(path, type)
			main = { type: resourceType, mimeType, path }
			if (actualWidth) {
				main.width = actualWidth
			}
			if (actualHeight) {
				main.height = actualHeight
			}
			if (language && Utils.isAString(language) === true) {
				main.language = language
			}
			if (resourceType === "video") {
				main.fallbacksArray = []
			}
		}

		// Create alternates (and fallbacks) by flattening the alternate tree
		const oldAltParts = {}
		const alternatesArray = []
		ResourceBuilder._handleAlternateArray(object, alternate, oldAltParts, main, alternatesArray,
			sliceType)

		if (sliceType === "text") {
			resourceInfoArray = [main, ...alternatesArray]

		} else { // "resource"
			// Process main...
			let id = ResourceBuilder.getResourceId(main, player)
			main = { id }
			if (mediaFragment) {
				main.fragment = mediaFragment
			}
			resourceInfoArray = [main]

			// ...and alternates
			if (alternatesArray.length > 0) {
				alternatesArray.forEach((alt) => {
					id = ResourceBuilder.getResourceId(alt, player)
					const newAlt = { id }
					if (alt.fragment) {
						newAlt.fragment = alt.fragment
					}
					resourceInfoArray.push(newAlt)
				})
			}
		}

		result = {
			...result,
			type: sliceType,
			resourceInfoArray,
		}

		return result
	}

	// For now, width and height are not taken into account in alternates, however it would be
	// possible to add a "ratio" tag and compute ratios based on specified widths and heights

	static _handleAlternateArray(object, alternateArray, oldAltParts, parentResource,
		alternatesArray, sliceType) {
		if (!alternateArray || Array.isArray(alternateArray) === false) {
			return
		}
		alternateArray.forEach((alternateObject) => {
			const key = (sliceType === "resource") ? "href" : "text"
			const condition = (alternateObject && alternateObject[key]
				&& Utils.isAString(alternateObject[key]) === true)
			if (condition === true) {

				const newAltParts = { ...oldAltParts }
				let hasAtLeastOneTagChange = false
				constants.POSSIBLE_TAG_NAMES.forEach((tagName) => {
					const tagValue = alternateObject[tagName]
					if (tagValue !== undefined && tagValue !== object[tagName]) {
						// Note that, ideally, we should also check that tagValue is acceptable
						newAltParts[tagName] = tagValue
						hasAtLeastOneTagChange = true
					}
				})

				const newAlt = { ...newAltParts }

				if (sliceType === "resource") {
					const { path, mediaFragment } = Utils.getPathAndMediaFragment(alternateObject.href)
					const { type } = alternateObject
					const { resourceType, mimeType } = Utils.getResourceAndMimeTypes(path, type)
					newAlt.type = resourceType
					newAlt.mimeType = mimeType
					newAlt.path = path
					if (resourceType === "video") {
						newAlt.fallbacksArray = []
					}
					if (mediaFragment) {
						newAlt.fragment = mediaFragment
					}
				} else {
					newAlt.text = alternateObject.text
				}

				if (hasAtLeastOneTagChange === true
					|| (sliceType === "resource" && parentResource.type !== newAlt.type)) {
					// If the move was from video to image
					if (sliceType === "resource" && parentResource.type === "video"
						&& newAlt.type === "image") {
						parentResource.fallbacksArray.push(newAlt)
						if (hasAtLeastOneTagChange === true) {
							alternatesArray.push(newAlt)
						}
					} else {
						alternatesArray.push(newAlt)
					}
				}

				ResourceBuilder._handleAlternateArray(object, alternateObject.alternate, newAltParts,
					newAlt, alternatesArray, sliceType)
			}
		})
	}

	static getResourceId(coreResourceData, player) {
		const { resourceManager } = player
		const id = resourceManager.getResourceId(coreResourceData)
		return id
	}

}