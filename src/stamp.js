var Stamp = Stamp || {};

(function(ns) {

  // Utilty object to capture the document context of the script
  // tag that instantiated the Context. Useful for getting access to
  // assetts in HTML Imports.
  ns.Context = function() {
    this.doc = (document.currentScript||document._currentScript).ownerDocument;
  };

  // Import the element 'id' from the HTML Import into the current docuemnt.
  ns.Context.prototype.import = function(id) {
    return document.importNode(this.doc.querySelector('#'+id).content, true);
  };

  // Regex to grab double moustache'd content.
  var re = /{{\s([\w\.\^]+)\s}}/g;

  // Returns 'state' after applying address, where address is an array of
  // string.
  //
  // I.e. if the state is {a: {b: [9, 8, 7]}} then the address of ["a", "b",
  // 0] would return 9.
  function filterState(address, state) {
    var mystate = state;
    for (var i = 0, len = address.length; i < len; i++) {
      var a = address[i];
      if (a in mystate) {
        mystate = mystate[a];
      } else if (mystate.hasAttribute && mystate.hasAttribute(a)) {
        mystate = mystate.getAttribute(a);
      } else {
        throw a + " is not a valid property of " + JSON.stringify(mystate);
      }
    }
    return mystate;
  }

  // Replace the content in 'str' from [index, index+count) with 'add'.
  function ssplice(str, index, count, add) {
    return str.slice(0, index) + add + str.slice(index + count);
  }

  // Extracts an address path, i.e. ["a", "b", "0"] from the input string 's',
  // such as from "{{a.b.0}}".
  function addressOf(s) {
    if ((match = re.exec(s)) != null) {
      return match[1].split(".");
    } else {
      return null;
    }
  }

  // Keeps expanding double moustache in the text content until there no more
  // double moustache instances. Returns null if no templates were found,
  // otherwise returns the expanded string.
  function expandString(s, state) {
    var match;
    var matches = [];

    // Flush re's cache of the last string it was parsing.
    re.exec("");
    // Find all the matches in s.
    while ((match = re.exec(s)) != null) {
      matches.push(match);
    }

    for (var i = matches.length - 1; i >= 0; i--) {
      match = matches[i];
      var address = match[1].split(".");
      var m = filterState(address, state);
      s = ssplice(s, match.index, match[0].length, m);
    }
    if (matches.length) {
      return s;
    }
    return null;
  }

  // Takes an array of nodes and returns an array of cloned nodes in the same
  // order.
  function cloneAllNodes(a) {
    var clones = [];
    for (var i = 0, len = a.length; i < len; i++) {
      if (a[i].nodeName == "TEMPLATE") {
        // Template nodes have their contents hoisted up to this level for expansion.
        clones.push(a[i].content.cloneNode(true));
      } else {
        clones.push(a[i].cloneNode(true));
      }
    }
    return clones;
  }

  // Append all the elements in 'nodes' as children of 'ele'.
  function appendChildren(ele, nodes) {
    for (var i = 0, len = nodes.length; i < len; i++) {
      ele.appendChild(nodes[i]);
    }
  }

  // Removes all the children of 'ele'.
  function removeChildren(ele) {
    ele.innerHTML = "";
  }

  // Removes all the children of 'ele' and then adds 'nodes' as ele's
  // children.
  function replaceChildren(ele, nodes) {
    ele.innerHTML = "";
    appendChildren(ele, nodes);
  }

  // Expand all the double moustaches found in the node
  // 'ele' and all its children against the data in 'state'.
  //
  // When descending into nested templates, i.e. a data-repeat- template then
  // '^' is added to the child state as a way to access the data in the
  // parent's scope.
  function expand(ele, state) {
    if (ele.nodeName === "#text") {
      m = expandString(ele.textContent, state);
      if (m != null) {
        ele.textContent = m;
      }
      return ele;
    }
    if (!Array.isArray(ele)) {
      ele = [ele];
    }
    for (var j = 0, len = ele.length; j < len; j++) {
      var e = ele[j];
      var processChildren = true;
      if (e.nodeName === "#text") {
        m = expandString(e.textContent, state);
        if (m != null) {
          e.textContent = m;
        }
      } else {
        if (e.attributes != undefined) {
          for (var i = e.attributes.length-1; i >= 0; i--) {
            var attr = e.attributes[i];
            if (attr.name.indexOf('data-repeat') === 0) {
              processChildren = false;
              var parts = attr.name.split('-');
              if (parts.length !== 3 && parts.length !== 4) {
                throw "Repeat format is data-repeat-<name>[-<iterName>]. Got " + attr.name;
              }
              var name = parts[2];
              var iterName = parts[3];
              var tpl = [];
              while (e.firstChild) {
                tpl.push(e.removeChild(e.firstChild));
              }
              var address = [attr.value];
              if (attr.value.indexOf("}}") !== -1) {
                address = addressOf(attr.value);
              }
              if (address === null) {
                throw attr.value + " doesn't contain an address.";
              }
              var childState = filterState(address, state);
              var instanceState = {
                "^": state,
              };
              if (Object.prototype.toString.call( childState) === '[object Array]') {
                iterName = iterName || "i";
                for (var k = 0; k < childState.length; k++) {
                  var cl = cloneAllNodes(tpl);
                  instanceState[name] =  childState[k];
                  instanceState[iterName] = k;
                  expand(cl, instanceState);
                  appendChildren(e, cl);
                }
              } else {
                iterName = iterName || "key";
                var keys = Object.keys(childState).sort();
                for (var m = 0; m < keys.length; m++) {
                  var key = keys[m];
                  var cl = cloneAllNodes(tpl);
                  instanceState[name] = childState[key];
                  instanceState[iterName] = key;
                  expand(cl, instanceState);
                  appendChildren(e, cl);
                }
              }
              // Remove the data-repeat-* attribute.
              e.removeAttribute(attr.name);
            } else {
              m = expandString(attr.value, state);
              if (m != null) {
                var name = attr.name;
                // Strip trailing "-" from attribute names. This allows
                // setting attributes like src on an img where you would't
                // want the unexpanded value to be used by the browser.
                if (name.charAt(name.length-1) == "-") {
                  e.removeAttribute(attr.name);
                  e.setAttribute(attr.name.slice(0, -1), m);
                } else {
                  attr.value = m;
                }
              }
            }
          }
        }
      }
      if (processChildren) {
        var childEle = e.firstChild;
        while (childEle != null) {
          var nextSibling = childEle.nextSibling;
          if (childEle.nodeName == "TEMPLATE") {
            // If this is a template we need to expand the content of the
            // template node, then replace the template node with the expanded
            // content.
            var replacement = expand(childEle.content.cloneNode(true), state);
            while (replacement[0].childNodes.length > 0) {
              e.insertBefore(replacement[0].firstChild, childEle);
            }
            // Finally remove the original element.
            e.removeChild(childEle);
          } else {
            expand(childEle, state);
          }
          childEle = nextSibling;
        }
      }
    }
    return ele;
  };

  // Expand the template 'ele' with 'state' and then replace all the children
  // of 'target' with the expanded content.
  function expandInto(target, ele, state) {
    replaceChildren(target, expand(ele, state));
  }

  ns.appendChildren = appendChildren;
  ns.expand = expand;
  ns.expandInto = expandInto;
})(Stamp);
