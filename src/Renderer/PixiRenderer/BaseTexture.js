export default class BaseTexture {

	// Used in Loader
	get pixiBaseTexture() { return this._pixiBaseTexture }

	constructor(pixiBaseTexture) {
		this._pixiBaseTexture = pixiBaseTexture
	}

	destroy() {
		if (!this._pixiBaseTexture) {
			return
		}
		this._pixiBaseTexture.destroy()
	}

}