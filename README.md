# lspx

`lspx` is a language server multiplexer, supervisor, and interactive shell.

```
Usage: lspx [options]

Options:
  -h, --help              Show help
  -i, --interactive       start an interactive session with a multiplexed system (default: false)
      --lsp <string ...>  start and muliplex a server with specified command string                [required]
```

## multiplexer

There are often many language servers active for a given file. For example, if
you are editing some TypeScript for the web, you might want to run some
combination of the following:

- _typescript_ (ts) resolve symbols, provide refactorings
- _tailwind_ (css) provides completion for tailwind utility clases
- _eslint_ (ts) highlight warnings and errors based on project linting settings

In order to provide this union of functionality, IDEs like VSCode must manage
three separate language server processes and then handle the dispatch and
synchronization of all edits and user inputs to each one. What this means in
practice is that in the example above, if you hover over a symbol, that hover
should be sent to each of the typescript, tailwind, and eslint servers. Then any
hints, overlays that any of them have should be collated and displayed at that
point. This is a complex process, and furthermore it is required that it be
duplicated inside every single IDE that wants to use more than one language
server per buffer.

`lspx` combines the capabilities of any number language servers into one, so
that each IDE only needs to interact with a single LSP connection.

To run the three language servers above in unison:

```
lspx --lsp "typescript-language-server --stdio" --lsp "tailwindcss-language-server --stdio" --lsp "eslint-lsp --stdio"
```

## supervisor

//TODO

`lspx` manages the language server processes that it proxies and will attempt to
restart them if they fail. How many times and at what interval is configurable.

## shell

`lspx` allows you to send commands by to the set of lsp, and print their
responses

```
lspx --lsp "deno lsp" --lsp "tailwindcss-language-server" --interactive

lspx
|
+-> deno lsp
+-> tailwindcss-language-server --stdio

LSP> initialize({ "capabilities": {} })
```

## Development

Requires [Deno](https://deno.land) >= 2.0

### compile

```
deno task compile
```

### test

```
deno task test
```

### dispatch

The actual logic of matching requests to servers and merging the responses
happens in [dispatch.ts](./lib/dispatch.ts), so if you're looking to extend the
functionality, that's a great place to start.
