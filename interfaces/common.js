declare type AnyFunction = () => any;
declare type CallWith<U, V> = (u: U) => V;

declare var describe: any;
declare var it: any;

declare module 'sinon' {
  declare var spy: any;
  declare var stub: any;
  declare var expectation: any;
  declare var mock: any;
  declare var useFakeTimers: any;
  declare var clock: any;
  declare var useFakeXMLHttpRequest: any;
  declare var FakeXMLHttpRequest: any;
  declare var fakeServer: any;
  declare var fakeServerWithClock: any;
  declare var assert: any;
  declare var match: any;
  declare var sandbox: any;

  declare var config: any;
  declare function test(fn: (...args: any[]) => any): any;
  declare function testCase(tests: any): any;
  declare function createStubInstance(constructor: any): any;
  declare function format(obj: any): string;
  declare function log(message: string): void;
  declare function restore(object: any): void;
}

declare module 'sinon-chai' {
  declare function sinonChai(chai: any, utils: any): void;
}

declare module 'chai' {
  declare var exports: {
    expect: any;
    should(): any;
    assert: any;
    config: any;
  }
  /**
   * Provides a way to extend the internals of Chai
   */
  declare function use(fn: (chai: any, utils: any) => void): any;
}
