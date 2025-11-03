import { call, each, type Operation, resource, spawn } from "effection";
import { DelimiterStream } from "@std/streams";
import { Buffer } from "node:buffer";

import type { LSPAgent, RPCEndpoint } from "./types.ts";

import { useDaemon } from "./use-command.ts";
import { useConnection } from "./json-rpc-connection.ts";
import { useMultiplexer } from "./multiplexer.ts";

export interface LSPXOptions {
  interactive?: boolean;
  input?: ReadableStream<Uint8Array>;
  output?: WritableStream<Uint8Array>;
  errput?: (buffer: Uint8Array) => void;
  commands: string[];
}

export function start(opts: LSPXOptions): Operation<RPCEndpoint> {
  return resource(function* (provide) {
    let agents: LSPAgent[] = [];

    for (let command of opts.commands) {
      let [exe] = command.split(/\s/g);
      let process = yield* useDaemon("/bin/sh", {
        args: ["-c", command],
        stdin: "piped",
        stdout: "piped",
        stderr: "piped",
      });

      let server = yield* useConnection({
        read: process.stdout,
        write: process.stdin,
      });

      let agent = {
        ...server,
        name: exe,
        capabilities: {},
        initialization: { capabilities: {} },
      };

      let { errput } = opts;

      if (errput) {
        yield* useStdErrSink({
          name: exe,
          write: errput,
          source: process.stderr,
        });
      }

      agents.push(agent);
    }

    let multiplexer = yield* useMultiplexer({ agents, middlewares: [] });

    let client = yield* useConnection({
      read: opts.input ?? new ReadableStream(),
      write: opts.output ?? new WritableStream(),
    });

    yield* spawn(function* () {
      for (let respondWith of yield* each(multiplexer.notifications)) {
        yield* respondWith(client.notify);
        yield* each.next();
      }
    });

    yield* spawn(function* () {
      for (let respondWith of yield* each(multiplexer.requests)) {
        yield* respondWith(client.request);
        yield* each.next();
      }
    });

    yield* spawn(function* () {
      for (let respondWith of yield* each(client.requests)) {
        yield* respondWith(multiplexer.request);
        yield* each.next();
      }
    });

    yield* spawn(function* () {
      for (let respondWith of yield* each(client.notifications)) {
        yield* respondWith(multiplexer.notify);
        yield* each.next();
      }
    });

    yield* provide(multiplexer);
  });
}

interface StdErrSinkOptions {
  source: ReadableStream<Uint8Array>;
  name: string;
  write(buffer: Uint8Array): void;
}

function useStdErrSink(options: StdErrSinkOptions) {
  let { source, name, write } = options;
  return resource(function* (provide): Operation<void> {
    let encoder = new TextEncoder();
    let encode = encoder.encode.bind(encoder);

    yield* spawn(function* () {
      let reader = source
        .pipeThrough(new DelimiterStream(encode("\n")))
        .getReader();
      try {
        while (true) {
          let result = yield* call(() => reader.read());
          if (result.done) {
            break;
          } else {
            let line = Buffer.concat([
              encode(`[${name}] `),
              result.value,
              encode("\n"),
            ]);
            write(line as Uint8Array);
          }
        }
      } finally {
        yield* call(() => reader.cancel());
      }
    });

    yield* provide(undefined);
  });
}
