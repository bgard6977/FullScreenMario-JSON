/* Upkeep.js */

// Contains functions associated with the upkeep
function upkeep() {
    if (window.paused) return;
    window.nextupk = setTimeout(upkeep, window.timer);

    // See utility.js::fastforward
    adjustFPS(); // Adjust for differences in performance
    window.quadsKeeper.determineAllQuadrants(window.solids); // Quadrants upkeep
    maintainSolids(); // Solids upkeep
    maintainCharacters(); // Character upkeep
    maintainPlayer(); // Player specific
    if (texts.length) {
        maintainTexts(); // Texts upkeep, if there are any
    }
    window.timeHandler.handleEvents(); // Events upkeep
    refillCanvas();
}

const adjustFPS = () => {
    window.time_now = window.now();
    const time_diff = time_now - time_prev;
    const fps_actual = window.roundDigit(1000 / time_diff, .001);

    window.fps = window.roundDigit((.7 * fps) + (.3 * fps_actual), .01);
    window.realtime = window.fps_target / fps;

    window.time_prev = time_now;
};

function pause() {
    if (window.paused && !window.nextupk) {
        return;
    }
    cancelAnimationFrame(nextupk);
    window.paused = true;
}

function unpause() {
    if (!window.paused) return;
    window.nextupk = requestAnimationFrame(upkeep);
    window.paused = false;
}

// Solids by themselves don't really do much
const maintainSolids = () => {
    for (let i = 0; i < window.solids.length; ++i) {
        const solid = window.solids[i];
        if (solid.alive && solid.movement) {
            solid.movement(solid);
        }
        if (!solid.alive || solid.right < window.quadsKeeper.getDelX()) {
            deleteThing(solid, window.solids, i);
        }
    }
}

function maintainCharacters() {
    var delx = window.gamescreen.right + window.quadsKeeper.getOutDifference(),
        character, i;
    for (i = 0; i < characters.length; ++i) {
        character = characters[i];
        // Gravity
        if (!character.resting) {
            if (!character.nofall) character.yvel += character.gravity || map_settings.gravity;
            character.yvel = min(character.yvel, map_settings.maxyvel);
        } else character.yvel = 0;

        // Position updating and collision detection
        updatePosition(character);
        window.quadsKeeper.determineThingQuadrants(character);
        character.under = character.undermid = false;
        determineThingCollisions(character);

        // Resting tests
        if (character.resting) {
            if (!characterOnResting(character, character.resting)) {
                character.resting = false; // Necessary for moving platforms :(
            } else {
                /*character.jumping = */
                character.yvel = false;
                setBottom(character, character.resting.top);
            }
        }

        // Movement or deletion
        // To do: rethink this...
        //// Good for performance if gamescreen.bottom - gamescreen.top is saved in screen and updated on shift
        // To do: is map.shifting needed?
        if (character.alive) {
            if (!character.player &&
                (character.numquads == 0 || character.left > delx) && !character.outerok) {
                // (character.top > gamescreen.bottom - gamescreen.top || character.left < + quads.width * -1)) {
                deleteThing(character, characters, i);
            }
            else {
                if (!character.nomove && character.movement)
                    character.movement(character);
            }
        }
        else deleteThing(character, characters, i);
    }
}

function maintainPlayer() {
    if (!player.alive) {
        return;
    }

    // Player is falling
    if (player.yvel > 0) {
        if (!map_settings.underwater) {
            player.keys.jump = 0;
        }
        // Jumping?
        if (!player.jumping) {
            // Paddling? (from falling off a solid)
            if (map_settings.underwater) {
                if (!player.paddling) {
                    switchClass(player, "paddling", "paddling");
                    player.padding = true;
                }
            }
            else {
                addClass(player, "jumping");
                player.jumping = true;
            }
        }
        // Player has fallen too far
        if (!player.piping && !player.dying && player.top > gamescreen.deathheight) {
            // If the map has an exit loc (cloud world), transport there
            if (map_settings.exitloc) {
                // Random maps will pretend he died
                if (map.random) {
                    goToTransport(["Random", "Overworld", "Down"]);
                    playerDropsIn();
                    return;
                }
                // Otherwise just shift to the location
                return shiftToLocation(map.exitloc);
            }
            // Otherwise, since Player is below the gamescreen, kill him dead
            killPlayer(player, 2);
        }
    }

    // Player is moving to the right
    if (player.xvel > 0) {
        if (player.right > gamescreen.middlex) {
            // If Player is to the right of the gamescreen's middle, move the gamescreen
            if (player.right > gamescreen.right - gamescreen.left) {
                player.xvel = min(0, player.xvel);
            }
        }
    } else if (player.left < 0) {
        // Player is moving to the left
        // Stop Player from going to the left.
        player.xvel = max(0, player.xvel);
    }

    // Player is hitting something (stop jumping)
    if (player.under) {
        player.jumpcount = 0;
    }

    // Scrolloffset is how far over the middle player's right is
    // It's multiplied by 0 or 1 for map.canscroll
    window.scrolloffset = map_settings.canscroll * (player.right - gamescreen.middlex);
    if (scrolloffset > 0) {
        scrollWindow(window.lastscroll = round(min(player.scrollspeed, scrolloffset)));
    } else {
        window.lastscroll = 0;
    }
}

// Deletion checking is done by an interval set in shiftToLocation
// This simply does velocity
function maintainTexts() {
    var element, me, i;
    for (i = texts.length - 1; i >= 0; --i) {
        me = texts[i];
        element = me.element || me;
        if (me.xvel) elementShiftLeft(element, me.xvel);
        if (me.yvel) elementShiftTop(element, me.yvel);
    }
}