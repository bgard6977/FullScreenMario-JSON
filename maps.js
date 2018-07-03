/* Maps.js */

// Contains functions for creating, populating, and using maps

function resetMapsManager() {
    window.mapsManager = new MapsManagr({
        prething_maker: window.objectMaker,
        recipient: window.map_settings || window,
        recipient_receives: [
            "gravity",
            "fillStyle",
            "refy",
            "setting",
            "underwater",
            "time"
        ],
        groupings: [
            "scenery",
            "solid",
            "character",
            "text"
        ],
        on_spawn: function (prething, xloc) {
            var thing = prething.thing;
            addThing(thing, prething.xloc * unitsize - gamescreen.left, (map_settings.refy - prething.yloc) * unitsize);
        },
        entry_functions: {
            true: entryPlain,
            "normal": entryNormal,
            "Castle": entryCastle,
            "Cloud": entryCloud,
            "ExitPipeVertical": exitPipeVertical,
            "WalkToPipe": walkToPipe
        },
        entry_default: "plain",
        on_entry: function () {
            window.mapsManager.spawnMap((gamescreen.right + QuadsKeeper.getOutDifference()) / unitsize);
        },
        macros: {
            "Floor": makeFloor,
            "Pipe": makePipe,
            "Ceiling": makeCeiling,
            "Tree": makeTree,
            "Shroom": makeShroom,
            "Water": makeWater,
            "Bridge": makeBridge,
            "PlatformGenerator": makePlatformGenerator,
            "EndCastleOutside": makeEndCastleOutside,
            "StartCastleInside": makeStartCastleInside,
            "EndCastleInside": makeEndCastleInside
        },
        macros_defaults: {
            "Fill": {
                "xwidth": 8,
                "yheight": 8
            }
        },
        patterns: window.Scenery,
        defaults: {
            Map: {
                curloc: -1
            },
            Area: {
                floor: 140,
                refy: 140, // floor + yloc
                time: 400,
                width: 0,
                underwater: false,
                gravity: round(12 * unitsize) / 100 // Typically .48
            },
            Location: {
                x: 0,
                y: 0,
                area: 0,
                entry: "normal"
            }
        },
        preload: {
            1: {
                2: "World12"
            }
        }
    });
}


/* Map Transitions */

function setMap(name) {
    if (!name) name = window.mapsManager.getMapName();
    gamecount = 0;
    gamehistory = [];
    resetQuadrants();
    // From shiftToLocation
    window.timeHandler.clearAllEvents();
    window.timeHandler.addEventInterval(updateDataTime, 25, Infinity);
    resetGameState();
    window.gamescreen.resetGameScreenPosition();
    resetQuadrants();

    // Globally accessible settings
    window.map_settings = {
        gravity: window.gravity,
        shifting: false,
        refy: 104,
        gravity: .48,
        maxyvel: 7,
        maxyvelinv: -7,
        floor: 104,
        underwater: false,
        jumpmod: 1.056,
        canscroll: true
    };

    window.mapsManager.setMap(name);
    window.statsHolder.set("world", name.join('-'));
    startDataTime();
    window.inputWriter.restart();
    unpause();
}

function entryPlain() {
    var me = placePlayer();
    setLeft(me, unitsizet16);
    setBottom(me, map_settings.floor * unitsize);
    me.nocollide = false;
}

function entryNormal() {
    var me = placePlayer();
    setLeft(me, unitsizet16);
    setTop(me, unitsizet16);
    me.nocollide = false;
}

function entryCastle() {
    var me = placePlayer();
    setBottom(me, unitsize * 56);
    setLeft(me, unitsizet2);
    me.nocollide = me.piping = false;
    me.placed = true;
}

function entryCloud() {
    var me = placePlayer();
}

function intoPipeVertical(me, pipe) {
    if (!pipe.entrance || !me.resting ||
        me.right + unitsizet2 > pipe.right ||
        me.left - unitsizet2 < pipe.left) return;
    pipePreparations(me);
    switchContainers(me, characters, scenery);
    unpause();
    var entrance = pipe.entrance,
        move = setInterval(function () {
            shiftVert(me, unitsized4);
            if (me.top >= pipe.top) {
                clearInterval(move);
                setTimeout(function () {
                    goToTransport(entrance);
                }, 700);
            }
        }, timer);
}

