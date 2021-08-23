let startBottomBarBottomValue = "-50px"; // Height of the bar in CSS
let sliderMax = 1000;

// createBottomBar returns an object having the toggleBottomBar function as a property

let createBottomBar = function (menuAndPlayerObject) {

	if (!menuAndPlayerObject || !menuAndPlayerObject.menu) {
		return { toggleBottomBar: null };
	}

	// Load CSS
	loadCSS("./ui/bottomBar/bottomBar.css");

	// Create a DOM element for the bottom bar
	let bottomBar = createAndAddDivElement(menuAndPlayerObject.menu, {
		id: "bottom-bar",
		style: { bottom: startBottomBarBottomValue, visibility: "hidden" },
	});

	// Handle open/close behavior

	var isBottomBarOpen = false;

	let closeBottomBar = function () {
		isBottomBarOpen = false;
		bottomBar.style.bottom = startBottomBarBottomValue;
	};

	let openBottomBar = function () {
		isBottomBarOpen = true;
		bottomBar.style.bottom = "0px";
		bottomBar.style.visibility = "visible";
	};

	let toggleBottomBar = function () {
		if (isBottomBarOpen === true) {
			closeBottomBar();
		} else {
			openBottomBar();
		}
	};

	// Set reading progression on receiving data from dedicated event

	var readingProgression = null;
	window.document.addEventListener("dataparsing", function (e) {
		readingProgression = e.detail.readingProgression;
	});

	var maxLeftButton = null;
	var leftButton = null;
	var pageTextDiv = null;
	var rightButton = null;
	var maxRightButton = null;
	var slider = null;

	window.document.addEventListener("initialload", function (e) {

		// Remove navigation buttons
		if (maxLeftButton) {
			maxLeftButton.remove();
			leftButton.remove();
			pageTextDiv.remove();
			rightButton.remove();
			maxRightButton.remove();
			slider.remove();
		}

		// (Re)create navigation buttons - note that "left" and "right" will be understood
		// as "top" and "bottom" for a Divina whose reading progression is "ttb" or "btt"

		// 1. maxLeft and left buttons

		maxLeftButton = createAndAddDivElement(bottomBar, {
			class: "bottom-bar-item",
			innerHTML: (readingProgression === "ttb" || readingProgression === "btt")
				? "MAX UP"
				: "MAX LEFT",
		});

		maxLeftButton.onpointerup = function () {
			if (!menuAndPlayerObject.player
				|| !menuAndPlayerObject.player.goToMaxLeft
				|| !menuAndPlayerObject.player.goToMaxUp) {
				return;
			}
			if (readingProgression === "ttb" || readingProgression === "btt") {
				menuAndPlayerObject.player.goToMaxUp();
			} else {
				menuAndPlayerObject.player.goToMaxLeft();
			}
		};

		leftButton = createAndAddDivElement(bottomBar, {
			class: "bottom-bar-item",
			innerHTML: (readingProgression === "ttb" || readingProgression === "btt")
				? "UP"
				: "LEFT",
		});

		leftButton.onpointerup = function () {
			if (!menuAndPlayerObject.player
				|| !menuAndPlayerObject.player.goLeft
				|| !menuAndPlayerObject.player.goUp) {
				return;
			}
			if (readingProgression === "ttb" || readingProgression === "btt") {
				menuAndPlayerObject.player.goUp();
			} else {
				menuAndPlayerObject.player.goLeft();
			}
		};

		// 2. Page number display

		pageTextDiv = createAndAddDivElement(bottomBar, { class: "bottom-bar-text" });

		window.document.addEventListener("pagechange", function (e) {
			let pageIndex = e.detail.locator.locations.position;
			let nbOfPages = e.detail.nbOfPages;
			let text = String(pageIndex + 1) + " / " + String(nbOfPages);
			pageTextDiv.innerHTML = text;
		});

		// 3. right and maxRight buttons

		rightButton = createAndAddDivElement(bottomBar, {
			class: "bottom-bar-item",
			innerHTML: (readingProgression === "ttb" || readingProgression === "btt")
				? "DOWN"
				: "RIGHT",
		});

		rightButton.onpointerup = function () {
			if (!menuAndPlayerObject.player
				|| !menuAndPlayerObject.player.goRight
				|| !menuAndPlayerObject.player.goDown) {
				return;
			}
			if (readingProgression === "ttb" || readingProgression === "btt") {
				menuAndPlayerObject.player.goDown();
			} else {
				menuAndPlayerObject.player.goRight();
			}
		};

		maxRightButton = createAndAddDivElement(bottomBar, {
			class: "bottom-bar-item",
			innerHTML: (readingProgression === "ttb" || readingProgression === "btt")
				? "MAX DOWN"
				: "MAX RIGHT",
		});

		maxRightButton.onpointerup = function () {
			if (!menuAndPlayerObject.player
				|| !menuAndPlayerObject.player.goToMaxRight
				|| !menuAndPlayerObject.player.goToMaxDown) {
				return;
			}
			if (readingProgression === "ttb" || readingProgression === "btt") {
				menuAndPlayerObject.player.goToMaxDown();
			} else {
				menuAndPlayerObject.player.goToMaxRight();
			}
		};

		// 4. slider (for overflowing pages)

		slider = document.createElement("input");
		slider.setAttribute("type", "range");
		slider.setAttribute("id", "slider");
		slider.setAttribute("min", 0);
		slider.setAttribute("max", sliderMax);
		slider.style.visibility = "hidden";
		bottomBar.appendChild(slider);

		slider.oninput = function () {
			if (!menuAndPlayerObject.player
				|| !menuAndPlayerObject.player.setPercentInPage) {
				return;
			}
			var percentInPage = slider.value / (sliderMax || 1);
			if (readingProgression === "rtl") {
				percentInPage = 1 - percentInPage;
			}
			menuAndPlayerObject.player.setPercentInPage(percentInPage);
		};

		window.document.addEventListener("inpagescroll", function ({ detail }) {
			if (!detail) {
				slider.style.visibility = "hidden";
			} else {
				slider.style.visibility = "visible";
				var percent = (detail.locator && detail.locator.locations
					&& detail.locator.locations.progression)
					? detail.locator.locations.progression
					: 0
				if (readingProgression === "rtl") {
					percent = 1 - percent;
				}
				slider.value = percent * sliderMax;
			}
		});

	});

	return { toggleBottomBar };
}