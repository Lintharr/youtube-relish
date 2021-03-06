let settings = {
    "hotkey": null,
    "useHotkey": false
}
let areControlsHidden = false;
let hasExtensionBeenBootstrapped = false;

let statTopHeight = 0;
let statBotHeight = 0;

let timeoutFunc; //need global var to know if a toast timer has already been created and fired (as to kill it and create anew)

function getPlayerElement(getDirect) {
	// if (getDirect === true)
		// return document.getElementsByTagName("ytd-player")[0].getPlayer(); //document.getElementsByClassName("video-stream")
    for (let player of document.getElementsByTagName("video")) {
        if (player.offsetParent != null) {
			if (getDirect === true)
				return player;
			else
				return player.parentElement.parentElement; //player.parentElement.parentElement.wrappedJSObject;
        }
    }

    return null;
}

function getPlayerBottomElement() {
	return document.getElementsByClassName('ytp-chrome-bottom')[0];
}

function getPlayerTopElement() {
	return document.getElementsByClassName('ytp-title')[0];
}

function isFullscreen() {
    return !!document.fullscreenElement; //why not just document.fullscreen?
}

function hideControls(hideCursor) {
    let player = getPlayerElement();
	let htmlElemBottom = getPlayerBottomElement();
	htmlElemBottom.setAttribute("hidden", "true");
	let htmlElemTop = getPlayerTopElement();
	htmlElemTop.setAttribute("hidden", "true");

    if (player) {
        //player.hideControls();
		if (!hideCursor)
			player.style.cursor = "none";
		//player.controls = 0;
        areControlsHidden = true;
    }
}

function showControls() {
    let player = getPlayerElement();
	let htmlElemBottom = getPlayerBottomElement(); //from chrome errors logs it seems this not always returns the element?
	htmlElemBottom.removeAttribute("hidden"); //for some reason it only sets it to false instead of removing
	let htmlElemTop = getPlayerTopElement();
	htmlElemTop.removeAttribute("hidden");

    if (player) {
        //player.showControls();
        player.style.cursor = "";
		//player.controls = 1;
        areControlsHidden = false;
    }
}

function onFullscreenChanged() { //consider adding check if video player is present to avoid firing at yt homepage etc
	if (isFullscreen()) {
		showControls(); //looks like these may be already hidden somehow, and we can't let them be hidden if we are to read their heights //TODO: could most likely get rid of this line with enough time invested, but for now it's safer to keep it
		tryUpdateHeights();
		hideControls(true);
	}
	else {
		showControls();
	}
}

function tryUpdateHeights() {
	if (statTopHeight === 0) { //no idea why title bar behaves differently to controls bar
		statTopHeight = getPlayerTopElement().clientHeight;
	}
	
	let botHeight = getPlayerBottomElement().clientHeight;
	if (statBotHeight === 0 || (botHeight != 0 && botHeight > 10 && botHeight != statBotHeight)) {
		statBotHeight = botHeight;
	}
}

function onVideoMouseMove(e) {
	if (!isFullscreen() || (statBotHeight === 0 && statTopHeight === 0)) { //not sure if this check should be here already or at mouseIsInMenusZone... I guess no additional show/hide code should be executed, but dunno if this func will grow and in what direction
		return;
	}
	let htmlElemBottom = getPlayerBottomElement();
	let htmlElemTop = getPlayerTopElement();
	
	let mouseIsInMenusZone = (e.clientY <= statTopHeight //mouse Y position hovers over top bar		// (statBotHeight === 0 || statTopHeight === 0) ||  //can't trigger (be in zone) if heights haven't been read
			|| (document.documentElement.clientHeight - statBotHeight - 20) <= e.clientY); //mouse Y position hovers over bottom bar [-20 as a breather for video progress bar (might consider changing it to 2.5-3% of document.documentElement.clientHeight)]
			
	if (!mouseIsInMenusZone) {
		hideControls();
	}
	else if (mouseIsInMenusZone) {
		showControls();
	}
}

//this triggers even at going fullscreen, document doesn't work here, it's just not worth it in its current form atm
// window.addEventListener('resize', function() {
	// console.log("addEventListener_resize");
	// statTopHeight = 0;
	// statBotHeight = 0;
// });

//currently unused, but keeping for future improvements
function handleKeypress(e) {
    let hotkeyOk = settings.useHotkey && settings.hotkey
        && settings.hotkey.shiftKey == e.shiftKey
        && settings.hotkey.ctrlKey == e.ctrlKey
        && settings.hotkey.metaKey == e.metaKey
        && settings.hotkey.altKey == e.altKey
        && settings.hotkey.code == e.code;

    if (isFullscreen() && hotkeyOk) {
        if (areControlsHidden) {
            showControls();
        }
        else {
            hideControls();
        }
    }
}