function intoPipeHorizontal(me, pipe) {
    // If Player isn't resting or swimming, he shouldn't be allowed to pipe
    // (resting may have been cleared at this point, so yvel is how it checks)
    // if(abs(me.yvel) > unitsized8) return;
    // if(!map.underwater) return;
    pipePreparations(me);
    switchContainers(me, characters, scenery);
    unpause();
    var entrance = pipe.entrance,
        move = setInterval(function () {
            shiftHoriz(me, unitsized4);
            if (me.left >= pipe.left) {
                clearInterval(move);
                setTimeout(function () {
                    goToTransport(entrance);
                }, 700);
            }
        }, timer);
}

function pipePreparations(me) {
    locMovePreparations(me);
    me.nofall = me.nocollide = nokeys = notime = true;
    me.movement = me.xvel = me.yvel = 0;
}

function exitPipeVertical(pipe) {
    switchContainers(player, characters, scenery);
    player.nofall = nokeys = notime = true;
    setTop(player, pipe.top);
    setMidXObj(player, pipe, true);
    var dy = unitsize / -4, move = setInterval(function () {
        shiftVert(player, dy, true);
        if (player.bottom <= pipe.top) {
            switchContainers(player, scenery, characters);
            clearInterval(move);
            player.nocollide = player.nofall = nokeys = notime = false;
            player.movement = movePlayer;
        }
    }, timer);
}

function walkToPipe() {
    placePlayer();
    startWalking(player);

    var hasPipingStarted = false,
        move = window.timeHandler.addEventInterval(function () {
            if (player.piping) {
                // We have started piping
                // nokeys = player.keys.run = notime = false;
                clearInterval(move);
                player.maxspeed = player.maxspeedsave;
            }
        }, timer);
}

function startWalking(me) {
    me.movement = movePlayer;
    me.maxspeed = me.walkspeed;
    nokeys = notime = me.keys.run = true;
    me.nofall = me.nocollide = false;
}

function locMovePreparations(me) {
    me.keys = new Keys();
    me.nocollide = 1;
    removeCrouch();
    removeClass(me, "running");
    removeClass(me, "jumping");
    removeClass(me, "flipped");
}

function goToTransport(transport) {
    // Goes to a new map
    if (transport instanceof Array) {
        window.mapsManager.setMap(transport);
    }
    // Goes to a new Location
    else window.mapsManager.setLocation(transport);
}

/* Misc. Helpers */

// Distance from the yloc to botmax
//// Assumes yloc is in the form given by mapfuncs - distance from floor
function DtB(yloc, divider) {
    return (yloc + botmax) / (divider || 1);
}

function clearTexts() {
    if (window.texts)
        for (var i = texts.length - 1; i >= 0; --i)
            if (texts[i])
                removeChildSafe(texts[i], body);
    window.texts = [];
}

// Given a setting, returns the background color
function getAreaFillStyle(setting) {
    if (stringHas(setting, "Underworld") ||
        stringHas(setting, "Castle") ||
        stringHas(setting, "Night"))
        return stringHas(setting, "Underwater") ? "#2038ec" : "black";
    if (stringHas(setting, "Underwater")) return "#2038ec";
    return "#5c94fc";
}

function endLevel() {
    if (currentmap[1]++ == 4) {
        ++currentmap[0];
        currentmap[1] = 1;
    }
    setMap(currentmap);
}


/* Macro functions for analyzePreThing
*/


function makeFloor(reference) {
    var x = reference.x || 0,
        y = reference.y || 0,
        floor = proliferate({
            thing: "Floor",
            x: x,
            y: y,
            width: (reference.width || 8),
            height: DtB(y) + 24 // extra 24 so the player doesn't cause scrolling when falling
        }, reference, true);
    delete floor.macro;
    return floor;
}

function makePipe(reference) {
    var x = reference.x || 0,
        y = reference.y || 0,
        height = reference.height || 16,
        pipe = proliferate({
            thing: "Pipe",
            x: x,
            y: y,
            width: 16,
            height: reference.height || 8
        }, reference, true),
        output = [pipe];

    delete pipe.macro;
    if (height == "Infinity") pipe.height = gamescreen.height;
    else pipe.y += height;

    if (reference.pirhana) {
        output.push({
            thing: "Pirhana",
            x: reference.x + 4,
            y: pipe.y + 12
        });
    }

    return output;
}

function makeCeiling(reference) {
    return {
        "macro": "Fill",
        "thing": "Brick",
        "x": reference.x,
        "y": 88, // ceillev
        "xnum": floor(reference.width / 8),
        "xwidth": 8
    };
}

