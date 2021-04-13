import {
	Loader as PixiLoader,
	LoaderResource as PixiLoaderResource,
	Texture as PixiTexture,
	BaseTexture as PixiBaseTexture,
} from "pixi.js-legacy"

import BaseTexture from "./BaseTexture"
import Texture from "./Texture"

export default class Loader {

	get hasTasks() { return (Object.values(this._resourceIdsToLoad).length > 0) }

	constructor() {
		this._loader = new PixiLoader()
		this._loader.onError.add((error, loader, resource) => {
			const { id } = resource
			this._resourceIdsToLoad[id] = false
		})
		this.reset()
	}

	// Kill the ongoing loading operation (if there is one)
	reset() {
		this._resourceIdsToLoad = {}
		this._loader.reset()
	}

	// Add a sourcePath to the list of source paths to load
	add(resourceId, sourcePath) {
		this._resourceIdsToLoad[resourceId] = true
		// Note that loadType is forced to image!
		const name = String(resourceId)
		this._loader.add(name, sourcePath, {
			crossOrigin: "anonymous", loadType: PixiLoaderResource.LOAD_TYPE.IMAGE,
		})
	}

	// For each array of resources (source paths) that have been correctly loaded...
	onComplete(doWithTextureDataArray) {
		if (!doWithTextureDataArray) {
			return
		}
		this._loader.onComplete.add((_, resources) => {
			const textureDataArray = []
			Object.values(resources).forEach((resource) => {
				const { name, texture } = resource // texture here is a PixiJS texture
				const resourceId = Number(name)
				if (this._resourceIdsToLoad[resourceId] === true && texture && texture.baseTexture) {
					const { baseTexture } = texture
					baseTexture.isPowerOfTwo = true
					texture.mipmap = false
					const textureData = {
						resourceId,
						texture: {
							base: new BaseTexture(baseTexture),
							full: new Texture(texture),
						},
					}
					textureDataArray.push(textureData)
					PixiTexture.removeFromCache(texture.pixiTexture)
					PixiBaseTexture.removeFromCache(baseTexture.pixiBaseTexture)
				}
			})
			doWithTextureDataArray(textureDataArray)
		})
	}

	// Load stored source paths
	load() {
		this._loader.load()
	}

}