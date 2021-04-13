let startTopBarTopValue = "-50px"; // Height of the bar in CSS
let defaultItemColor = "black";
let activeItemColor = "blue";

// createTopBar returns an object having the toggleTopBar function as a property

let createTopBar = function (menuAndPlayerObject, playFunc, storyFoldersArray) {

	if (!menuAndPlayerObject || !menuAndPlayerObject.menu || !playFunc
		|| !storyFoldersArray || storyFoldersArray.length === 0) {
		return { toggleTopBar: null };
	}

	// Load CSS
	loadCSS("./ui/topBar/topBar.css");

	// Create DOM elements for the top bar and its two halves

	let topBar = createAndAddDivElement(menuAndPlayerObject.menu, {
		id: "top-bar",
		style: { top: startTopBarTopValue, visibility: "hidden" },
	});

	let leftPart = createAndAddDivElement(topBar, { class: "bar-half" });

	let rightPart = createAndAddDivElement(topBar, {
		class: "bar-half",
		style: { flexDirection: "row-reverse" },
	});

	// Handle open/close behavior

	var isTopBarOpen = false;

	let closeTopBar = function () {
		isTopBarOpen = false;
		topBar.style.top = startTopBarTopValue;
	};

	let openTopBar = function () {
		isTopBarOpen = true;
		topBar.style.top = "0px";
		topBar.style.visibility = "visible";
	};

	let toggleTopBar = function () {
		if (isTopBarOpen === true) {
			closeTopBar();
		} else {
			openTopBar();
		}
	};

	// Functions to create, add and reset a dropdown object

	let createDropdownElement = function (parentElement) {
		let dropdownElement = createAndAddDivElement(parentElement, { class: "dropdown" });
		return dropdownElement;
	};

	let createDropdownButtonElement = function (label, dropdownElement) {
		let dropdownButtonElement = createAndAddDivElement(dropdownElement, {
			class: "dropdown-button",
			innerHTML: label,
		});
		return dropdownButtonElement;
	};

	let createDropdownContentElement = function (dropdownElement) {
		let dropdownContentElement = createAndAddDivElement(dropdownElement, {
			class: "dropdown-content",
			style: { display: "none" },
		})
		return dropdownContentElement;
	};

	let createDropdownObject = function (label, parentElement) {
		let element = createDropdownElement(parentElement);
		let buttonElement = createDropdownButtonElement(label, element);
		let contentElement = createDropdownContentElement(element);

		let dropdownObject = {
			itemDivsArray: [],
			isOpen: false,
			element,
			buttonElement,
			contentElement,
		};

		buttonElement.onpointerup = function (e) {
			dropdownObject.contentElement.style.display = (dropdownObject.isOpen === false)
				? "block"
				: "none";
			dropdownObject.isOpen = !dropdownObject.isOpen;
		};

		return dropdownObject;
	};

	let createItemDivElement = function (itemName, parentElement, getItemDivLabelFromItemName) {
		let itemDivElement = createAndAddDivElement(parentElement, {
			id: itemName,
			class: "dropdown-item",
			innerHTML: (getItemDivLabelFromItemName)
				? getItemDivLabelFromItemName(itemName)
				: itemName,
			style: { backgroundColor: defaultItemColor },
		});
		return itemDivElement;
	};

	let addItemDivsArrayToDropdownObject = function (dropdownObject, itemNamesArray, doOnSetItem,
		getItemDivLabelFromItemName) {

		// Add function to handle colors for active items
		dropdownObject.setActiveItem = function (itemName) {
			dropdownObject.itemDivsArray.forEach(function (itemDiv) {
				itemDiv.style.background = (itemDiv.id === itemName)
					? activeItemColor
					: defaultItemColor;
			});
		};

		// Add function handling what happens on an item click
		itemNamesArray.forEach(function (itemName) {
			let itemDiv = createItemDivElement(itemName, dropdownObject.contentElement,
				getItemDivLabelFromItemName);

			itemDiv.onpointerup = function () {
				dropdownObject.contentElement.style.display = "none";
				dropdownObject.isOpen = false;
				doOnSetItem(itemName);
			}
			dropdownObject.itemDivsArray.push(itemDiv);
		});
	};

	let resetDropdownObject = function (dropdownObject) {

		// Empty the dropdownObject's itemDivsArray
		dropdownObject.itemDivsArray = [];

		// Clear its main DOM element
		var child = dropdownObject.contentElement.lastElementChild;
		while (child) {
			dropdownObject.contentElement.removeChild(child);
			child = dropdownObject.contentElement.lastElementChild;
		}
	};

	// Create a dropdown for switching between stories (i.e. Divinas)

	let storyDropdownObject = createDropdownObject("STORY", leftPart);

	let doOnStoryClick = function (storyFolderName) {
		playFunc({ name: storyFolderName });
		storyDropdownObject.setActiveItem(storyFolderName);
	};

	let getStoryDivLabelFromFolderName = function (folderName) {
		return folderName.split("/").pop();
	};

	addItemDivsArrayToDropdownObject(storyDropdownObject, storyFoldersArray, doOnStoryClick,
		getStoryDivLabelFromFolderName);
	storyDropdownObject.itemDivsArray[0].style.backgroundColor = activeItemColor;

	var readingModeDropdownObject = null;
	var languageDropdownObject = null;

	window.document.addEventListener("dataparsing", function (e) {

		// Create a dropdown for switching between reading modes

		if (readingModeDropdownObject) {
			resetDropdownObject(readingModeDropdownObject);
		} else {
			readingModeDropdownObject = createDropdownObject("MODE", rightPart);
		}

		let readingModesArray = e.detail.readingModesArray;
		addItemDivsArrayToDropdownObject(readingModeDropdownObject, readingModesArray,
			function (readingMode) {
				menuAndPlayerObject.player.setReadingMode(readingMode);
			});

		// Create a dropdown for switching between languages (if relevant)

		if (languageDropdownObject) {
			resetDropdownObject(languageDropdownObject);
			languageDropdownObject.element.style.display = "none";
		}

		let languagesArray = e.detail.languagesArray;
		if (languagesArray && languagesArray.length > 1) {

			// Create languageDropdownObject.element if needed (the first time only)
			if (!languageDropdownObject) {
				languageDropdownObject = createDropdownObject("LANG", rightPart);
			}

			// Display languageDropdownObject.element in any case
			languageDropdownObject.element.style.display = "flex";

			addItemDivsArrayToDropdownObject(languageDropdownObject, languagesArray,
				function (language) {
					menuAndPlayerObject.player.setLanguage(language);
				});
		}

	});

	let closeAllDropdownsIfNeeded = function (e) {
		if (storyDropdownObject && storyDropdownObject.isOpen === true
			&& e.target.className !== "dropdown-item") {
			e.stopPropagation();
			storyDropdownObject.contentElement.style.display = "none";
			storyDropdownObject.isOpen = false;

		} else if (readingModeDropdownObject && readingModeDropdownObject.isOpen === true
			&& e.target.className !== "dropdown-item") {
			e.stopPropagation();
			readingModeDropdownObject.contentElement.style.display = "none";
			readingModeDropdownObject.isOpen = false;

		} else if (languageDropdownObject && languageDropdownObject.isOpen === true
			&& e.target.className !== "dropdown-item") {
			e.stopPropagation();
			languageDropdownObject.contentElement.style.display = "none";
			languageDropdownObject.isOpen = false;
		}
	};

	// If a dropdown is open, a click should close it and trigger nothing else
	// (note that using "pointerup" is better than "click" because of the way Hammer.js works)
	window.addEventListener("pointerup", closeAllDropdownsIfNeeded, true);

	window.document.addEventListener("readingmodesupdate", function (e) {
		// Rebuild itemDivsArray for readingModeDropdownObject
		if (!readingModeDropdownObject) {
			return;
		}
		resetDropdownObject(readingModeDropdownObject);

		let readingModesArray = e.detail.readingModesArray;

		addItemDivsArrayToDropdownObject(readingModeDropdownObject, readingModesArray,
			function (readingMode) {
				menuAndPlayerObject.player.setReadingMode(readingMode);
			});

		// Set readingMode
		readingModeDropdownObject.setActiveItem(e.detail.readingMode);
	});

	window.document.addEventListener("readingmodechange", function (e) {
		if (readingModeDropdownObject && readingModeDropdownObject.setActiveItem) {
			readingModeDropdownObject.setActiveItem(e.detail.readingMode);
		}
	});

	window.document.addEventListener("languagechange", function (e) {
		if (languageDropdownObject && languageDropdownObject.setActiveItem) {
			languageDropdownObject.setActiveItem(e.detail.language);
		}
	});

	// Create fullscreen button and its associated open/close functions

	let openFullscreen = function () {
		let container = document.documentElement;
		let activateFullscreen = container.requestFullscreen.bind(container)
			|| container.mozRequestFullScreen.bind(container)
			|| container.webkitRequestFullscreen.bind(container)
			|| container.msRequestFullscreen.bind(container);
		if (activateFullscreen) {
			activateFullscreen();
		}
	};

	let closeFullscreen = function () {
		let deactivateFullscreen = document.exitFullscreen.bind(document)
			|| document.mozCancelFullScreen.bind(document)
			|| document.webkitExitFullscreen.bind(document)
			|| document.msExitFullscreen.bind(document);
		if (deactivateFullscreen) {
			deactivateFullscreen();
		}
	};

	let fullscreenButton = createAndAddDivElement(rightPart, {
		class: "bar-button",
		innerHTML: "FULL",
	});

	fullscreenButton.onpointerup = function () {
		if (window.fullScreen === false) {
			openFullscreen();
		} else {
			closeFullscreen();
		}
	};

	return { toggleTopBar };
};