function makeEndCastleOutside(reference) {
    var x = reference.x || 0,
        y = reference.y || 0,
        output;

    // Output starts off with the general flag & collision detection
    output = [
        // Initial collision detector
        {
            thing: "DetectCollision",
            x: x + 8,
            y: y + 108,
            height: 108,
            activate: FlagCollisionTop,
            activate_fail: killNormal
        },
        // Flag (scenery)
        {thing: "Flag", x: x + .5, y: y + 79.5, "id": "endflag"},
        {thing: "FlagTop", x: x + 6.5, y: y + 84},
        {thing: "FlagPole", x: x + 8, y: y + 80},
        // Bottom stone
        {thing: "Stone", x: x + 4, y: y + 8},
    ];

    // If this is a big castle (*-3), a large ending castle is used
    // if(reference.big) {
    //
    // }
    // else
    output.push({thing: "DetectCollision", x: x + 60, y: y + 16, height: 16, activate: endLevelPoints});

    return output;
}

function makeEndCastleInside(reference) {
    var x = reference.x || 0,
        y = reference.y || 0;

    return [
        {"thing": "Stone", "x": x, "y": y + 88, "width": 256},
        {"macro": "Water", "x": x, "y": y, "width": 104},
        // Bridge & Bowser area
        {"thing": "CastleBridge", "x": x, "y": y + 24, "width": 104},
        {"thing": "Bowser", "x": x + 69, "y": y + 42, "hard": reference.hard},
        {"thing": "CastleChain", "x": x + 96, "y": y + 32},
        // Axe area
        {"thing": "Axe", "x": x + 104, "y": y + 40},
        {"macro": "Floor", "x": x + 104, "y": y, "width": 152},
        {"thing": "Stone", "x": x + 104, "y": y + 32, "width": 24, "height": 32},
        {"thing": "Stone", "x": x + 112, "y": y + 80, "width": 16, "height": 24},
        // Peach's Magical Happy Chamber of Fantastic Love
        {"thing": "ScrollBlocker", "x": 112}
    ];
}

function makePlatformGenerator(reference) {
    return {
        thing: "PlatformGenerator",
        x: reference.x || 0,
        y: reference.y || 120, // ceilmax (104) + 16
        width: reference.width || 4,
        dir: reference.dir || 1
    }
}

function makeTree(reference) {
    // Although the tree trunks in later trees overlap earlier ones, it's ok because
    // the pattern is indistinguishible when placed correctly.
    var x = reference.x || 0,
        y = reference.y || 0,
        dtb = DtB(y),
        width = reference.width || 24;
    return [
        {"thing": "TreeTop", "x": x, "y": y, "width": width},
        {"thing": "TreeTrunk", "x": x + 8, "y": y - 8, "width": width - 16, "height": dtb - 8}
    ];
}

function makeShroom(reference) {
    var x = reference.x || 0,
        y = reference.y || 0,
        dtb = DtB(y),
        width = reference.width || 24;
    return [
        {"thing": "ShroomTop", "x": x, "y": y, "width": width},
        {"thing": "ShroomTrunk", "x": x + (width - 8) / 2, "y": y - 8, "height": dtb - 8}
    ];
}

function makeWater(reference) {
    var x = reference.x || 0,
        y = (reference.y || 0) + 2, // water is 3.5 x 5.5
        output = proliferate({
            "thing": "Water",
            "x": x,
            "y": y,
            height: DtB(y)
        }, reference, true);
    delete output.macro;
    return output;
}

function makeBridge(reference) {
    var x = reference.x || 0,
        y = reference.y || 0,
        width = max(reference.width || 0, 16),
        output = [];

    // A beginning column reduces the width and pushes it forward
    if (reference.begin) {
        width -= 8;
        output.push({"thing": "Stone", "x": x, "y": y, "height": DtB(y)});
        x += 8;
    }

    // An ending column just reduces the width
    if (reference.end) {
        width -= 8;
        output.push({"thing": "Stone", "x": x + width, "y": y, "height": DtB(y)});
    }

    // Between any columns is a BridgeBase with a Railing on top
    output.push({"thing": "BridgeBase", "x": x, "y": y, "width": width});
    output.push({"thing": "Railing", "x": x, "y": y + 4, "width": width});

    return output;
}

function makeStartCastleInside(reference) {
    var x = reference.x || 0,
        y = reference.y || 0,
        width = (reference.width || 0) - 40,
        output = [
            {"thing": "Stone", "x": x, "y": y + 48, "width": 24, "height": DtB(48)},
            {"thing": "Stone", "x": x + 24, "y": y + 40, "width": 8, "height": DtB(40)},
            {"thing": "Stone", "x": x + 32, "y": y + 32, "width": 8, "height": DtB(32)}
        ];
    if (width > 0)
        output.push({"macro": "Floor", "x": x + 40, "y": y + 24, "width": width});
    return output;
}