// Loads the library of raw data, then parses it

function resetLibrary(library) {
    window.palette = [
        [0, 0, 0, 0],
        // Grayscales (1-4)
        [255, 255, 255, 255],
        [0, 0, 0, 255],
        [188, 188, 188, 255],
        [116, 116, 116, 255],
        // Reds & Browns (5-11)
        [252, 216, 168, 255],
        [252, 152, 56, 255],
        [252, 116, 180, 255],
        [216, 40, 0, 255],
        [200, 76, 12, 255],
        [136, 112, 0, 255],
        [124, 7, 0, 255],
        // Greens (12-14, and 21)
        [168, 250, 188, 255],
        [128, 208, 16, 255],
        [0, 168, 0, 255],
        // Blues (15-20)
        [24, 60, 92, 255],
        [0, 128, 136, 255],
        [32, 56, 236, 255],
        [156, 252, 240, 255],
        [60, 188, 252, 255],
        [92, 148, 252, 255],
        // Greens (21) for Luigi
        [0, 130, 0, 255]
    ];

    // This starts off at 2
    window.digitsize = getDigitSize(palette);

    // Commonly used filters (placed in the library after parsing)
    const filters = {
        Underworld: ["palette", {"05": "18", "09": "16"}],
        Castle: ["palette", {"02": "04", "05": "01", "09": "03"}],
        Alt: ["palette", {"11": "01"}],
        Alt2: ["palette", {"02": "04", "05": "01", "09": "03", "13": "01", "19": "08"}],
        star: {
            one: ["palette", {}],
            two: ["palette", {"06": "02", "08": "05", "10": "09"}],
            three: ["palette", {"06": "01", "08": "06", "10": "08"}],
            four: ["palette", {"06": "01", "08": "06", "10": "14"}]
        },
        smart: ["palette", {"14": "08"}]
    };

    // Yup.
    window.library = library;
    library.filters = filters;
    library.sprites = libraryParse(library.rawsprites);
    libraryPosts();
}

// Given an object in the library, parse it into sprite data
const libraryParse = (spriteMap) => {
    const setNew = {};
    for (let spriteName in spriteMap) {
        const objref = spriteMap[spriteName];
        switch (objref.constructor) {
            // If it's a string, parse it (unless it's a normal setter)
            case String:
                setNew[spriteName] = spriteGetArray(spriteExpand(spriteUnravel(objref)));
                break;
            // If it's an array, it should have a command such as 'same' to be post-processed
            case Array:
                library.posts.push({caller: setNew, name: spriteName, command: spriteMap[spriteName]});
                break;
            // If it's an object, recurse
            case Object:
                setNew[spriteName] = libraryParse(objref);
                break;
        }
    }
    return setNew;
};

// Evaulates the post commands (e.g. 'same', 'filter')
const libraryPosts = () => {
    const posts = library.posts;
    for (let i in posts) {
        const post = posts[i];
        const caller = post.caller;
        const name = post.name;
        const command = post.command;
        caller[name] = evaluatePost(caller, command, i);
    }
};

const evaluatePost = (caller, command) => {
    switch (command[0]) {
        // Same: just returns a reference to the target
        // ["same", ["container", "path", "to", "target"]]
        case "same":
            return followPath(library.sprites, command[1], 0);

        // Filter: takes a reference to the target, and applies a filter to it
        // ["filter", ["container", "path", "to", "target"], filters.DoThisFilter]
        case "filter":
            const ref = followPath(library.rawsprites, command[1], 0);
            const filter = command[2];
            return applyLibraryFilter(ref, filter);

        // Multiple: uses more than one image, either vertically or horizontally
        // Not to be confused with having .repeat = true.
        // ["multiple", "vertical", {
        //    top: "...",       // (just once at the top)
        //    middle: "..."     // (repeated after top)
        //  }
        case "multiple":
            return evaluatePostMultiple(command);
    }
};

// Supported filters:
// * palette
// * absolutely nothing else.
const applyLibraryFilter = (ref, filter) => {
    switch (filter[0]) {
        case "palette": // only one used so far
            if (ref.constructor === String) {
                return spriteGetArray(spriteExpand(applyPaletteFilter(spriteUnravel(ref), filter[1])));
            }
            return applyPaletteFilterRecursive(ref, filter[1]);
    }
};

// Applies the filter to an object recursively
const applyPaletteFilterRecursive = (ref, filter) => {
    const obj = {};
    for (let i in ref) {
        const found = ref[i];
        switch (found.constructor) {
            case String:
                obj[i] = spriteGetArray(spriteExpand(applyPaletteFilter(spriteUnravel(found), filter)));
                break;
            case Object:
                obj[i] = applyPaletteFilterRecursive(found, filter);
                break;
        }
    }
    return obj;
};

// Actually applies the filter
const applyPaletteFilter = (string, filter) => {
    let output = '';
    const len = string.length;
    for (let i = 0; i < len; i += digitsize) {
        const substr = string.substr(i, digitsize);
        output += filter[substr] || substr;
    }
    return output;
};

// Returns an obj and the parsed version of the following parts of command
// To do: should support filters in the future... is it a simple push?
const evaluatePostMultiple = (command) => {
    const type = command[1];
    const refs = command[2];
    const obj = new SpriteMultiple(type);
    for (let i in refs) {
        const ref = refs[i];
        // To do: enable th emore advanced stuff here, like filtering
        // If it's a string, parse it
        if (typeof(ref) === "string") {
            obj[i] = spriteGetArray(spriteExpand(spriteUnravel(ref)));
        }
        // Otherwise just make it a regular member
        else obj[i] = ref;
    }
    return obj;
};

// Used so object.constructor.name is super awesome
// Type is 'horizontal' or 'vertical'
function SpriteMultiple(type) {
    this.type = type;
    this.multiple = true;
}

const getDigitSize = (palette) => {
    const len = palette.length;
    const str = String(len);
    const num = Number(str.length);
    return num;
};