function showToast(message) {
	if (!message)
		message = getPlayerElement(true).volume;
	var toast = document.getElementById("snackbar");
	toast.innerHTML = message;
	// Add the "show" class to DIV
	toast.className = "show";

	if (timeoutFunc)
		clearTimeout(timeoutFunc);
	// After a second, remove the show class from DIV
	timeoutFunc = setTimeout(function() { toast.className = toast.className.replace("show", ""); }, 1000);

	//wish this worked ;_;
	// var youtubeToast = document.getElementsByClassName("ytp-bezel")[0];
	// youtubeToast.setAttribute('aria-label', message + "percent"); //should be  * 100 and rounded or get value from yt player
	// youtubeToast.parentElement.style = null;
	// setTimeout(function() { youtubeToast.parentElement.style = "display: none;"; }, 1000);
}

function messageEventHandler(e) {
	if (e.data.type && (e.data.type == "FROM_INJECTED_SCRIPT")) {
		showToast(e.data.text);
	}
}

function hasVideoEnded(video) { //might consider adding here some tolerance (but it'd have to be like 5s max tolerance for most videos (since you can seek forward by 5s and end video 'prematurely'), but then again gotta watch out for very short videos). There's also an option to use yt's api [player.getPlayerState() === 0], and since I already have this injecting thing set up, this wouldn't be as annoying to implement... just sendMsg to injected script, have it use api, then sendMsg back here, then read it... ugh
	if (!video)
		video = document.querySelector('video');
	return video.currentTime === video.duration;
}

function isVideoPaused(video) {
	if (!video)
		video = document.querySelector('video');
	return video.paused;
}

//allow changing volume when mouse is hovering over video player and ctrl or alt keys are not pressed
function onMouseWheel(e) {
	var hasVolumeChanged = false;
	if (e.ctrlKey === false && e.altKey === false && !hasVideoEnded() && (!isVideoPaused() || isFullscreen())) { //TODO: add !(isHover === ytp-volume-slider) area? add like 10% time tolerance for hasVideoEnded?
		// let player = getPlayerElement(true);
		// let step = 0.05;
		let delta = Math.sign(e.wheelDelta);
		
		var volumeMessage = (delta > 0) ? "+" : "-";
		window.postMessage({ type: "FROM_CONTENT_SCRIPT", text: volumeMessage }, "*");
		hasVolumeChanged = true;
	}
	if (hasVolumeChanged || (isFullscreen() && e.ctrlKey === false && e.altKey === false)) {
		//e.stopPropagation(); //this doesn't stop yt from scrolling
		e.preventDefault(); //maybe in future this could be decided by settings (for non-fullscreen, at least)
	}
}

//youtube doesn't reload a page when you navigate around, but rather, it "replaces the history state", thus in order to start the code at the right place, this came to be. More info at https://stackoverflow.com/questions/34077641/how-to-detect-page-navigation-on-youtube-and-modify-html-before-page-is-rendered
function bootstrapTheExtension() {
    var player = getPlayerElement();
	if (player && !hasExtensionBeenBootstrapped) {
		window.addEventListener("message", messageEventHandler);
		
		//https://stackoverflow.com/questions/9515704/insert-code-into-the-page-context-using-a-content-script
		var s = document.createElement('script');
		s.src = chrome.runtime.getURL('ffs.js'); //for some fucked up reason chrome wouldn't let me inject this script if it contained words 'script' or 'inject' in its name (and it'd blame some extension, even if I had every other extension but this one deleted)
		s.onload = function() {
			this.remove();
		};
		(document.head || document.documentElement).appendChild(s);

		var toast = document.createElement('div');
		toast.id = "snackbar";
		document.getElementById("player-container").appendChild(toast); //we aim at <div id="player-container" /> and getPlayer() hardly does that

		onFullscreenChanged();
		document.addEventListener("fullscreenchange", onFullscreenChanged);
		document.addEventListener("fullscreenerror", onFullscreenChanged);

		getPlayerElement().addEventListener("mousemove", onVideoMouseMove);
		
		//currently unused, but keeping for future improvements
		document.addEventListener("keypress", handleKeypress);

		getPlayerElement().addEventListener("wheel", onMouseWheel);
		
		hasExtensionBeenBootstrapped = true;
	}
}

window.addEventListener('yt-navigate-finish', bootstrapTheExtension);
if (getPlayerElement()) bootstrapTheExtension();
else document.addEventListener('DOMContentLoaded', bootstrapTheExtension);