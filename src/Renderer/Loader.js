import { Loader as PIXILoader } from "pixi.js-legacy"

// Note that the Loader will necessarily store and handle PIXI Textures
// All functions are used in ResourceManager

export default class Loader {

	get hasTasks() { return (Object.values(this._pathsToLoad).length > 0) }

	constructor() {
		this._pathsToLoad = {}

		this._loader = new PIXILoader()
		this._loader.onError.add((error, loader, resource) => {
			const { name } = resource
			this._pathsToLoad[name] = false
		})
	}

	// Kill the ongoing loading operation (if there is one)
	reset() {
		this._pathsToLoad = {}
		this._loader.reset()
	}

	// Add a sourcePath to the list of source paths to load
	add(name, sourcePath) {
		this._pathsToLoad[name] = true
		this._loader.add(name, sourcePath)
	}

	// Load stored source paths
	load() {
		this._loader.load()
	}

	// For each array of resources (source paths) that have been correctly loaded...
	onComplete(doWithTextureDataArray) {
		if (!doWithTextureDataArray) {
			return
		}
		this._loader.onComplete.add((_, resources) => {
			const textureDataArray = []
			Object.values(resources).forEach((resource) => {
				const { name, texture } = resource
				if (this._pathsToLoad[name] === true && texture && texture.baseTexture) {
					const textureData = {
						name,
						baseTexture: texture.baseTexture,
						texture,
					}
					textureDataArray.push(textureData)
				}
			})
			doWithTextureDataArray(textureDataArray)
		})
	}

}