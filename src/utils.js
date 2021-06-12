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

const getValidValueAndUnit = (value) => {
	const validValueAndUnit = {}
	if (value.slice(-1) === "%") {
		let validValue = value.substring(0, value.length - 1)
		validValue = Number(validValue)
		if (isANumber(validValue) === true && validValue >= 0
			&& validValue <= 100) { // Percent values should be between 0 and 100
			validValueAndUnit.value = validValue
			validValueAndUnit.unit = "%"
		}
	} else if (value.length > 1 && value.slice(-2) === "px") {
		let validValue = value.substring(0, value.length - 2)
		validValue = Number(validValue)
		if (isANumber(validValue) === true && validValue >= 0) { // Pixel values should be positive
			validValueAndUnit.value = validValue
			validValueAndUnit.unit = "px"
		}
	}
	if (validValueAndUnit.unit) {
		return validValueAndUnit
	}
	return null
}

// For checking data values
const returnValidValue = (valueType, value, shouldReturnDefaultValue) => {
	const { type, allowed, defaultValue } = constants.ACCEPTED_VALUES[valueType] || {}
	if (valueType === "positive") { // Strictly positive, actually!
		if (value !== undefined && isANumber(value) === true && value > 0) {
			return value
		}
		return (shouldReturnDefaultValue === true && defaultValue !== undefined)
			? defaultValue
			: null
	}
	if (type === "number") {
		if (value !== undefined && isANumber(value) === true) {
			return value
		}
		return (shouldReturnDefaultValue === true && defaultValue !== undefined)
			? defaultValue
			: null
	}
	if (type === "value&Unit") {
		if (value !== undefined && isAString(value) === true) {
			const validValueAndUnit = getValidValueAndUnit(value)
			if (validValueAndUnit) {
				return validValueAndUnit
			}
		}
		return (shouldReturnDefaultValue === true) ? defaultValue : null
	}
	if (type === "color") {
		const regExp = new RegExp("#[0-9a-f]{6}", "i")
		if (value && isAString(value) === true && regExp.test(value) === true) {
			return value
		}
		return (shouldReturnDefaultValue === true) ? defaultValue : null
	}
	if (type === "boolean") {
		if (value !== undefined && typeof value === "boolean") {
			return value
		}
		return (shouldReturnDefaultValue === true) ? defaultValue : null
	}
	if (type === "string") {
		if (value && isAString(value) === true && allowed.includes(value) === true) {
			return value
		}
		return (shouldReturnDefaultValue === true) ? defaultValue : null
	}
	return null
}

// For handling resources

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

const parseStringRect = (stringRect) => {
	let unit = "pixel"
	let xywh = null
	let fragmentInfo = stringRect
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
		x, y, w, h, unit: (unit === "percent") ? "%" : "px",
	}
}

const getRectWithSize = (rectWithUnit, { width, height }, shouldLimitSize = false) => {
	if (!rectWithUnit
		|| (rectWithUnit.unit !== "%" && rectWithUnit.unit !== "px")) {
		return null
	}

	let {
		x, y, w, h,
	} = rectWithUnit
	if (isANumber(x) === false
		|| isANumber(y) === false
		|| isANumber(w) === false
		|| isANumber(h) === false) {
		return null
	}

	if (rectWithUnit.unit === "%") {
		x *= width / 100
		y *= height / 100
		w *= width / 100
		h *= height / 100
	}

	// Correct potential mistakes in the way a media fragment was written
	// by limiting the fragment to the natural dimensions of the resource
	if (shouldLimitSize === true) {
		x = Math.min(Math.max(x, 0), width)
		y = Math.min(Math.max(y, 0), height)
		w = Math.min(Math.max(w, 0), width - x)
		h = Math.min(Math.max(h, 0), height - y)
	}

	return {
		x, y, w, h,
	}
}

// For parsing a media fragment string

const getRectForMediaFragmentAndSize = (mediaFragment, size) => {
	if (!mediaFragment) {
		return null
	}
	const mediaFragmentParts = mediaFragment.split("=")
	if (mediaFragmentParts.length !== 2 || mediaFragmentParts[0] !== "xywh") {
		return null
	}
	const rectWithUnit = parseStringRect(mediaFragmentParts[1])

	const shouldLimitSize = true
	const rect = getRectWithSize(rectWithUnit, size, shouldLimitSize)
	if (!rect) {
		return null
	}
	const {
		x, y, w, h,
	} = rect

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
	getValidValueAndUnit,
	returnValidValue,
	getResourceType,
	isAVideo,
	parseAspectRatio,
	getRectWithSize,
	getPathAndMediaFragment,
	parseStringRect,
	getRectForMediaFragmentAndSize,
	getShortenedHref,
	getDistance,
	convertColorStringToNumber,
}