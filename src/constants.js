// General
export const possiblePixelError = 0.5 // Margin of error for pixel computations
export const defaultManifestFilename = "manifest.json" // Title of the JSON file in a divina folder
export const defaultBackgroundColor = 0x000000 // Black to ensure the loading message is visible
export const defaultDummyColor = 0x333333
export const possibleTagNames = ["language", "resolution"] // List of allowed tags

// Resources
export const acceptableVideoExtensions = ["mp4"]
//export const acceptableImageExtensions = ["png", "jpg"] // Not used

// Loading message
export const textFontFamily = "Arial"
export const textFontSize = 24
export const textFillColor = 0xFFFFFF // White to ensure the message is visible
export const wordWrapWidth = 275 // Maximum line width

// Loading parameters
export const defaultAllowsDestroy = true
export const defaultAllowsParallel = true
// Nb of pages after the current one for which slice textures should be stored in memory
export const defaultMaxNbOfPagesAfter = 1
// Nb of pages before the current one for which slice textures should be stored in memory,
// as a share of defaultMaxNbOfPagesAfter
export const maxShareOfPagesBefore = 1 / 3
// Timeout to cancel video load (only in non-parallel loading mode)
export const defaultVideoLoadTimeout = 2000

// Story
export const defaultContinuous = true // If no value is specified or if the value is invalid
export const defaultFit = "contain" // If no value is specified or if the value is invalid
export const defaultOverflow = "scrolled" // If no value is specified or if the value is invalid or "auto"
export const defaultClipped = false // If no value is specified or if the value is invalid
export const defaultSpread = "none" // If no value is specified or if the value is invalid or "auto"
export const defaultDuration = 750 // In milliseconds (used for transitions and snap point jumps)

// User controls
export const defaultAllowsZoom = true
export const defaultAllowsSwipe = true
export const defaultAllowsWheelScroll = true
// To allow discontinuous gestures to trigger pagination jumps (when overflow === "scrolled")
export const defaultAllowsPaginatedScroll = true
// To make pagination sticky (only when overflow === "paginated")
export const defaultIsPaginationSticky = true
// To compute automatically-computed snap points from the page start (vs. from the current position)
export const defaultIsPaginationGridBased = true

// Interactions
// Percentage of the relevant viewport dimension (width or height, depending on the story's
// reading direction) defining an "active" hit zone (to detect forward/backward clicks/taps)
export const referencePercent = 0.3
export const velocityFactor = 10 // For a kinetic scroll
export const timeConstant = 325 // For a kinetic scroll
export const maxZoomFactor = 3 // Maximum zoom
export const zoomSensitivityConstant = 3 // To compute zoom based on scroll
// Percentage of the relevant dimension to scroll to trigger a valid controlled transition
export const viewportDimensionPercent = 0.5

// Snap point speeds: speeds are computed such that the viewport will move by 1 relevant dimension
// (= the viewport's width or height in pixels) in defaultDuration milliseconds
export const snapJumpSpeedFactor = 1 / defaultDuration
// (with the above, duration of a snap point jump = distance in px / speed,
// where speed is defaultDuration * snapJumpSpeedFactor (used in Camera))
export const stickyMoveSpeedFactor = 1 / defaultDuration
// (with the above, duration of a sticky snap point move = distance in px / speed,
// where speed is defaultDuration * stickyMoveSpeedFactor (used in Camera))