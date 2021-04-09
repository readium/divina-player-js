import * as constants from "./constants"

const hasAScheme = (url) => {
	const regExp = new RegExp("^(?:[a-z]+:)?//", "i")
	return (regExp.test(url) === true)
}

const getFolderPathFromManifestPath = (manifestPath) => {
	if (!manifestPath || manifestPath.split("/").length === 1) {
		return ""
	}
	const folderPath = manifestPath.split(`/${constants.DEFAULT_MANIFEST_FILENAME}`)[0]
	return folderPath
}

// For type checking

const isAString = (value) => (
	(typeof value === "string" || value instanceof String)
)

const isANumber = (value) => (Number.isFinite(value) === true)

const isAnObject = (value) => ( // Excluding the array case
	(value !== null && typeof value === "object" && Array.isArray(value) === false)
)

// For checking data values
const returnValidValue = (valueType, value, shouldReturnDefaultValue) => {
	const { type, allowed, defaultValue } = constants.ACCEPTED_VALUES[valueType] || {}
	if (valueType === "positive") {
		if (value !== undefined && isANumber(value) === true && value > 0) {
			return value
		}
		return (shouldReturnDefaultValue === true) ? constants.DEFAULT_DURATION : null
	}
	if (type === "boolean") {
		if (value !== undefined && typeof value === "boolean") {
			return value
		}
		return (shouldReturnDefaultValue === true) ? defaultValue : null
	}
	if (type === "string") {
		if (isAString(value) === true && allowed.includes(value) === true) {
			return value
		}
		return (shouldReturnDefaultValue === true) ? defaultValue : null
	}
	return null
}

// For handling resources

const getResourceType = (path, type = null) => {
	let resourceType = null
	// To assign a general resourceType, first check the specified value for type
	if (type) {
		const generalType = type.split("/")[0]
		if (generalType === "image" || generalType === "video") {
			resourceType = generalType
		}
	}
	// If the specified value did not provide a relevant resourceType, check the path's extension
	if (!resourceType) {
		resourceType = (isAVideo(path) === true) ? "video" : "image"
	}
	// Note that the "image" resourceType is thus favored by default
	return resourceType
}

const getFileExtension = (path) => {
	if (!path) {
		return null
	}
	const pathParts = path.split(".")
	const extension = pathParts[pathParts.length - 1]
	return extension
}

const isOfType = (path, acceptableGeneralType, acceptableExtensions) => {
	const extension = getFileExtension(path)
	let isExtensionAcceptable = false
	if (extension && acceptableExtensions) {
		acceptableExtensions.forEach((acceptableExtension) => {
			// Compare the uppercase versions of the extension strings
			if (extension.toUpperCase() === acceptableExtension.toUpperCase()) {
				isExtensionAcceptable = true
			}
		})
	}
	return isExtensionAcceptable
}

const isAVideo = (path) => (
	isOfType(path, "video", constants.ACCEPTED_VIDEO_EXTENSIONS)
)

/*const isAnImage = (path) => (
	isOfType(path, "image", constants.ACCEPTED_IMAGE_EXTENSIONS)
)*/

// For parsing the aspect ratio value written as a string in the divina's viewportRatio property
const parseAspectRatio = (ratio) => {
	if (!ratio || typeof ratio !== "string") {
		return null
	}
	const parts = ratio.split(":")
	if (parts.length !== 2) {
		return null
	}
	const width = Number(parts[0])
	const height = Number(parts[1])
	if (isANumber(width) === true && isANumber(height) === true && height !== 0) {
		return (width / height)
	}
	return null
}

// For splitting an href into path and mediaFragment
const getPathAndMediaFragment = (href) => {
	if (!href || isAString(href) === false) {
		return { path: "" }
	}
	const hrefParts = href.split("#")
	const path = hrefParts[0]
	if (hrefParts.length === 1 || hrefParts.length > 2) {
		return { path }
	}
	const mediaFragment = hrefParts[1]
	return { path, mediaFragment }
}

// For parsing a media fragment string
const parseMediaFragment = (mediaFragment) => {
	if (!mediaFragment) {
		return null
	}
	const mediaFragmentParts = mediaFragment.split("=")
	if (mediaFragmentParts.length !== 2 || mediaFragmentParts[0] !== "xywh") {
		return null
	}

	let unit = "pixel"
	let xywh = null
	let fragmentInfo = mediaFragmentParts[1]
	fragmentInfo = fragmentInfo.split(":")
	if (fragmentInfo.length === 1) {
		[xywh] = fragmentInfo
	} else if (fragmentInfo.length === 2) {
		[unit, xywh] = fragmentInfo
	} else {
		return null
	}

	if (unit !== "percent" && unit !== "pixel") {
		return null
	}
	const xywhArray = xywh.split(",")
	if (xywhArray.length !== 4) {
		return null
	}

	let [x, y, w, h] = xywhArray
	x = Number(x)
	y = Number(y)
	w = Number(w)
	h = Number(h)
	if (isANumber(x) === false
		|| isANumber(y) === false
		|| isANumber(w) === false
		|| isANumber(h) === false) {
		return null
	}

	return {
		unit, x, y, w, h,
	}
}

const getRectForMediaFragmentAndSize = (mediaFragment, { width, height }) => {
	if (!mediaFragment) {
		return null
	}
	const parsedString = parseMediaFragment(mediaFragment)

	if (!parsedString
		|| (parsedString.unit !== "percent" && parsedString.unit !== "pixel")) {
		return null
	}

	const { unit } = parsedString
	let {
		x, y, w, h,
	} = parsedString
	if (isANumber(x) === false
		|| isANumber(y) === false
		|| isANumber(w) === false
		|| isANumber(h) === false) {
		return null
	}

	if (unit === "percent") {
		x *= width / 100
		y *= height / 100
		w *= width / 100
		h *= height / 100
	}

	// Correct potential mistakes in the way the media fragment was written
	// by limiting the fragment to the natural dimensions of the resource
	x = Math.min(Math.max(x, 0), width)
	y = Math.min(Math.max(y, 0), height)
	w = Math.min(Math.max(w, 0), width - x)
	h = Math.min(Math.max(h, 0), height - y)

	return {
		x, y, width: w, height: h,
	}
}

const getShortenedHref = (href) => {
	if (!href) {
		return null
	}
	return href.split("#")[0]
}

// For measuring a distance between 2 points (used for pinch)
const getDistance = (point1, point2) => (
	Math.sqrt((point2.x - point1.x) ** 2 + (point2.y - point1.y) ** 2)
)

// For converting colors
const convertColorStringToNumber = (hex) => {
	let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
	if (result) {
		const r = parseInt(result[1], 16)
		const g = parseInt(result[2], 16)
		const b = parseInt(result[3], 16)
		result = r * (256 ** 2) + g * 256 + b
		return result
	}
	return null
}

export {
	hasAScheme,
	getFolderPathFromManifestPath,
	isAString,
	isANumber,
	isAnObject,
	returnValidValue,
	getResourceType,
	isAVideo,
	parseAspectRatio,
	getPathAndMediaFragment,
	getRectForMediaFragmentAndSize,
	getShortenedHref,
	getDistance,
	convertColorStringToNumber,
}