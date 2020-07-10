import LinkObject from "./LinkObject"

import * as constants from "../constants"

export default class DivinaParser {

	constructor(player, textManager, doWithParsedDivinaData) {
		this._player = player
		this._textManager = textManager
		this._doWithParsedDivinaData = doWithParsedDivinaData
	}

	loadFromPath(folderPath) {
		DivinaParser.loadJson(folderPath)
			.then((json) => {
				this._buildStoryFromJson(json)
			}, (error) => {
				if (this._textManager) {
					this._textManager.showMessage({
						type: "error", data: error.message,
					})
				}
			})
	}

	static loadJson(folderPath) {
		return new Promise((resolve, reject) => {
			if (!folderPath) {
				reject(Error("No folder path was specified"))
			}
			const xhr = new XMLHttpRequest()
			xhr.open("GET", `${folderPath}/${constants.defaultManifestFilename}`)
			xhr.responseType = "text"
			xhr.onload = () => {
				const text = xhr.response
				try {
					const json = JSON.parse(text)
					resolve(json)
				} catch (error) {
					reject(error)
				}
			}
			xhr.onerror = (error) => {
				reject(error)
			}
			xhr.send()
		})
	}

	loadFromData(data) {
		if (data && data.json) {
			this._buildStoryFromJson(data.json)
		}
	}

	loadFromJsonAndPath(json) {
		this._buildStoryFromJson(json)
	}

	_buildStoryFromJson(json) {
		const { metadata, readingOrder, guided } = json
		if (!metadata || !readingOrder) {
			if (this._textManager) {
				this._textManager.showMessage({
					type: "error", data: "Missing metadata or readingOrder information",
				})
			}
			return
		}

		const parsedMetadata = this._parseMetadata(metadata)
		if (!parsedMetadata) {
			return
		}

		const parsedDivinaData = {
			metadata: parsedMetadata,
			mainLinkObjectsArray: this._parseObjectsList(readingOrder),
		}

		if (guided) {
			parsedDivinaData.guidedLinkObjectsArray = this._parseObjectsList(guided)
		}

		if (!this._doWithParsedDivinaData) {
			return
		}
		this._doWithParsedDivinaData(parsedDivinaData)
	}

	_parseMetadata(metadata) {
		const { readingProgression, language, presentation } = metadata

		if (!readingProgression) {
			if (this._textManager) {
				this._textManager.showMessage({
					type: "error", data: "Missing readingProgression information",
				})
			}
			return null
		}
		if (readingProgression !== "ltr" && readingProgression !== "rtl"
			&& readingProgression !== "ttb" && readingProgression !== "btt") {
			if (this._textManager) {
				this._textManager.showMessage({
					type: "error", data: "Value for readingProgression is not valid",
				})
			}
			return null
		}

		const {
			continuous,
			fit,
			overflow,
			clipped,
			spread,
			viewportRatio,
			orientation,
		} = presentation || {}

		const storyContinuous = (continuous === true || continuous === false)
			? continuous
			: constants.defaultContinuous
		const storyFit = (fit === "contain" || fit === "cover" || fit === "width" || fit === "height")
			? fit
			: constants.defaultFit
		const storyOverflow = (overflow === "scrolled" || overflow === "paginated")
			? overflow
			: constants.defaultOverflow
		const storyClipped = (clipped === true || clipped === false)
			? clipped
			: constants.defaultClipped
		const storySpread = (spread === "both" || spread === "landscape" || spread === "none")
			? spread
			: constants.defaultSpread

		let languagesArray = []
		if (language) {
			languagesArray = (Array.isArray(language) === true)
				? language
				: [language]
		} else {
			languagesArray = ["unspecified"]
		}

		return {
			readingProgression,
			continuous: storyContinuous,
			fit: storyFit,
			overflow: storyOverflow,
			clipped: storyClipped,
			spread: storySpread,
			viewportRatio,
			orientation,
			languagesArray,
		}
	}

	_parseObjectsList(objectsList) {
		const parentLinkObject = null
		const linkObjectsArray = objectsList.map((object) => (
			new LinkObject(object, parentLinkObject, this._player)
		))
		return linkObjectsArray
	}

}