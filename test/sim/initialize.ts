import { each, main, type Operation } from "effection";
import { useConnection } from "../../lib/json-rpc-connection.ts";

await main(function* () {
  let client = yield* useConnection({
    read: Deno.stdin.readable,
    write: Deno.stdout.writable,
  });

  for (let respond of yield* each(client.requests)) {
    yield* respond(() =>
      constant({
        capabilities: {
          hoverProvider: true,
        },
        serverInfo: {
          name: "lspx simulator",
          version: "1.0",
        },
      })
    );
    yield* each.next();
  }
});

function constant<T>(value: T): Operation<T> {
  return {
    [Symbol.iterator]: () => ({ next: () => ({ done: true, value }) }),
  };
}
