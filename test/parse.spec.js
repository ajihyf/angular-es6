/* @flow */
/* eslint-env mocha */
import parse from '../src/parse';
import { expect } from 'chai';
import _ from 'lodash';

describe('Parse', function () {
  it('will parse null', function () {
    const fn = parse('null');
    expect(fn()).to.be.null;
  });

  it('will parse true', function () {
    const fn = parse('true');
    expect(fn()).to.be.true;
  });

  it('will parse false', function () {
    const fn = parse('false');
    expect(fn()).to.be.false;
  });

  it('will parse undefined', function () {
    const fn = parse('undefined');
    expect(fn()).to.be.undefined;
  });

  it('ignores whitespaces', function () {
    const fn = parse(' \r\t\v\u00A0\n233');
    expect(fn()).to.equal(233);
  });

  describe('number', function () {
    it('can parse an integer', function () {
      const fn = parse('233');
      expect(fn).to.be.a('function');
      expect(fn()).to.equal(233);
    });

    it('can parse a floating point number', function () {
      const fn = parse('23.3');
      expect(fn()).to.equal(23.3);
    });

    it('can parse a floating number without an integer part', function () {
      const fn = parse('.233');
      expect(fn()).to.equal(0.233);
    });

    it('can parse a number with scientific notation', function () {
      const fn = parse('233e2');
      expect(fn()).to.equal(23300);
    });

    it('can parse scientific notation with a float coefficient', function () {
      const fn = parse('.233e2');
      expect(fn()).to.equal(23.3);
    });

    it('can parse scientific notation with negative', function () {
      const fn = parse('.233e2');
      expect(fn()).to.equal(23.3);
    });

    it('can parse scientific notation + sign', function () {
      const fn = parse('.233e+2');
      expect(fn()).to.equal(23.3);
    });

    it('can parse upper case scientific notation', function () {
      const fn = parse('.233E2');
      expect(fn()).to.equal(23.3);
    });

    it('will not parse invalid scientific notation', function () {
      expect(() => { parse('233e-'); }).to.throw();
      expect(() => { parse('233e-a'); }).to.throw();
    });
  });

  describe('string', function () {
    it('can parse a string in single quotes', function () {
      const fn = parse('\'abc\'');
      expect(fn()).to.equal('abc');
    });

    it('can parse a string in double quotes', function () {
      const fn = parse('"abc"');
      expect(fn()).to.equal('abc');
    });

    it('will not parse a string with mismatching quotes', function () {
      expect(() => { parse('"abs\''); }).to.throw();
    });

    it('can parse a string with single quotes inside', function () {
      const fn = parse('\'a\\\'b\'');
      expect(fn()).to.equal('a\'b');
    });

    it('can parse a string with double quotes inside', function () {
      const fn = parse('"a\\\"b"');  // eslint-disable-line no-useless-escape
      expect(fn()).to.equal('a\"b'); // eslint-disable-line no-useless-escape
    });

    it('will parse a string with unicode escape', function () {
      const fn = parse('"\\u00A0"');
      expect(fn()).to.equal('\u00A0');
    });

    it('will not parse a string with invalid unicode escapes', function () {
      expect(() => { parse('"\\u00T0"'); }).to.throw();
    });
  });

  describe('array', function () {
    it('will parse an empty array', function () {
      const fn = parse('[]');
      expect(fn()).to.be.an('array').and.is.empty;
    });

    it('will parse a non-empty array', function () {
      const fn = parse('[1, "two", [3], true]');
      expect(fn()).to.deep.equal([1, 'two', [3], true]);
    });

    it('will parse an array with trailing comma', function () {
      const fn = parse('[1, 2, 3, ]');
      expect(fn()).to.deep.equal([1, 2, 3]);
    });
  });

  describe('object', function () {
    it('will parse an empty object', function () {
      const fn = parse('{}');
      expect(fn()).to.be.an('object').and.is.empty;
    });

    it('will parse a non-empty object', function () {
      const fn = parse('{ "some key": 1, \'another-key\': true }');
      expect(fn()).to.deep.equal({ 'some key': 1, 'another-key': true });
    });

    it('will parse an object with identifier keys', function () {
      const fn = parse('{ a: 1, b: [0, 1], c: { d: 4 } }');
      expect(fn()).to.deep.equal({ a: 1, b: [0, 1], c: { d: 4 } });
    });
  });

  describe('Member Access', function () {
    it('looks up an attribute from the scope', function () {
      const fn = parse('aKey');
      expect(fn({ aKey: 233 })).to.equal(233);
      expect(fn({})).to.be.undefined;
    });

    it('returns undefined when looking up attribute from undefined', function () {
      const fn = parse('aKey');
      expect(fn()).to.be.undefined;
    });

    it('will parse this', function () {
      const fn = parse('this');
      const scope = {};
      expect(fn()).to.be.undefined;
      expect(fn(scope)).to.equal(scope);
    });

    it('looks up a 2-part identifier path from scope', function () {
      const fn = parse('aKey.anotherKey');
      expect(fn({ aKey: { anotherKey: 233 } })).to.equal(233);
      expect(fn({ aKey: {} })).to.be.undefined;
      expect(fn()).to.be.undefined;
    });

    it('looks up a member from object', function () {
      const fn = parse('{ aKey: 233 }.aKey');
      expect(fn()).to.equal(233);
    });

    it('looks up a 4-part identifier path from the scope', function () {
      const fn = parse('aKey.bKey.cKey.dKey');
      expect(fn({ aKey: { bKey: { cKey: { dKey: 233 } } } })).to.equal(233);
      expect(fn({ aKey: { bKey: { cKey: {} } } })).to.be.undefined;
      expect(fn({ aKey: { bKey: {} } })).to.be.undefined;
      expect(fn({ aKey: {} })).to.be.undefined;
      expect(fn()).to.be.undefined;
    });

    it('uses locals instead of scope when there is a matching key', function () {
      const fn = parse('aKey');
      const scope = { aKey: 233 };
      const locals = { aKey: 256 };
      expect(fn(scope, locals)).to.equal(256);
    });

    it('does not use locals instead of scope when no matching key', function () {
      const fn = parse('aKey');
      const scope = { aKey: 233 };
      const locals = { bKey: 256 };
      expect(fn(scope, locals)).to.equal(233);
    });

    it('uses locals instead of scope when the first part matches', function () {
      const fn = parse('aKey.bKey');
      const scope = { aKey: { bKey: 233 } };
      const locals = { aKey: {} };
      expect(fn(scope, locals)).to.be.undefined;
    });

    it('parses a simple computes property access', function () {
      const fn = parse('aKey["bKey"]');
      const scope = { aKey: { bKey: 233 } };
      expect(fn(scope)).to.equal(233);
    });

    it('parses a computed numeric array access', function () {
      const fn = parse('arr[1]');
      const scope = { arr: [0, 1, 2] };
      expect(fn(scope)).to.equal(1);
    });

    it('parses a computed access with another key as property', function () {
      const fn = parse('aKey[innerKey]');
      const scope = { aKey: { bKey: 233 }, innerKey: 'bKey' };
      expect(fn(scope)).to.equal(233);
    });

    it('parses a computed access with another access as property', function () {
      const fn = parse('aKey[bKey["innerKey"]]');
      const scope = { aKey: { cKey: 233 }, bKey: { innerKey: 'cKey' } };
      expect(fn(scope)).to.equal(233);
    });
  });

  describe('Function Calls', function () {
    it('parses a function call', function () {
      const fn = parse('aFunction()');
      const scope = { aFunction: () => 233 };
      expect(fn(scope)).to.equal(233);
    });

    it('parses a function call with a single number argument', function () {
      const fn = parse('aFunction(233)');
      const scope = { aFunction: n => n };
      expect(fn(scope)).to.equal(233);
    });

    it('parses a function call with a single identifier argument', function () {
      const fn = parse('aFunction(n)');
      const scope = { n: 233, aFunction: n => n };
      expect(fn(scope)).to.equal(233);
    });

    it('parses a function call with a single function argument', function () {
      const fn = parse('aFunction(getN())');
      const scope = { getN: _.constant(233), aFunction: n => n };
      expect(fn(scope)).to.equal(233);
    });

    it('parses a function with multiple arguments', function () {
      const fn = parse('aFunction(15, n, getN())');
      const scope = { n: 2, getN: _.constant(233), aFunction: (a, b, c) => (a + b + c) };
      expect(fn(scope)).to.equal(250);
    });
  });

  describe('Method Calls', function () {
    it('calls methods accessed as computed properties', function () {
      const fn = parse('a["fn"]()');
      const scope = {
        a: {
          b: 233,
          fn: function () {
            return this.b;
          }
        }
      };
      expect(fn(scope)).to.equal(233);
    });

    it('calls methods accessed as non-computed properties', function () {
      const fn = parse('a.fn()');
      const scope = {
        a: {
          b: 233,
          fn: function () {
            return this.b;
          }
        }
      };
      expect(fn(scope)).to.equal(233);
    });

    it('binds bare functions to the scope', function () {
      const fn = parse('fn()');
      const scope = {
        fn: function () {
          return this;
        }
      };
      expect(fn(scope)).to.equal(scope);
    });

    it('binds bare functions to the locals', function () {
      const fn = parse('fn()');
      const scope = {};
      const locals = {
        fn: function () {
          return this;
        }
      };
      expect(fn(scope, locals)).to.equal(locals);
    });
  });

  describe('Assign Values', function () {
    it('parses a simple attribute assignment', function () {
      const fn = parse('a = 233');
      const scope = {};
      fn(scope);
      expect(scope).to.have.property('a', 233);
    });

    it('can assign any primary expression', function () {
      const fn = parse('a = fn()');
      const scope = { fn: _.constant(233) };
      fn(scope);
      expect(scope).to.have.property('a', 233);
    });

    it('can assign a computed object property', function () {
      const fn = parse('obj["a"] = 233');
      const scope = { obj: {} };
      fn(scope);
      expect(scope.obj).to.have.property('a', 233);
    });

    it('can assign a non-computed object property', function () {
      const fn = parse('obj.a = 233');
      const scope = { obj: {} };
      fn(scope);
      expect(scope.obj).to.have.property('a', 233);
    });

    it('can assign a nested object property', function () {
      const fn = parse('arr[0].a = 233');
      const scope = { arr: [{}] };
      fn(scope);
      expect(scope.arr[0]).to.have.property('a', 233);
    });

    it('creates the objects in the assignment on the fly', function () {
      const fn = parse('a["b"].c.d = 233');
      const scope = {};
      fn(scope);
      expect(scope).to.have.deep.property('a.b.c.d', 233);
    });
  });

  describe('Safety in Member Access', function () {
    it('does not allow calling the function constructor ias computed property', function () {
      expect(() => {
        const fn = parse('fn["constructor"]("return window;")()');
        fn({ fn: () => {} });
      }).to.throw();
    });

    it('does not allow calling the function constructor', function () {
      expect(() => {
        const fn = parse('fn.constructor("return window;")()');
        fn({ fn: () => {} });
      }).to.throw();
    });

    it('does not allow access __proto__', function () {
      expect(() => {
        const fn = parse('obj.__proto__');
        fn({ obj: {} });
      }).to.throw();
    });

    it('does not allow calling __defineGetter__', function () {
      expect(() => {
        const fn = parse('obj.__defineGetter__("a", fn)');
        fn({ obj: {}, fn: () => {} });
      }).to.throw();
    });

    it('does not allow calling __defineSetter__', function () {
      expect(() => {
        const fn = parse('obj.__defineSetter__("a", fn)');
        fn({ obj: {}, fn: () => {} });
      }).to.throw();
    });

    it('does not allow calling __lookupGetter__', function () {
      expect(() => {
        const fn = parse('obj.__lookupGetter__("a")');
        fn({ obj: {} });
      }).to.throw();
    });

    it('does not allow calling __lookupSetter__', function () {
      expect(() => {
        const fn = parse('obj.__lookupSetter__("a")');
        fn({ obj: {} });
      }).to.throw();
    });
  });

  describe('Ensuring Safe Object', function () {
    it('does not allow accessing window as computed property', function () {
      expect(() => {
        const fn = parse('obj["wnd"]');
        fn({ obj: { wnd: window } });
      }).to.throw();
    });

    it('does not allow accessing window as non-computed property', function () {
      expect(() => {
        const fn = parse('obj.wnd');
        fn({ obj: { wnd: window } });
      }).to.throw();
    });

    it('does not allow calling methods on window', function () {
      expect(() => {
        const fn = parse('wd.scroll(0, 100)');
        fn({ wd: window });
      }).to.throw();
    });

    it('does not allow function returns window', function () {
      expect(() => {
        const fn = parse('getWd()');
        fn({ getWd: _.constant(window) });
      }).to.throw();
    });

    it('does not allow assigning window', function () {
      expect(() => {
        const fn = parse('a = wd');
        fn({ wd: window });
      }).to.throw();
    });

    it('does not allow shadow window', function () {
      expect(() => {
        const fn = parse('a = wd');
        fn({ wd: Object.create(window) });
      }).to.throw();
    });

    it('does not allow referencing window', function () {
      expect(() => {
        const fn = parse('wd');
        fn({ wd: window });
      }).to.throw();
    });

    it('does not allow call functions on DOM elements', function () {
      expect(() => {
        const fn = parse('el.setAttribute("id", "abc")');
        fn({ el: document.documentElement });
      }).to.throw();
    });

    it('does not allow calling the aliased function constructor', function () {
      expect(() => {
        const fn = parse('fnConstructor("return window;")');
        fn({ fnConstructor: (() => {}).constructor });
      }).to.throw();
    });

    it('does not allow calling function on Object', function () {
      expect(() => {
        const fn = parse('obj.create({})');
        fn({ obj: Object });
      }).to.throw();
    });
  });

  describe('Ensuring Safe Functions', function () {
    it('does not allow calling call', function () {
      expect(() => {
        const fn = parse('fn.call(obj)');
        fn({ fn: () => {}, obj: {} });
      }).to.throw();
    });

    it('does not allow calling apply', function () {
      expect(() => {
        const fn = parse('fn.apply(obj)');
        fn({ fn: () => {}, obj: {} });
      }).to.throw();
    });

    it('does not allow calling bind', function () {
      expect(() => {
        const fn = parse('fn.bind(obj)()');
        fn({ fn: () => {}, obj: {} });
      }).to.throw();
    });
  });

  describe('Operators', function () {
    it('parses a unary +', function () {
      expect(parse('+233')()).to.equal(233);
      expect(parse('+a')({ a: 233 })).to.equal(233);
    });

    it('replaces undefined with zero for unary +', function () {
      expect(parse('+a')({})).to.equal(0);
    });

    it('parses a unary !', function () {
      expect(parse('!true')()).to.be.false;
      expect(parse('!233')()).to.be.false;
      expect(parse('!a')({ a: false })).to.be.true;
      expect(parse('!!a')({ a: false })).to.be.false;
      expect(parse('!!!a')({ a: true })).to.be.false;
    });

    it('parses a unary -', function () {
      expect(parse('-233')()).to.equal(-233);
      expect(parse('-a')({ a: -233 })).to.equal(233);
      expect(parse('--a')({ a: 233 })).to.equal(233);
      expect(parse('-a')({})).to.equal(0);
    });

    it('parses a ! in string', function () {
      expect(parse('"!"')()).to.equal('!');
    });

    it('parses a multiplication', function () {
      expect(parse('333 * 3')()).to.equal(999);
    });

    it('parses a division', function () {
      expect(parse('333 / 3')()).to.equal(111);
    });

    it('parses a multiplication', function () {
      expect(parse('335 % 3')()).to.equal(2);
    });

    it('parses serveral multiplications', function () {
      expect(parse('333 * 3 / 9')()).to.equal(111);
    });

    it('parses an addition', function () {
      expect(parse('230 + 3')()).to.equal(233);
    });

    it('parses an subtraction', function () {
      expect(parse('236 - 3')()).to.equal(233);
    });

    it('parses multiplicatives on a higher precedence than additives', function () {
      expect(parse('3 + 3 * 3')()).to.equal(12);
      expect(parse('3 + 3 * 3 + 100')()).to.equal(112);
      expect(parse('3 + 3 * 3 - 100')()).to.equal(-88);
    });

    it('parses multiplicatives with unaries', function () {
      expect(parse('3 + 3 * -3')()).to.equal(-6);
      expect(parse('3 - 3 * +3')()).to.equal(-6);
    });

    it('substitutes undefined with zero in addition', function () {
      expect(parse('a + 3')()).to.equal(3);
      expect(parse('3 + a')()).to.equal(3);
    });

    it('substitutes undefined with zero in subtraction', function () {
      expect(parse('a - 3')()).to.equal(-3);
      expect(parse('3 - a')()).to.equal(3);
    });

    it('parses relational operators', function () {
      expect(parse('1 < 2')()).to.be.true;
      expect(parse('1 > 2')()).to.be.false;
      expect(parse('1 <= 2')()).to.be.true;
      expect(parse('1 >= 2')()).to.be.false;
      expect(parse('2 >= 2')()).to.be.true;
      expect(parse('2 <= 2')()).to.be.true;
    });

    it('parses equality opertors', function () {
      expect(parse('233 == 233')()).to.be.true;
      expect(parse('233 == "233"')()).to.be.true;
      expect(parse('233 != 233')()).to.be.false;
      expect(parse('233 != "233"')()).to.be.false;
      expect(parse('233 === 233')()).to.be.true;
      expect(parse('233 === "233"')()).to.be.false;
      expect(parse('233 !== 233')()).to.be.false;
    });

    it('parses relations on a higher precedence than equality', function () {
      expect(parse('2 === "2" > 2 === "2"')()).to.be.false;
    });
  });
});
