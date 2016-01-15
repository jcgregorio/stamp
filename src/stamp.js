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

  // Utiltity function for creating a custom element.
  //
  // name - The name of the custom element.
  // proto - And object to use as the elements prototype.
  ns.newElement = function(name, proto) {
    var ep = Object.create(HTMLElement.prototype);
    Object.keys(proto).forEach(function(key) {
      ep[key] = proto[key];
    });
    var __ = ep.__ = {};
    __.context = new ns.Context();
    __.name = name;
    document.registerElement(name, {
      prototype: ep
    });
  }

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
    var found = false;
    var matches = [];

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
      clones.push(a[i].cloneNode(true));
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
              if (Object.prototype.toString.call( childState) === '[object Array]') {
                for (var k = 0, klen = childState.length; k < klen; k++) {
                  var item = childState[k];
                  var cl = cloneAllNodes(tpl);
                  var instanceState = {};
                  instanceState[name] = item;
                  instanceState[iterName || "i"] = k;
                  instanceState["^"] = state;
                  expand(cl, instanceState);
                  appendChildren(e, cl);
                }
              } else {
                var keys = Object.keys(childState).sort();
                for (var m = 0, mlen = keys.length; m < mlen; m++) {
                  var key = keys[m];
                  var cl = cloneAllNodes(tpl);
                  var instanceState = {};
                  instanceState[name] = childState[key];
                  instanceState[iterName || "key"] = key;
                  instanceState["^"] = state;
                  expand(cl, instanceState);
                  appendChildren(e, cl);
                }
              }
            } else {
              m = expandString(attr.value, state);
              if (m != null) {
                var name = attr.name;
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
        for (var i = e.childNodes.length - 1; i >= 0; i--) {
          expand(e.childNodes[i], state);
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

  // <host-content> acts similar to the classic <content select="[css selector]"></content>,
  // but as of today <content> isn't standardized and may change in the
  // future, so we use our own custom element for now.
  ns.newElement('host-content', {});

  // Look for <host-content> elements in target and use their select's to pick
  // nodes from source to replace it with.
  function distribute(targets, source) {
    if (!Array.isArray(targets)) {
      targets = [targets];
    }
    for (var i = targets.length - 1; i >= 0; i--) {
      var target = targets[i];
      var nodes = target.querySelectorAll('host-content');
      for (var i=nodes.length-1; i>=0; i--) {
        var node = nodes.item(i);
        var parent = node.parentNode;
        var select = node.getAttribute('select');
        if (select) {
          var sources = source.querySelectorAll(select);
          for (var j=sources.length-1; j>=0; j--) {
            parent.insertBefore(sources.item(j), node);
          }
        }
        parent.removeChild(node);
      }
    }
    return targets;
  };

  // Expand ele with the values in state, then distribute
  // nodes in source within the result.
  function expandAndDistribute(ele, state, source) {
    return distribute(expand(ele, state), source);
  };

  // state is optional, if not provided then 'ele' is used.
  // id is optional, if not provided then ele.__.name is used.
  // Presumes that ele is a custom element created with newElement, i.e.
  // that ele.__.context will be a Context object, and that
  // ele.__.name will be the element name.
  function elementExpand(ele, id, state) {
    if (state === undefined) {
      state = ele;
    }
    if (id === undefined) {
      id = ele.__.name;
    }
    var d = ns.expandAndDistribute(ele.__.context.import(id), state, ele);
    ns.appendChildren(ele, d);
  }

  ns.appendChildren = appendChildren;
  ns.expand = expand;
  ns.distribute = distribute;
  ns.expandAndDistribute = expandAndDistribute;
  ns.elementExpand = elementExpand;
  ns.expandInto = expandInto;
})(Stamp);
