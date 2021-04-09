import * as constants from "../constants"

export default class CoreResource {

	get id() { return this._id }

	get type() { return this._type }

	get path() { return this._path }

	// Used in Slice

	get width() { return this._width }

	get height() { return this._height }

	get fallbacksArray() { return this._fallbacksArray }

	// Used in Player
	get tags() { return this._tags }

	// Used in ResourceManager

	get hasNotStartedLoading() { return (this._loadStatus === 0) }

	get hasLoadedSomething() { return (this._loadStatus === -1 || this._loadStatus === 2) }

	static get counter() {
		CoreResource._counter = (CoreResource._counter === undefined)
			? 0
			: (CoreResource._counter + 1)
		return CoreResource._counter
	}

	constructor(coreResourceData, player) {
		this._id = CoreResource.counter
		this._player = player

		const {
			type, path, width, height, fallbacksArray,
		} = coreResourceData

		this._type = type
		this._path = path
		if (width) {
			this._width = width
		}
		if (height) {
			this._height = height
		}
		if (fallbacksArray) {
			this._fallbacksArray = fallbacksArray
		}

		this._tags = {}
		constants.POSSIBLE_TAG_NAMES.forEach((tagName) => {
			const tagValue = coreResourceData[tagName]
			if (tagValue !== undefined) {
				this._tags[tagName] = tagValue
			}
		})

		this._loadStatus = 0
	}

	notifyLoadStart() {
		if (this._loadStatus === 0) {
			this._loadStatus = 1
		}
	}

	cancelLoad() {
		this._loadStatus = 0
	}

	forceDestroy() {
		this._loadStatus = 0
	}

}