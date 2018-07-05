// Starts everything.
window.onload = async () => {
    const world11 = await (await fetch('/data/maps/World11.json')).json();
    const library = await (await fetch('/data/library.json')).json();
    startGame(world11, library);
};

const startGame = (world11, library) => {
    const timeStart = Date.now();

    // I keep this cute little mini-library for some handy functions
    TonedJS(true);

    // It's useful to keep references to the body
    window.body = document.body;
    window.bodystyle = body.style;

    // Know when to shut up
    window.verbosity = {Maps: false}; 

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

    console.log("It took " + (Date.now() - timeStart) + " milliseconds to start.");
};

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
        window["unitsizet" + i] = unitsize * i;
        window["unitsized" + i] = unitsize / i;
    }
    window.scale = unitsized2; // Typically 2
    window.gravity = round(12 * unitsize) / 100; // Typically .48
};

const resetTimer = (rawNum) => {
    const num = roundDigit(rawNum, .001);
    window.timer = window.timernorm = num;
    window.timert2 = num * 2;
    window.timerd2 = num / 2;
    window.fps = window.fps_target = roundDigit(1000 / num, .001); 
    window.time_prev = Date.now();
};

class GameScreen {
    constructor() {
        this.resetGameScreenPosition();

        // Middlex is static and only used for scrolling to the right
        this.middlex = (this.left + this.right) / 2;

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
const resetQuadrants = () => {
    window.quadsKeeper = new QuadsKeepr({
        num_rows: 5,
        num_cols: 6,
        screen_width: window.innerWidth,
        screen_height: window.innerHeight,
        tolerance: unitsized2,
        onUpdate: () => {
            window.mapsManager.spawnMap((gamescreen.right + window.quadsKeeper.getOutDifference()) / unitsize);
        },
        onCollide: false
    });
};

// Variables regarding the state of the game
// This is called in setMap to reset everything
const resetGameState = (nocount) => {
    // HTML is reset here
    clearAllTimeouts();
    window.nokeys = 0;
    window.spawning = 0;
    window.spawnon = 0;
    window.notime = 0;
    window.editing = 0;
    window.qcount = 0;
    window.lastscroll = 0;
    window.paused = 1;
    window.gameon = 1;
    window.speed = 1;
    // Shifting location shouldn't wipe the gamecount (for key histories)
    if (!nocount) {
        window.gamecount = 0;
    }
    // And quadrants
    resetQuadrants();
    // Keep a history of pressed keys
    window.gamehistory = [];
};

const scrollWindow = (x, y) => {
    x = x || 0;
    y = y || 0;
    const xinv = -x;
    const yinv = -y;

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

    if (window.playediting) {
        scrollEditor(x, y);
    }
};

const shiftAll = (stuff, x, y) => {
    for (let i = stuff.length - 1; i >= 0; --i) {
        shiftBoth(stuff[i], x, y);
    }
};

const shiftElements = (stuff, x, y) => {
    for (let i = stuff.length - 1; i >= 0; --i) {
        const elem = stuff[i];
        elementShiftLeft(elem, x);
        elementShiftTop(elem, y);
    }
};

// Similar to scrollWindow, but saves the player's x-loc
const scrollPlayer = (x, y, see) => {
    const saveLeft = player.left;
    const saveTop = player.top;
    y = y || 0;
    scrollWindow(x, y);
    setLeft(player, saveLeft, see);
    setTop(player, saveTop + y * unitsize, see);
    window.quadsKeeper.updateQuadrants();
};
