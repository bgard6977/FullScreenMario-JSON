/* sprites.js */
// Contains functions for finding, setting, and manipulating sprites

// Resets the main canvas and context
const resetCanvas = () => { /* called by mario.js */
    // The global canvas is one that fills the screen
    window.canvas = getCanvas(innerWidth, innerHeight, true);

    // The context is saved for ease of access
    window.context = canvas.getContext("2d");
    document.body.appendChild(canvas);
};

/* Sprite Parsing */
// These functions deal turning library.rawsprites strings into library.sprites Uint8ClampedArrays
// * Normal sprites (see library.js::libraryParse):
//    spriteUnravel -> spriteExpand -> spriteGetArray
// * Filtered sprites (see library.js::applyPaletteFilterRecursive)
//    spriteUnravel -> applyPaletteFilter -> spriteExpand -> spriteGetArray

// Given a compressed raw sprite data string, this 'unravels' it (uncompresses)
// This is the first function called on strings in libraryParse
// This could output the Uint8ClampedArray immediately if given the area - deliberately does not, for ease of storage
const spriteUnravel = (colors) => {
    let paletteRef = getPaletteReferenceStarting(window.palette);
    let digitSize = window.digitsize;
    let current;
    let rep;
    let nixLocation;
    let output = '';
    let loc = 0;
    while (loc < colors.length) {
        switch (colors[loc]) {
            // A loop, ordered as 'x char times ,'
            case 'x':
                // Get the location of the ending comma
                nixLocation = colors.indexOf(",", ++loc);
                // Get the color
                current = makeDigit(paletteRef[colors.slice(loc, loc += digitSize)], window.digitsize);
                // Get the rep times
                rep = Number(colors.slice(loc, nixLocation));
                // Add that int to output, rep many times
                while (rep--) {
                    output += current;
                }
                loc = nixLocation + 1;
                break;

            // A palette changer, in the form 'p[X,Y,Z...]' (or 'p' for default)
            case 'p':
                // If the next character is a '[', customize.
                if (colors[++loc] === '[') {
                    nixLocation = colors.indexOf(']');
                    // Isolate and split the new palette's numbers
                    paletteRef = getPaletteReference(colors.slice(loc + 1, nixLocation).split(","));
                    loc = nixLocation + 1;
                    digitSize = 1;
                }
                // Otherwise go back to default
                else {
                    paletteRef = getPaletteReference(window.palette);
                    digitSize = window.digitsize;
                }
                break;

            // A typical number
            default:
                output += makeDigit(paletteRef[colors.slice(loc, loc += digitSize)], window.digitsize);
                break;
        }
    }

    return output;
};

// Now that the sprite is unraveled, expand it to scale (repeat characters)
// Height isn't known, so it'll be created during drawtime
const spriteExpand = (colors) => {
    let output = '';

    // For each number,
    let i = 0;
    while (i < colors.length) {
        const current = colors.slice(i, i += digitsize);
        // Put it into output as many times as needed
        for (let j = 0; j < scale; ++j) {
            output += current;
        }
    }
    return output;
};

// Given the expanded version of colors, output the rgba array
// To do: not be so crappy
const spriteGetArray = (colors) => {
    const numColors = colors.length / digitsize;
    const split = colors.match(new RegExp('.{1,' + digitsize + '}', 'g'));
    const output = new Uint8ClampedArray(numColors * 4);

    // For each color,
    for (let i = 0, j = 0; i < numColors; ++i) {
        // Grab its RGBA ints
        const reference = palette[Number(split[i])];
        // Place each in output
        for (let k = 0; k < 4; ++k) {
            output[j + k] = reference[k];
        }
        j += 4;
    }

    return output;
};


/* Sprite Searching */
// These functions find a sprite in library.sprites, and parse it

// Goes through all the motions of finding and parsing a thing's sprite
// This is called when the sprite's appearance changes.
const setThingSprite = (thing) => {
    if (thing.hidden || !thing.title) {
        return;
    }
    // The cache is first chcked for previous references to the same className
    const width = thing.spritewidth;
    const height = thing.spriteheight;

    // If one isn't found, search for it manually
    const sprite = getSpriteFromLibrary(thing);
    if (!sprite) {
        console.log("Could not get sprite from library on " + thing.title);
        return;
    }
    if (sprite.multiple) {
        expandObtainedSpriteMultiple(sprite, thing, width, height);
        thing.sprite_type = sprite.type;
    } else {
        expandObtainedSprite(sprite, thing, width, height);
        thing.sprite_type = "normal";
    }
};

