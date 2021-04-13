import * as Utils from "../utils"
import * as constants from "../constants"

export default class ResourceBuilder {

	static createResourceInfoArray(object, player) {
		const {
			href,
			type,
			width,
			height,
			language,
			alternate,
		} = object || {}

		const shouldReturnDefaultValue = false
		const actualWidth = Utils.returnValidValue("positive", width, shouldReturnDefaultValue)
		const actualHeight = Utils.returnValidValue("positive", height, shouldReturnDefaultValue)

		// If no valid href is specified, an object is returned with the specified dimensions
		// to allow for correctly-sized dummy slices (i.e. slices with dummy textures)
		if (!href || Utils.isAString(href) === false) {
			return {
				isValid: false,
				width: actualWidth,
				height: actualHeight,
			}
		}

		// Create the main resource data
		const { path, mediaFragment } = Utils.getPathAndMediaFragment(href)
		const resourceType = Utils.getResourceType(path, type)
		let main = { type: resourceType, path }
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

		// Create alternates (and fallbacks) by flattening the alternate tree
		const alternatesArray = []
		const oldAltParts = {}
		ResourceBuilder._handleAlternateArray(object, alternate, oldAltParts, main, alternatesArray)

		// Now process main...
		let id = ResourceBuilder.getResourceId(main, player)
		main = { id }
		if (mediaFragment) {
			main.fragment = mediaFragment
		}
		const resourceInfoArray = [main]

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

		return { isValid: true, resourceInfoArray }
	}

	// For now, width and height are not taken into account in alternates, however it would be
	// possible to add a "ratio" tag and compute ratios based on specified widths and heights
	static _handleAlternateArray(object, alternateArray, oldAltParts, parentResource,
		alternatesArray) {
		if (!alternateArray || Array.isArray(alternateArray) === false) {
			return
		}
		alternateArray.forEach((alternateObject) => {
			if (alternateObject && alternateObject.href
				&& Utils.isAString(alternateObject.href) === true) {
				// Note that href is indeed the only required property

				const { path, mediaFragment } = Utils.getPathAndMediaFragment(alternateObject.href)
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

				let { type } = alternateObject
				if (!type) {
					type = Utils.getResourceType(path)
				}
				const newAlt = { ...newAltParts, type, path }
				// In the future, we may also think of checking width and height
				if (type === "video") {
					newAlt.fallbacksArray = []
				}
				if (mediaFragment) {
					newAlt.fragment = mediaFragment
				}

				if (hasAtLeastOneTagChange === true || parentResource.type !== type) {
					// If the move was from video to image
					if (parentResource.type === "video" && type === "image") {
						parentResource.fallbacksArray.push(newAlt)
						if (hasAtLeastOneTagChange === true) {
							alternatesArray.push(newAlt)
						}
					} else {
						alternatesArray.push(newAlt)
					}
				}
				ResourceBuilder._handleAlternateArray(object, alternateObject.alternate, newAltParts,
					newAlt, alternatesArray)
			}
		})
	}

	static getResourceId(coreResourceData, player) {
		const { resourceManager } = player
		const id = resourceManager.getResourceId(coreResourceData)
		return id
	}

}