import { createTestAdapter, type TestAdapter } from "@effectionx/test-adapter";

import * as bdd from "@std/testing/bdd";

export function assertOk<T>(
  result: Result<T>,
): asserts result is { ok: true; value: T } {
  if (!result.ok) {
    throw new Error(result.error.message);
  }
}

export interface EffectionTestContext {
  ["@effectionx/test-adapter"]: TestAdapter;
}

export function describe(name: string, body: () => void) {
  return bdd.describe(name, () => {
    bdd.beforeAll<EffectionTestContext>(function () {
      let parent = this["@effectionx/test-adapter"];
      this["@effectionx/test-adapter"] = createTestAdapter({ name, parent });
    });
    bdd.afterAll<EffectionTestContext>(async function () {
      let current = this["@effectionx/test-adapter"];
      this["@effectionx/test-adapter"] = current.parent!;
      await current.destroy();
    });
    body();
  });
}

export type BeforeEachArgs = Parameters<TestAdapter["addSetup"]>;

export function beforeEach(...args: BeforeEachArgs): void {
  bdd.beforeEach<EffectionTestContext>(function () {
    this["@effectionx/test-adapter"].addSetup(...args);
  });
}

export type ItBody = Parameters<TestAdapter["runTest"]>[0];

export function it(name: string, body?: ItBody): void {
  if (body) {
    bdd.it<EffectionTestContext>(name, function () {
      return this["@effectionx/test-adapter"].runTest(body);
    });
  } else {
    bdd.it.skip(name, () => {});
  }
}

it.only = (name: string, body: ItBody) => {
  bdd.it.only<EffectionTestContext>(name, function () {
    return this["@effectionx/test-adapter"].runTest(body);
  });
};
it.skip = (name: string, _body: ItBody) => bdd.it.skip(name, () => {});

import { type Async, expect as $expect, type Expected } from "@std/expect";
import type { Result } from "effection";

interface ExtendedExpected<IsAsync = false> extends Expected<IsAsync> {
  toBeErr: (expected?: unknown) => unknown;
  toBeOk: (expected?: unknown) => unknown;

  // NOTE: You also need to overrides the following typings to allow modifiers to correctly infer typing
  not: IsAsync extends true ? Async<ExtendedExpected<true>>
    : ExtendedExpected<false>;
  resolves: Async<ExtendedExpected<true>>;
  rejects: Async<ExtendedExpected<true>>;
}

export const expect = $expect<ExtendedExpected>;

$expect.extend({
  toBeOk(context, options?: unknown) {
    let { value } = context;
    let pass = isOk(value) &&
      (typeof options === "undefined" || options === value.value);

    if (context.isNot) {
      return {
        pass,
        message: () => `Expected NOT to be ok, but was Ok(${value})`,
      };
    } else {
      let actually = isErr(value)
        ? `was Err(${value.error})`
        : `${value} is not a Result`;
      return {
        pass,
        message: () => `Expected to be Ok(${options ?? ""}) but ${actually}`,
      };
    }
  },
  toBeErr(context, options?: string) {
    let { value } = context;
    let pass = isErr(value) &&
      (typeof options === "undefined" || options === value.error.message);
    if (context.isNot) {
      return {
        pass,
        message: () =>
          `Expected NOT to be an error, but was Err(${
            (value as { error: Error }).error
          })`,
      };
    } else {
      let actually = isOk(value)
        ? `was Ok(${value.value})`
        : isErr(value)
        ? `but was Err(${value.error})`
        : `${value} is not a Result`;
      return {
        pass,
        message: () => `Expected to be Err(${options}), but ${actually}`,
      };
    }
  },
});

function isOk<T>(value: unknown): value is Result<T> & { ok: true } {
  let result = value as Result<T>;
  return result.ok;
}

function isErr<T>(value: unknown): value is { error: Error } {
  let result = value as Result<T>;
  return !result.ok && typeof result.error !== "undefined";
}