// Given a thing, it will determine which sprite in library.sprites it should use
// This is based off a key which uses the setting, title, and classes
const getSpriteFromLibrary = (thing) => {
    const cache = library.cache;
    const title = thing.title;
    const libType = thing.libtype;
    const className = thing.className;
    const classes = className.split(/\s+/g).slice(1).sort();
    const setting = (window.setting || window.defaultsetting).split(' ');

    // So it knows to do these conditionally, add them to the front
    for (let i in setting) {
        classes.unshift(setting[i]);
    }

    const key = title + " " + classes; // ex: "Player player,running,small,two"
    let cached = cache[key];

    // Since one isn't found, search for it manually
    let sprite;
    if (!cached) {
        sprite = library.sprites[libType][title];
        if (!sprite || !sprite.constructor) {
            console.warn("Error in checking for sprite of " + title + ".");
            console.log("Title " + title, "\nLibtype " + libType, "\nclassName " + thing.className, "\n", thing, "\n");
            return;
        }
        // If it's more complicated, search for it
        if (sprite.constructor !== Uint8ClampedArray) {
            sprite = findSpriteInLibrary(thing, sprite, classes);
        }

        // The plain data has been found, so that shall be saved
        cached = cache[key] = {raw: sprite};
    } else {
        sprite = cached.raw;
    }

    // The raw cache has been found or set: now to adjust for flipping
    // To do: use .flip-horiz, .flip-vert
    switch (String(Number(classes.indexOf("flipped") >= 0)) + String(Number(classes.indexOf("flip-vert") >= 0))) {
        case "11":
            if (!cached["flipboth"]) {
                sprite = cached["flipboth"] = flipSpriteArrayBoth(sprite);
            } else {
                sprite = cached["flipboth"];
            }
            break;
        case "10":
            if (!cached["fliphoriz"]) {
                sprite = cached["fliphoriz"] = flipSpriteArrayHoriz(sprite, thing);
            } else {
                sprite = cached["fliphoriz"];
            }
            break;
        case "01":
            if (!cached["flipvert"]) {
                sprite = cached["flipvert"] = flipSpriteArrayVert(sprite, thing);
            } else {
                sprite = cached["flipvert"];
            }
            break;
        default:
            sprite = cached.raw;
    }

    return sprite;
};

// The typical use case: given a sprite and thing+dimensions, expand it based on scale and write it to the sprite
const expandObtainedSprite = (sprite, thing, width, height, noRefill) => {
    // With the rows set, repeat them by unitsize to create the final, parsed product
    const parsed = new Uint8ClampedArray(sprite.length * scale);
    const rowSize = width * unitsizet4;
    const heightScale = height * scale;
    let readLoc = 0;
    let writeLoc = 0;

    // For each row:
    for (let si = 0; si < heightScale; ++si) {
        // Add it to parsed x scale
        for (let sj = 0; sj < scale; ++sj) {
            memcpyU8(sprite, parsed, readLoc, writeLoc, rowSize);
            writeLoc += rowSize;
        }
        readLoc += rowSize;
    }

    // If this isn't part of a multiple sprite, record the sprite into the thing's canvas
    if (!noRefill) {
        thing.num_sprites = 1;
        thing.sprite = parsed;
        refillThingCanvas(thing);
    }
    return parsed;
};

// A set of multiple sprites must each be manipulated individually
const expandObtainedSpriteMultiple = (sprites, thing, width, height) => {
    // The middle (repeated) sprite is used as normal
    const parsed = {};
    let sprite;
    thing.num_sprites = 0;

    // Expand each array from the multiple sprites to parsed
    for (let part in sprites) {
        // If it's an actual sprite array, parse it
        if ((sprite = sprites[part]).constructor === Uint8ClampedArray) {
            ++thing.num_sprites;
            parsed[part] = expandObtainedSprite(sprite, thing, width, height, true);
        } else if (typeof(sprite) === "number") {
            // If it's a number, multiply it by the scale
            parsed[part] = sprite * scale;
        } else {
            // Otherwise just add it
            parsed[part] = sprite;
        }
    }

    // Set the thing canvas (parsed.middle)
    thing.sprite = parsed.middle;
    thing.sprites = parsed;
    refillThingCanvases(thing, parsed);
};

