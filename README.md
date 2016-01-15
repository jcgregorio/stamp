# stamp
HTML templates using the &lt;template> tag. 

Given the following template:

    <template id=t>
      <p><a href="{{ url }}">{{ foo.bar.baz }} {{ quux }}</a>!</p>
    </template>

And the following data:

     var data = {
          foo: { bar: { baz: "Hello"}},
          quux: "World",
          url: "http://example.com",
      };

Then the following code will expand the template against the data and
append it to the body:

      var ctx = new Stamp.Context();
      var expanded = Stamp.expand(ctx.import('t'), data);
      Stamp.appendChildren(document.body, expanded);

The expansion will look like:

    <p><a href="http://example.com">Hello World</a>!</p>

See the file How_to_use.html for more demos of basic capabilities.
