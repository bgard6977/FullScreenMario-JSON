/* toned.js */
// A mini-library I use for some short, useful functions
// Pass in true to give all the functions to window

function TonedJS(give_window) {
  var toned = {
    /* Object Shenanigans */
    
    // Like giveSup/erior, but it doesn't override pre-existing members
    giveSub: function(donor, recipient) {
      recipient = recipient || {};
      for(var i in donor)
        if(!recipient.hasOwnProperty(i))
          recipient[i] = donor[i];
      return recipient;
    },
    
    // Proliferates all members of the donor to the recipient recursively
    // This is more intelligent than giveSup & giveSub
    proliferate: function(recipient, donor, no_override) {
      var setting, i;
      // For each attribute of the donor
      for(i in donor) {
        // If no_override is specified, don't override if it already exists
        if(no_override && recipient.hasOwnProperty(i)) continue;
        // If it's an object, recurse on a new version of it
        if(typeof(setting = donor[i]) == "object") {
          if(!recipient.hasOwnProperty(i)) recipient[i] = new setting.constructor();
          proliferate(recipient[i], setting, no_override);
        }
        // Regular primitives are easy to copy otherwise
        else recipient[i] = setting;
      }
      return recipient;
    },
    
    // Blindly grabs the last key or value of the object, depending on grabkey
    getLast: function(obj, grabkey) {
      for(var i in obj) {} return grabkey ? i : obj[i];
    },
    
    // Follows a path inside an object recursively
    // Path is ["path", "to", "target"], where num is how far along the path it is
    // Num must be given at start, for performance reasons
    // To do: allow a function version?
    followPath: function(obj, path, num) {
      if(path.hasOwnProperty(num) && obj.hasOwnProperty(path[num]))
        return followPath(obj[path[num]], path, num + 1);
      return obj;
    },
    
    // A version of followPath that returns undefined upon failure
    followPathStrict: function(obj, path, num) {
      for(var num = num || 0, len = path.length; num < len; ++num)
        if(!obj.hasOwnProperty(path[num])) return undefined;
        else obj = obj[path[num]];
      return obj;
    },
    
    
    /* HTML Element Manipulations */
    
    // Creates an element, and uses proliferate on all the other arguments
    // * createElement()    // (just returns a new div)
    // * createElement("div", {width: "350px", style: {class: "Toned"}});
    createElement: function(type) {
      var elem = document.createElement(type || "div"),
          i = arguments.length;
      while(--i > 0) // because negative
        proliferate(elem, arguments[i]);
      return elem;
    },
    
    // Simple expressions to add/remove classes
    classAdd: function(me, strin) { me.className += " " + strin; },
    classRemove: function(me, strout) { me.className = me.className.replace(new RegExp(" " + strout, "gm"), ""); },
    
    // Position changing
    elementShiftLeft: function(me, left) {
      if(!me.left) me.left = Number(me.style.marginLeft.replace("px", ""));
      me.style.marginLeft = round(me.left += left) + "px";
    },
    elementShiftTop: function(me, top) {
      if(!me.top) me.top = Number(me.style.marginLeft.replace("px", ""));
      me.style.marginTop = round(me.top += top) + "px";
    },
    
    // Deletes an element if it's in its parent, or the body
    removeChildSafe: function(child, container) {
      if(!child) return;
      container = container || document.body;
      if(container.contains(child)) container.removeChild(child);
    },
    
    // Clears all timer events from setTimeout and setInterval
    clearAllTimeouts: function() {
      var id = setTimeout(function() {});
      while(id--) clearTimeout(id);
    },
    
    preventDefault: function(event) {
      if(event && event.preventDefault instanceof Function)
        event.preventDefault();
    },
    
    /* String manipulations */
    
    // Similar to arrayOf
    stringOf: function(me, n) {
      return (n == 0) ? '' : new Array(1 + (n || 1)).join(me);
    },
    // Checks if a haystack contains a needle
    stringHas: function(haystack, needle) {
      return haystack.indexOf(needle) != -1;
    },

    /* Array manipulations */
    
    // It's nice to have X-dimensional arrays
    ArrayD: function(dim) {
      // 1-dimensionals are easy
      if(arguments.length == 1) return new Array(dim);
      // Otherwise recurse
      var rargs = arrayMake(arguments),
          me = new Array(dim),
          i;
      rargs.shift();
      for(i = dim - 1; i >= 0; --i) {
        me[i]= ArrayD.apply(this, rargs);
      }
      return me;
    },
    // Looking at you, function arguments
    arrayMake: function(me) {
      return Array.prototype.slice.call(me);
    },
    arrayShuffle: function(arr, start, end) {
      start = start || 0;
      end = end || arr.length;
      for(var i = start, temp, sloc; i <= end; ++i) {
        sloc = randInt(i+1);
        temp = arr[i];
        arr[i] = arr[sloc];
        arr[sloc] = temp;
      }
      return arr;
    },

    /* Number manipulations */
    
    // Converts ('7',3,1) to '117'
    makeDigit: function(num, size, fill) {
      num = String(num);
      return stringOf(fill || 0, max(0, size - num.length)) + num;
    },
    roundDigit: function(n, d) { return Number(d ? ~~(0.5 + (n / d)) * d : round(n)); },
    // It's often faster to store references to common Math functions
    round: function(n) { return ~~(0.5 + n); },
    max: Math.max,
    min: Math.min,
    abs: Math.abs,
    pow: Math.pow,
    ceil: Math.ceil,
    floor: Math.floor,
    random: Math.random,
    // Returns a number between [0, n)
    randInt: function(n) { return floor(Math.random() * (n || 1)); },
    // Positives are true, negatives are false
    signBool: function(n) { return n > 0 ? true : false; },
    
    /* Etcetera */
    
    // Timing
    now: Date.now
  };
  
  if(give_window) toned.giveSub(toned, window);
  
  return toned;
}