// Called when getSpriteFromLibrary has determined the cache doesn't contain the thing
function findSpriteInLibrary(thing, current, classes) {
    var nogood, check, i, prev = current;

    // If it's a sprite multiple, return that
    if (current.multiple) return current;

    // TO DO: GET RID OF THIS IN RELEASE
    var loop_num = 0;

    // Otherwise, keep searching deeper until a string or SpriteMultiple is found
    while (nogood = true) {
        // TO DO: GET RID OF THIS IN RELEASE
        if (++loop_num > 49) {
            alert(thing.title);
            console.log(thing.title, classes, current);
        }
        // If one of the classes is a child of current, go there and remove the class
        for (i in classes) {
            if (check = current[classes[i]]) {
                current = check;
                classes.splice(i, 1);
                nogood = false;
                break;
            }
        }

        // If none match, try the default ('normal')
        if (nogood) {
            if (check = current.normal) {
                nogood = false;
                switch (check.constructor) {
                    // If it's a sprite array, you've found it.
                    case Uint8ClampedArray:
                    case SpriteMultiple:
                        return check;
                    // If it's an object, recurse normally
                    case Object:
                        current = check;
                        break;
                    default:
                        current = current[check];
                        break;
                }
            } else nogood = true;
        }

        // Check the type to see what to do next
        if (!nogood && current) {
            switch (current.constructor) {
                // You did it!
                case Uint8ClampedArray:
                case SpriteMultiple:
                    return current;
                // Keep going
                case "Object":
                    continue;
            }
        } else {
            console.log("\nSprite not found! Title: " + thing.title);
            console.log("Classname:", thing.className);
            console.log("Remaining", classes);
            console.log("Current", current);
            console.log("Prev", prev);
            return new Uint8ClampedArray(thing.spritewidth * thing.spriteheight);
        }
    }
}

/* Pixel drawing */
// With sprites set, they must be drawn

// Draws a thing's sprite to its canvas
// Called when a new sprite is found from the library
// To do: memcpyU8 improvements?
function refillThingCanvas(thing) {
    var canvas = thing.canvas,
        context = thing.context,
        imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    memcpyU8(thing.sprite, imageData.data);
    context.putImageData(imageData, 0, 0);
    window.stuff = window.stuff || {};
    window.stuff[thing.title] = thing.canvas.toDataURL();
}

// Like refillThingCanvas, but for multiple sprites
function refillThingCanvases(thing, parsed) {
    var canvases = thing.canvases = {},
        width = thing.spritewidthpixels,
        height = thing.spriteheightpixels,
        part, imageData, canvas, context, i;
    thing.num_sprites = 1;

    for (i in parsed) {
        // If it's a Uint8ClampedArray, parse it into a canvas and add it
        if ((part = parsed[i]) instanceof Uint8ClampedArray) {
            ++thing.num_sprites;
            // Each canvas has a .canvas and a .context
            canvases[i] = canvas = {canvas: getCanvas(width, height)};
            canvas.context = context = canvas.canvas.getContext("2d");
            imageData = context.getImageData(0, 0, width, height);
            memcpyU8(part, imageData.data);
            context.putImageData(imageData, 0, 0);
        }
        // Otherwise just add it normally
        else {
            canvases[i] = part;
        }
    }
    // Treat the middle canvas as the normal
    canvas = canvases.middle;
    thing.canvas = canvas.canvas;
    thing.context = canvas.context;
}

// This is called every upkeep to refill the main canvas
const refillCanvas = () => {
    window.context.fillStyle = window.fillStyle;
    window.context.fillRect(0, 0, window.canvas.width, window.canvas.height);
    for (let i = window.scenery.length - 1; i >= 0; --i) {
        drawThingOnCanvas(window.context, window.scenery[i]);
    }
    for (let i = window.solids.length - 1; i >= 0; --i) {
        drawThingOnCanvas(window.context, window.solids[i]);
    }
    for (let i = window.characters.length - 1; i >= 0; --i) {
        drawThingOnCanvas(window.context, window.characters[i]);
    }
};

