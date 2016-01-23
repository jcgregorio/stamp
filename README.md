# stamp
HTML templates using the &lt;template> tag. 

Given the following template:

```HTML
<template id=t>
  <p><a href-="{{ url }}">{{ foo.bar.baz }} {{ quux }}</a>!</p>
</template>
```

And the following data:

```JavaScript
var data = {
  foo: { bar: { baz: "Hello"}},
  quux: "World",
  url: "http://example.com",
};
```

Then the following code will expand the template against the data and
append it to the body:

```JavaScript
var ctx = new Stamp.Context();
var expanded = Stamp.expand(ctx.import('t'), data);
Stamp.appendChildren(document.body, expanded);
```

The expansion will look like:

```HTML
<p><a href="http://example.com">Hello World</a>!</p>
```

See the [documentation](https://github.com/jcgregorio/stamp/wiki) for more info.
