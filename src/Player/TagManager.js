import * as constants from "../constants"

export default class TagManager {

	get tags() { return this._tags }

	constructor(languagesArray, slices, resourceManager) {
		this._tags = {
			language: {
				array: languagesArray,
				index: null,
			},
		}
		this._populateTags(slices, resourceManager)
	}

	_populateTags(slices, resourceManager) {
		Object.values(slices).forEach((slice) => {
			const {
				resourceInfoArray, arrayOfResourceInfoArray,
			} = slice
			const fullResourcesArray = arrayOfResourceInfoArray || [resourceInfoArray]
			fullResourcesArray.forEach((individualResourceInfoArray) => {
				this._populateTagsForResourceInfoArray(individualResourceInfoArray, resourceManager)
			})
		})
	}

	_populateTagsForResourceInfoArray(resourceInfoArray, resourceManager) {
		resourceInfoArray.forEach((mainOrAlt) => {

			const { id } = mainOrAlt

			if (id === undefined && mainOrAlt.language) { // For a text version
				const languagesArray = this._tags.language.array
				if (languagesArray.includes(mainOrAlt.language) === false) {
					languagesArray.push(mainOrAlt.language)
				}

			} else { // For a resource version
				const resource = resourceManager.getResourceWithId(id)
				const { tags = {} } = resource || {}
				Object.entries(tags).forEach(([tagName, tagValue]) => {
					if (constants.POSSIBLE_TAG_NAMES.includes(tagName) === true) {
						if (!this._tags[tagName]) {
							this._tags[tagName] = {
								array: [tagValue],
								index: null,
							}
						} else if (this._tags[tagName].array.includes(tagValue) === false) {
							this._tags[tagName].array.push(tagValue)
						}
					}
				})
			}
		})
	}

	setTag(tagName, tagValue) {
		if (!this._tags[tagName]) {
			return false
		}

		const { array } = this._tags[tagName]
		const index = array.indexOf(tagValue)
		if (index < 0) {
			return false
		}

		this._tags[tagName].index = index

		return true
	}

	// Used in VideoTexture (for fallbacks) and Slice (for alternates)
	getBestMatchForCurrentTags(idPathFragmentAndTagsArray) {
		let id = null
		let path = null
		let fragment = null

		let nbOfExactlyMatchingConditions = 0
		let nbOfPassableConditions = 0
		let maxReachedNbOfExactlyMatchingConditions = 0
		let maxReachedNbOfPassableConditions = 0

		// Check which fallback is most appropriate
		idPathFragmentAndTagsArray.forEach((idPathFragmentAndTagsItem) => {
			nbOfExactlyMatchingConditions = 0
			nbOfPassableConditions = 0

			constants.POSSIBLE_TAG_NAMES.forEach((tagName) => {
				const { array, index } = this._tags[tagName] || {}
				if (index !== undefined && array && index < array.length) {
					const tagValue = array[index]
					if (idPathFragmentAndTagsItem[tagName] === tagValue) {
						nbOfExactlyMatchingConditions += 1
					} else if (idPathFragmentAndTagsItem[tagName] === undefined) {
						nbOfPassableConditions += 1
					}
				}
			})

			if (nbOfExactlyMatchingConditions > maxReachedNbOfExactlyMatchingConditions) {
				maxReachedNbOfExactlyMatchingConditions = nbOfExactlyMatchingConditions
				maxReachedNbOfPassableConditions = nbOfPassableConditions
				id = idPathFragmentAndTagsItem.id
				path = idPathFragmentAndTagsItem.path
				fragment = idPathFragmentAndTagsItem.fragment

			} else if (nbOfExactlyMatchingConditions === maxReachedNbOfExactlyMatchingConditions
				&& nbOfPassableConditions > maxReachedNbOfPassableConditions) {
				maxReachedNbOfPassableConditions = nbOfPassableConditions
				id = idPathFragmentAndTagsItem.id
				path = idPathFragmentAndTagsItem.path
				fragment = idPathFragmentAndTagsItem.fragment
			}
		})

		return { id, path, fragment }
	}

}