// General function to draw a thing to a context
// Calls drawThingOnCanvas[Single/Multiple] with more arguments
const drawThingOnCanvas = (context, me) => {
    if (me.hidden) {
        return;
    }
    let leftC = me.left;
    let topC = me.top;
    if (leftC > innerWidth) {
        return;
    }

    // If there's just one sprite, it's pretty simple
    // drawThingOnCanvasSingle(context, me.canvas, me, leftc, topc);
    if (me.num_sprites == 1) {
        drawThingOnCanvasSingle(context, me.canvas, me, leftC, topC);
    } else {
        // Otherwise some calculations will be needed
        drawThingOnCanvasMultiple(context, me.canvases, me.canvas, me, leftC, topC);
    }
};

// Used for the vast majority of sprites, where only one sprite is drawn
function drawThingOnCanvasSingle(context, canvas, me, leftc, topc) {
    if (me.repeat) drawPatternOnCanvas(context, canvas, leftc, topc, me.unitwidth, me.unitheight);
    // else context.putImageData(me.context.getImageData(0, 0, me.spritewidthpixels, me.spriteheightpixels), leftc, topc);
    else context.drawImage(canvas, leftc, topc);
}

// Slower than single; used when things have multiple sprites.
function drawThingOnCanvasMultiple(context, canvases, canvas, me, leftc, topc) {
    var topreal = topc,
        leftreal = leftc,
        rightreal = me.right,
        bottomreal = me.bottom,
        widthreal = me.unitwidth,
        heightreal = me.unitheight,
        spritewidthpixels = me.spritewidthpixels,
        spriteheightpixels = me.spriteheightpixels,
        sdiff, canvasref;

    // Vertical sprites may have 'top', 'bottom', 'middle'
    if (me.sprite_type[0] == 'v') {
        // If there's a bottom, draw that and push up bottomreal
        if (canvasref = canvases.bottom) {
            sdiff = canvases.bottomheight || me.spriteheightpixels;
            // drawPatternOnCanvas(context, canvasref.canvas, leftreal, bottomreal - sdiff, spritewidthpixels, min(heightreal, spriteheightpixels));
            drawPatternOnCanvas(context, canvasref.canvas, leftreal, bottomreal - sdiff, widthreal, min(heightreal, spriteheightpixels));
            bottomreal -= sdiff;
            heightreal -= sdiff;
        }
        // If there's a top, draw that and push down topreal
        if (canvasref = canvases.top) {
            sdiff = canvases.topheight || me.spriteheightpixels;
            // drawPatternOnCanvas(context, canvasref.canvas, leftreal, topreal, spritewidthpixels, min(heightreal, spriteheightpixels));
            drawPatternOnCanvas(context, canvasref.canvas, leftreal, topreal, widthreal, min(heightreal, spriteheightpixels));
            topreal += sdiff;
            heightreal -= sdiff;
        }
    }

    // Horizontal sprites may have 'left', 'right', 'middle'
    else if (me.sprite_type[0] == 'h') {
        // If there's a left, draw that and push up leftreal
        if (canvasref = canvases.left) {
            sdiff = canvases.leftwidth || me.spritewidthpixels;
            // drawPatternOnCanvas(context, canvasref.canvas, leftreal, topreal, min(widthreal, spritewidthpixels), spriteheightpixels);
            drawPatternOnCanvas(context, canvasref.canvas, leftreal, topreal, min(widthreal, spritewidthpixels), heightreal);
            leftreal += sdiff;
            widthreal -= sdiff;
        }
        // If there's a right, draw that and push back rightreal
        if (canvasref = canvases.right) {
            sdiff = canvases.rightwidth || me.spritewidthpixels;
            // drawPatternOnCanvas(context, canvasref.canvas, rightreal - sdiff, topreal, min(widthreal, spritewidthpixels), spriteheightpixels);
            drawPatternOnCanvas(context, canvasref.canvas, rightreal - sdiff, topreal, min(widthreal, spritewidthpixels), heightreal);
            rightreal -= sdiff;
            widthreal -= sdiff;
        }
    }

    // If there's still room, draw the actual canvas
    if (topreal < bottomreal && leftreal < rightreal) {
        drawPatternOnCanvas(context, canvas, leftreal, topreal, widthreal, heightreal);
    }
}


