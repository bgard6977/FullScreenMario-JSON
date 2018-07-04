/*
mario.js
+-+ library.js
  |
  +- sprites.js
*/

// Starts everything.
window.onload = async () => {
    const world11 = await (await fetch('/data/maps/World11.json')).json();
    const library = await (await fetch('/data/library.json')).json();
    startGame(world11, library);
};

function startGame(world11, library) {
    const time_start = Date.now();

    // I keep this cute little mini-library for some handy functions
    TonedJS(true);

    // It's useful to keep references to the body
    window.body = document.body; // TODO: remove global
    window.bodystyle = body.style; // TODO: remove global

    // Know when to shut up
    window.verbosity = {Maps: false}; // TODO: remove global

    // Resetting everything may take a while
    resetMeasurements();
    resetLibrary(library); // library.js
    resetEvents();
    resetCanvas(); // sprites.js
    resetThings(); // things.js
    resetScenery(); // things.js
    resetMapsManager(); // maps.js
    window.mapsManager.mapStore([1, 1], world11);

    resetStatsHolder(); // data.js
    resetInputWriter(); // triggers.js
    resetTriggers(); // triggers.js

    // With that all set, set the map to World11.
    window.statsHolder.set("lives", 3);
    setMap([1, 1]);

    console.log("It took " + (Date.now() - time_start) + " milliseconds to start.");
}

/* Basic reset operations */
const resetMeasurements = () => {
    resetUnitsize(4);
    resetTimer(1000 / 60);

    window.jumplev1 = 32;
    window.jumplev2 = 64;
    window.ceillev = 88; // The floor is 88 spaces (11 blocks) below the yloc = 0 level
    window.ceilmax = 104; // The floor is 104 spaces (13 blocks) below the top of the screen (yloc = -16)
    window.castlev = -48;
    window.paused = true;

    window.gamescreen = new GameScreen();

    if (!window.parentwindow) window.parentwindow = false;
};

// Unitsize is kept as a measure of how much to expand (typically 4)
const resetUnitsize = (num) => {
    window.unitsize = num;
    for (let i = 2; i <= 64; ++i) {
        window["unitsizet" + i] = unitsize * i; // TODO: remove global
        window["unitsized" + i] = unitsize / i; // TODO: remove global
    }
    window.scale = unitsized2; // Typically 2 // TODO: remove global
    window.gravity = round(12 * unitsize) / 100; // Typically .48 // TODO: remove global
};

const resetTimer = (rawNum) => {
    const num = roundDigit(rawNum, .001);
    window.timer = window.timernorm = num; // TODO: remove global
    window.timert2 = num * 2; // TODO: remove global
    window.timerd2 = num / 2; // TODO: remove global
    window.fps = window.fps_target = roundDigit(1000 / num, .001); // TODO: remove global
    window.time_prev = Date.now(); // TODO: remove global
};

class GameScreen {
    constructor() {
        this.resetGameScreenPosition();
        // Middlex is static and only used for scrolling to the right
        this.middlex = (this.left + this.right) / 2;
        // this.middlex = (this.left + this.right) / 3;

        // This is the bottom of the screen - water, pipes, etc. go until here
        window.botmax = this.height - ceilmax;
        if (botmax < unitsize) {
            body.innerHTML = "<div><br>Your screen isn't high enough. Make it taller, then refresh.</div>";
        }

        // The distance at which Things die from falling
        this.deathheight = this.bottom + 48;
    }

    // Called from: mario.js, maps.js, MapsManagr.js
    resetGameScreenPosition() {
        this.left = this.top = 0;
        this.bottom = innerHeight;
        this.right = innerWidth;
        this.height = innerHeight / unitsize;
        this.width = innerWidth / unitsize;
        this.unitheight = innerHeight;
        this.unitwidth = innerWidth;
    }
}

// Events are done with TimeHandlr.js
// This helps make timing obey pauses, and makes class cycles much easier
const resetEvents = () => {
    window.timeHandler = new TimeHandlr({
        onSpriteCycleStart: "onadding",
        doSpriteCycleStart: "placed",
        cycleCheckValidity: "alive",
        timingDefault: 9
    });
};

// Quadrants are done with QuadsKeepr.js
// This starts off with 7 cols and 6 rows (each has 1 on each side for padding)
function resetQuadrants() {
    window.quadsKeeper = new QuadsKeepr({
        num_rows: 5,
        num_cols: 6,
        screen_width: window.innerWidth,
        screen_height: window.innerHeight,
        tolerance: unitsized2,
        onUpdate: function () {
            window.mapsManager.spawnMap((gamescreen.right + window.quadsKeeper.getOutDifference()) / unitsize);
        },
        onCollide: false
    });
}

// Variables regarding the state of the game
// This is called in setMap to reset everything
function resetGameState(nocount) {
    // HTML is reset here
    clearAllTimeouts();
    window.nokeys = window.spawning = window.spawnon =
        window.notime = window.editing = window.qcount = window.lastscroll = 0;
    window.paused = window.gameon = window.speed = 1;
    // Shifting location shouldn't wipe the gamecount (for key histories)
    if (!nocount) window.gamecount = 0;
    // And quadrants
    resetQuadrants();
    // Keep a history of pressed keys
    window.gamehistory = [];
}

function scrollWindow(x, y) {
    x = x || 0;
    y = y || 0;
    var xinv = -x, yinv = -y;

    gamescreen.left += x;
    gamescreen.right += x;
    gamescreen.top += y;
    gamescreen.bottom += y;

    shiftAll(characters, xinv, yinv);
    shiftAll(solids, xinv, yinv);
    shiftAll(scenery, xinv, yinv);
    shiftAll(window.quadsKeeper.getQuadrants(), xinv, yinv);
    shiftElements(texts, xinv, yinv);
    window.quadsKeeper.updateQuadrants(xinv);

    if (window.playediting) scrollEditor(x, y);
}

function shiftAll(stuff, x, y) {
    for (var i = stuff.length - 1; i >= 0; --i)
        shiftBoth(stuff[i], x, y);
}

function shiftElements(stuff, x, y) {
    for (var i = stuff.length - 1, elem; i >= 0; --i) {
        elem = stuff[i];
        elementShiftLeft(elem, x);
        elementShiftTop(elem, y);
    }
}

// Similar to scrollWindow, but saves the player's x-loc
function scrollPlayer(x, y, see) {
    var saveleft = player.left,
        savetop = player.top;
    y = y || 0;
    scrollWindow(x, y);
    setLeft(player, saveleft, see);
    setTop(player, savetop + y * unitsize, see);
    window.quadsKeeper.updateQuadrants();
}
