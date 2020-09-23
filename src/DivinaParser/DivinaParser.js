import LinkObject from "./LinkObject"

import * as Utils from "../utils"
import * as constants from "../constants"

export default class DivinaParser {

	constructor(player, textManager, doWithParsedDivinaData) {
		this._player = player
		this._textManager = textManager
		this._doWithParsedDivinaData = doWithParsedDivinaData
	}

	loadFromPath(path, pathType) {
		DivinaParser.loadJson(path, pathType)
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

	static loadJson(path, pathType) {
		return new Promise((resolve, reject) => {
			if (!path) {
				reject(Error("No path was specified"))
			}
			const xhr = new XMLHttpRequest()
			const manifestPath = (pathType === "manifest") // Otherwise pathType should be = "folder"
				? path
				: `${path}/${constants.defaultManifestFilename}`
			xhr.open("GET", manifestPath)
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

	loadFromJson(json = null) {
		if (json) {
			this._buildStoryFromJson(json)
		} else if (this._textManager) {
			this._textManager.showMessage({
				type: "error", data: "No json was passed",
			})
		}
	}

	_buildStoryFromJson(json) {
		if (!json) {
			if (this._textManager) {
				this._textManager.showMessage({
					type: "error", data: "Manifest is null",
				})
			}
			return
		}

		const {
			metadata, links, readingOrder, guided,
		} = json
		if (!metadata || !readingOrder) {
			if (this._textManager) {
				this._textManager.showMessage({
					type: "error", data: "Missing metadata or readingOrder information",
				})
			}
			return
		}

		let updatedFolderPath = null
		if (links && links.length > 0) {
			links.forEach((link) => {
				const { rel, href } = link
				if (rel === "self" && href && Utils.hasAScheme(href) === true) {
					updatedFolderPath = Utils.getFolderPathFromManifestPath(href)
				}
			})
		}

		const parsedMetadata = DivinaParser._parseMetadata(metadata)
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
		this._doWithParsedDivinaData(parsedDivinaData, updatedFolderPath)
	}

	static _parseMetadata(metadata) {
		const {
			readingProgression,
			language,
			presentation,
		} = metadata

		const storyReadingProgression = (readingProgression === "ltr" || readingProgression === "rtl"
			|| readingProgression === "ttb" || readingProgression === "btt")
			? readingProgression
			: constants.defaultReadingProgression

		const {
			continuous,
			fit,
			overflow,
			clipped,
			spread,
			viewportRatio,
			// orientation,
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
			readingProgression: storyReadingProgression,
			continuous: storyContinuous,
			fit: storyFit,
			overflow: storyOverflow,
			clipped: storyClipped,
			spread: storySpread,
			viewportRatio,
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