/* Helpers */

// Given a string of a palette, this returns the actual palette object
function getPaletteReferenceStarting(palette) {
    var output = {};
    for (var i = 0; i < palette.length; ++i)
        output[makeDigit(i, digitsize)] = makeDigit(i, digitsize);
    return output;
}

// Given a new palette string, makes a new palette object? Not sure.
function getPaletteReference(palette) {
    var output = {},
        digitsize = getDigitSize(palette);
    for (var i = 0; i < palette.length; ++i)
        output[makeDigit(i, digitsize)] = makeDigit(palette[i], digitsize);
    return output;
}

// Flipping horizontally is reversing pixels within each row
function flipSpriteArrayHoriz(sprite, thing) {
    var length = sprite.length,
        width = thing.spritewidth,
        height = thing.spriteheight,
        newsprite = new Uint8ClampedArray(length),
        rowsize = width * unitsizet4,
        newloc, oldloc,
        i, j, k;
    // For each row
    for (i = 0; i < length; i += rowsize) {
        newloc = i;
        oldloc = i + rowsize - 4;
        // For each pixel
        for (j = 0; j < rowsize; j += 4) {
            for (k = 0; k < 4; ++k)
                newsprite[newloc + k] = sprite[oldloc + k];
            newloc += 4;
            oldloc -= 4;
        }
    }
    return newsprite;
}

// Flipping vertically is reversing the order of rows
function flipSpriteArrayVert(sprite, thing) {
    var length = sprite.length,
        width = thing.spritewidth,
        height = thing.spriteheight,
        newsprite = new Uint8ClampedArray(length),
        rowsize = width * unitsizet4,
        newloc = 0,
        oldloc = length - rowsize,
        i, j, k;

    // For each row
    while (newloc < length) {
        // For each pixel in the rows
        for (i = 0; i < rowsize; i += 4) {
            // For each rgba value
            for (j = 0; j < 4; ++j) {
                newsprite[newloc + i + j] = sprite[oldloc + i + j];
            }
        }
        newloc += rowsize;
        oldloc -= rowsize;
    }

    return newsprite;
}

// Flipping both horizontally and vertically is actually just reversing the order of pixels
function flipSpriteArrayBoth(sprite) {
    var length = sprite.length,
        newsprite = new Uint8ClampedArray(length),
        oldloc = sprite.length - 4,
        newloc = 0,
        i;
    while (newloc < length) {
        for (i = 0; i < 4; ++i)
            newsprite[newloc + i] = sprite[oldloc + i];
        newloc += 4;
        oldloc -= 4;
    }
    return newsprite;
}

// Because of how often it's used by the regular draw functions
// Not a fan of this lack of control over pattern source coordinates...
function drawPatternOnCanvas(context, source, leftc, topc, unitwidth, unitheight) {
    context.translate(leftc, topc);
    context.fillStyle = context.createPattern(source, "repeat");
    context.fillRect(0, 0, unitwidth, unitheight);
    context.translate(-leftc, -topc);
}

// http://www.html5rocks.com/en/tutorials/webgl/typed_arrays/
// http://www.javascripture.com/Uint8ClampedArray
// function memcpyU8(source, destination, readloc, writeloc, length) {
// if(readloc == null) readloc = 0;
// if(length == null) length = source.length - readloc;
// destination.set(source.subarray(readloc || 0, length), writeloc || 0);
// }
function memcpyU8(source, destination, readloc, writeloc, writelength/*, thing*/) {
    if (!source || !destination || readloc < 0 || writeloc < 0 || writelength <= 0) return;
    if (readloc >= source.length || writeloc >= destination.length) {
        return;
    }
    if (readloc == null) readloc = 0;
    if (writeloc == null) writeloc = 0;
    if (writelength == null) writelength = max(0, min(source.length, destination.length));

    var lwritelength = writelength + 0; // Allow JIT integer optimization (Firefox needs this)
    var lwriteloc = writeloc + 0;
    var lreadloc = readloc + 0;
    while (lwritelength--)
        // while(--lwritelength)
        destination[lwriteloc++] = source[lreadloc++];
}
