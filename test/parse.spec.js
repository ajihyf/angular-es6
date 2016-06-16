/* eslint-env mocha */
import parse from '../src/parse';
import { expect } from 'chai';

describe('Parse', function () {
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

  it('ignores whitespaces', function () {
    const fn = parse(' \r\t\v\u00A0\n233');
    expect(fn()).to.equal(233);
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
});
