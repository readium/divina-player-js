import * as constants from "./constants"

const hasAScheme = (url) => {
	const regExp = new RegExp("^(?:[a-z]+:)?//", "i")
	return (regExp.test(url) === true)
}

const getFolderPathFromManifestPath = (manifestPath) => {
	if (!manifestPath || manifestPath.split("/").length === 1) {
		return ""
	}
	const folderPath = manifestPath.split(`/${constants.defaultManifestFilename}`)[0]
	return folderPath
}

// For type checking (used below)

const isAString = (value) => ( // Used below
	(typeof value === "string" || value instanceof String)
)

const isANumber = (value) => (Number.isFinite(value)) // Used below

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
	isOfType(path, "video", constants.acceptableVideoExtensions)
)

/*const isAnImage = (path) => (
	isOfType(path, "image", constants.acceptableImageExtensions)
)*/

// For parsing the aspect ratio value written as a string in the divina's viewportRatio property
const parseAspectRatio = (ratio) => {
	if (!ratio) {
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
	const hrefParts = (href && href.split) ? href.split("#") : []
	const path = hrefParts[0]
	const mediaFragment = (hrefParts.length > 1) ? hrefParts[1] : null
	return { path, mediaFragment }
}

// For parsing a media fragment string
const parseMediaFragment = (mediaFragment) => {
	if (!mediaFragment) {
		return null
	}
	const mediaFragmentParts = mediaFragment.split("=")
	if (mediaFragmentParts.length !== 2) {
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

// For parsing and computing the coordinate of a relative resource point
const parseCoordinate = (value, dimensionLength) => {
	if (!value) {
		return null
	}
	if (isAString(value) === false) {
		return null
	}
	let valueParts = value.split("%")
	let relValue = valueParts[0]
	if (valueParts.length !== 2) {
		return null
	}
	if (Number.isNaN(Number(relValue)) === false) {
		return (Number(relValue) * dimensionLength) / 100
	}
	valueParts = relValue.split("px")
	relValue = Number(valueParts[0])
	if (valueParts.length === 2 && Number.isNaN(Number(relValue)) === false) {
		return Number(relValue)
	}
	return null
}

// For measuring a distance between 2 points (used for snap points and pinch)
const getDistance = (point1, point2) => (
	Math.sqrt((point2.x - point1.x) ** 2 + (point2.y - point1.y) ** 2)
)

export {
	hasAScheme,
	getFolderPathFromManifestPath,
	isANumber,
	isAVideo,
	parseAspectRatio,
	getPathAndMediaFragment,
	getRectForMediaFragmentAndSize,
	getShortenedHref,
	parseCoordinate,
	getDistance,
}