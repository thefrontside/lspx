import { Readable, Writable } from "node:stream";
import {
  call,
  createContext,
  createSignal,
  type Operation,
  race,
  resource,
  suspend,
  useAbortSignal,
  useScope,
  withResolvers,
} from "effection";
import * as rpc from "vscode-jsonrpc/node.js";
import type {
  LSPServerNotification,
  LSPServerRequest,
  RPCEndpoint,
} from "./types.ts";
import { disposable, disposableScope } from "./disposable.ts";
import { ResponseError } from "vscode-jsonrpc/node.js";

export type { MessageConnection } from "vscode-jsonrpc";

export interface JSONRPCConnectionOptions {
  write: WritableStream<Uint8Array>;
  read: ReadableStream<Uint8Array>;
}

export function useConnection(
  options: JSONRPCConnectionOptions,
): Operation<RPCEndpoint> {
  return resource(disposableScope(function* (provide) {
    let scope = yield* useScope();
    let signal = yield* useAbortSignal();

    let readable = yield* disposable(
      new rpc.StreamMessageReader(
        //@ts-expect-error 🤷
        Readable.fromWeb(options.read, { signal }),
      ),
    );
    let writable = yield* disposable(
      new rpc.StreamMessageWriter(
        //@ts-expect-error 🤷
        Writable.fromWeb(options.write, { signal }),
      ),
    );

    let connection = yield* disposable(
      rpc.createMessageConnection(readable, writable),
    );

    let notifications = createSignal<LSPServerNotification>();
    let requests = createSignal<LSPServerRequest>();

    yield* disposable(
      connection.onNotification((...params) => {
        notifications.send((execute) => execute(params));
      }),
    );

    yield* disposable(connection.onRequest((...params) => {
      let response = withResolvers<unknown>();
      let error = withResolvers<ResponseError<unknown>>();

      requests.send(function respond(compute) {
        return ResponseErrorContext.with(error.resolve, function* () {
          response.resolve(yield* compute(params));
        });
      });

      return scope.run(() => race([error.operation, response.operation]));
    }));

    connection.listen();

    yield* provide({
      notifications,
      requests,
      notify: (params) => call(() => connection.sendNotification(...params)),
      request: (params) => call(() => connection.sendRequest(...params)),
    });
  }));
}

const ResponseErrorContext = createContext<
  <T>(error: ResponseError<T>) => void
>("responseError");

export function* responseError<T = void>(
  ...args: ConstructorParameters<typeof ResponseError<T>>
  // deno-lint-ignore no-explicit-any
): Operation<any> {
  let raise = yield* ResponseErrorContext.expect();

  raise<T>(new ResponseError(...args));

  yield* suspend();
}
