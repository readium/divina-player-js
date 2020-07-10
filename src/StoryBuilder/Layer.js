export default class Layer {

	get type() { return this._type }

	get content() { return this._content } // A Container in any case

	get entryForward() { return this._entryForward }

	get exitForward() { return this._exitForward }

	get entryBackward() { return this._entryBackward }

	get exitBackward() { return this._exitBackward }

	get loadStatus() { return (this._content) ? this._content.loadStatus : 0 }

	get size() {
		if (!this._content) {
			return { width: 0, height: 0 }
		}
		return this._content.size
	}

	get resourcePath() {
		if (this._type !== "slice" || !this._content) {
			return null
		}
		return this._content.resourcePath
	}

	// Used in LayerPile: only a layer can be active, and it basically means that its content
	// could be displayed on screen right now (i.e. it is an on-screen page, an on-screen page's
	// on-screen or out-of-screen segment, or such a segment's slice - however slice transitions,
	// which never form the content of a layer, will not be concerned by this property)
	get isActive() { return this._isActive }

	constructor(type, content) {
		this._type = type
		this._content = content

		this._isActive = false
	}

	setParent(parent) {
		if (!this._content) {
			return
		}
		this._content.setParent(parent)
	}

	setEntryForward(entryForward) {
		this._entryForward = entryForward
	}

	setExitForward(exitForward) {
		this._exitForward = exitForward
	}

	setEntryBackward(entryBackward) {
		this._entryBackward = entryBackward
	}

	setExitBackward(exitBackward) {
		this._exitBackward = exitBackward
	}

	attemptToGoForward(shouldCancelTransition, doIfIsUndergoingChanges) {
		if (!this._content || !this._content.attemptToGoForward) {
			return false
		}
		return this._content.attemptToGoForward(shouldCancelTransition, doIfIsUndergoingChanges)
	}

	attemptToGoBackward(shouldCancelTransition, doIfIsUndergoingChanges) {
		if (!this._content || !this._content.attemptToGoBackward) {
			return false
		}
		return this._content.attemptToGoBackward(shouldCancelTransition, doIfIsUndergoingChanges)
	}

	setScale(scale) {
		if (!this._content) {
			return
		}
		this._content.setScale(scale)
	}

	// Recursive functions (used in LayerPile)

	resize() {
		if (!this._content) {
			return
		}
		this._content.resize()
	}

	setupForEntry(isGoingForward) {
		this._isActive = true
		if (!this._content) {
			return
		}
		this._content.setupForEntry(isGoingForward)
	}

	finalizeEntry() {
		if (!this._content) {
			return
		}
		this._content.finalizeEntry()
	}

	finalizeExit() {
		this._isActive = false
		if (!this._content) {
			return
		}
		this._content.finalizeExit()
	}

	// Used in PageNavigator
	getPathsToLoad() {
		if (!this._content) {
			return []
		}

		const fullPathsArray = []

		let pathsArray = this._content.getPathsToLoad()
		fullPathsArray.push(...pathsArray)

		if (this._entryForward) {
			pathsArray = Layer.getPathsForLayerTransition(this._entryForward)
			fullPathsArray.push(...pathsArray)
		}
		if (this._exitForward) {
			pathsArray = Layer.getPathsForLayerTransition(this._exitForward)
			fullPathsArray.push(...pathsArray)
		}
		if (this._entryBackward) {
			pathsArray = Layer.getPathsForLayerTransition(this._entryBackward)
			fullPathsArray.push(...pathsArray)
		}
		if (this._exitBackward) {
			pathsArray = Layer.getPathsForLayerTransition(this._exitBackward)
			fullPathsArray.push(...pathsArray)
		}

		return fullPathsArray
	}

	static getPathsForLayerTransition(layerTransition) {
		const { slice } = layerTransition
		if (!slice) {
			return []
		}
		return slice.getPathsToLoad()
	}

	destroyTexturesIfPossible() {
		if (!this._content) {
			return
		}
		this._content.destroyTexturesIfPossible()

		if (this._entryForward) {
			Layer.destroyTexturesIfPossibleForHalfTransition(this._entryForward)
		}
		if (this._exitForward) {
			Layer.destroyTexturesIfPossibleForHalfTransition(this._exitForward)
		}
		if (this._entryBackward) {
			Layer.destroyTexturesIfPossibleForHalfTransition(this._entryBackward)
		}
		if (this._exitBackward) {
			Layer.destroyTexturesIfPossibleForHalfTransition(this._exitBackward)
		}
	}

	static destroyTexturesIfPossibleForHalfTransition(halfTransition) {
		const { slice } = halfTransition
		if (!slice) {
			return
		}
		slice.destroyTexturesIfPossible()
	}

	getFirstHref() {
		if (!this._content || !this._content.getFirstHref) {
			return null
		}
		return this._content.getFirstHref()
	}

}