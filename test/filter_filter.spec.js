/* @flow */
/* eslint-env mocha */
import { expect } from 'chai';
import parse from '../src/parse';
import { filter } from '../src/filter';
import '../src/filter_filter';

describe('filter filter', function () {
  it('is available', function () {
    expect(filter('filter')).to.exist;
  });

  it('can filter an array with predicate', function () {
    const scope = { isOdd: (n: number) => n % 2 !== 0 };
    expect(parse('[1, 2, 3, 4] | filter:isOdd')(scope)).to.deep.equal([1, 3]);
  });

  it('can filter an array of strings with a string', function () {
    const fn = parse('arr | filter:"a"');
    expect(fn({ arr: ['a', 'b', 'a'] })).to.deep.equal(['a', 'a']);
  });

  it('filters an array of strings fuzzy', function () {
    const fn = parse('arr | filter:"a"');
    expect(fn({ arr: ['aji', 'buck', 'llaji'] })).to.deep.equal(['aji', 'llaji']);
  });

  it('filters an array of strings fuzzy and ignore cases', function () {
    const fn = parse('arr | filter:"aJ"');
    expect(fn({ arr: ['aji', 'buck', 'llAji'] })).to.deep.equal(['aji', 'llAji']);
  });

  it('filters an array of object where any value matches', function () {
    const fn = parse('arr | filter:"o"');
    expect(fn({
      arr: [{ a: 'John', b: 'Brown' }, { a: 'Jane', b: 'Fox' }, { a: 'Mary', b: 'Quick' }]
    })).to.deep.equal([{ a: 'John', b: 'Brown' }, { a: 'Jane', b: 'Fox' }]);
  });

  it('filters an array of object where nest value matches', function () {
    const fn = parse('arr | filter:"o"');
    expect(fn({
      arr: [[{ a: 'John', b: 'Brown' }], [{ a: 'Jane', b: 'Fox' }], [{ a: 'Mary', b: 'Quick' }]]
    })).to.deep.equal([[{ a: 'John', b: 'Brown' }], [{ a: 'Jane', b: 'Fox' }]]);
  });

  it('filters with number value', function () {
    const fn = parse('arr | filter:233');
    expect(fn({
      arr: [{ a: 'John', b: 33 }, { a: 'Jane', b: 233 }, { a: 'Mary', b: 44 }]
    })).to.deep.equal([{ a: 'Jane', b: 233 }]);
  });

  it('filters with boolean value', function () {
    const fn = parse('arr | filter:true');
    expect(fn({
      arr: [{ a: 'John', b: false }, { a: 'Jane', b: true }, { a: 'Mary', b: true }]
    })).to.deep.equal([{ a: 'Jane', b: true }, { a: 'Mary', b: true }]);
  });

  it('filters matching null', function () {
    const fn = parse('arr | filter:null');
    expect(fn({ arr: [null, 'not null'] })).to.deep.equal([null]);
  });

  it('does not match null with the string null', function () {
    const fn = parse('arr | filter:"null"');
    expect(fn({ arr: [null, 'not null'] })).to.deep.equal(['not null']);
  });

  it('does not match undefined values', function () {
    const fn = parse('arr | filter:"undefined"');
    expect(fn({ arr: [undefined, 'undefined'] })).to.deep.equal(['undefined']);
  });

  it('allows negating string filter', function () {
    const fn = parse('arr | filter:"!o"');
    expect(fn({ arr: ['quick', 'brown', 'fox'] })).to.deep.equal(['quick']);
  });

  it('filters with an object', function () {
    const fn = parse('arr | filter:{name: "o"}');
    expect(fn({
      arr: [{ name: 'Joe', age: 10 }, { name: 'Jane', age: 13 }]
    })).to.deep.equal([{ name: 'Joe', age: 10 }]);
  });

  it('must match all criteria in an object', function () {
    const fn = parse('arr | filter:{name: "o", role: "m"}');
    expect(fn({
      arr: [{ name: 'Joe', role: 'admin' }, { name: 'Jane', role: 'contrib' }]
    })).to.deep.equal([{ name: 'Joe', role: 'admin' }]);
  });

  it('matches everything when filtered with an empty object', function () {
    const fn = parse('arr | filter:{}');
    expect(fn({
      arr: [{ name: 'Joe', role: 'admin' }, { name: 'Jane', role: 'contrib' }]
    })).to.deep.equal([{ name: 'Joe', role: 'admin' }, { name: 'Jane', role: 'contrib' }]);
  });

  it('filters with a nested object', function () {
    const fn = parse('arr | filter:{name: {first: "o"}}');
    expect(fn({
      arr: [{ name: { first: 'Joe' }, role: 'admin' },
            { name: { first: 'Jane' }, role: 'contrib' }]
    })).to.deep.equal([{ name: { first: 'Joe' }, role: 'admin' }]);
  });

  it('allows negation when filtering a nested object', function () {
    const fn = parse('arr | filter:{name: {first: "!o"}}');
    expect(fn({
      arr: [{ name: { first: 'Joe' }, role: 'admin' },
            { name: { first: 'Jane' }, role: 'contrib' }]
    })).to.deep.equal([{ name: { first: 'Jane' }, role: 'contrib' }]);
  });

  it('ignores undefined values in expectation object', function () {
    const fn = parse('arr | filter:{name: undefinedValue}');
    expect(fn({
      arr: [{ name: 'Joe', role: 'admin' }, { name: 'Jane', role: 'contrib' }]
    })).to.deep.equal([{ name: 'Joe', role: 'admin' }, { name: 'Jane', role: 'contrib' }]);
  });

  it('filters with a nested object in an array', function () {
    const fn = parse('arr | filter:{users: {name: {first: "o"}}}');
    expect(fn({
      arr: [{ users: [{ name: { first: 'Joe' }, role: 'admin' }, { name: { first: 'Jane' }, role: 'contrib' }] },
            { users: [{ name: { first: 'Mary' }, role: 'admin' }] }]
    })).to.deep.equal([{ users: [{ name: { first: 'Joe' }, role: 'admin' }, { name: { first: 'Jane' }, role: 'contrib' }] }]);
  });

  it('filters with nested objects only on the same level', function () {
    const fn = parse('arr | filter:{user: {name: "Bob"}}');
    expect(fn({
      arr: [{ user: 'Bob' }, { user: { name: 'Bob' } }, { user: { name: { first: 'Bob' } } }]
    })).to.deep.equal([{ user: { name: 'Bob' } }]);
  });

  it('filters with a wildcard property', function () {
    const fn = parse('arr | filter:{$: "o"}');
    expect(fn({
      arr: [{ name: 'Joe', role: 'admin' },
            { name: 'Jane', role: 'contrib' },
            { name: 'Mary', role: 'admin' }]
    })).to.deep.equal([{ name: 'Joe', role: 'admin' }, { name: 'Jane', role: 'contrib' }]);
  });

  it('filters wildcard properties scoped to parent', function () {
    const fn = parse('arr | filter:{name: {$: "o"}}');
    expect(fn({arr: [
      {name: {first: 'Joe', last: 'Fox'}, role: 'admin'},
      {name: {first: 'Jane', last: 'Quick'}, role: 'moderator'},
      {name: {first: 'Mary', last: 'Brown'}, role: 'admin'}
    ]})).to.deep.equal([
      {name: {first: 'Joe', last: 'Fox'}, role: 'admin'},
      {name: {first: 'Mary', last: 'Brown'}, role: 'admin'}
    ]);
  });

  it('filters primitives with a wildcard property', function () {
    const fn = parse('arr | filter:{$: "o"}');
    expect(fn({arr: ['Joe', 'Jane', 'Mary']})).to.deep.equal(['Joe']);
  });

  it('filters with a nested wildcard property', function () {
    const fn = parse('arr | filter:{$: {$: "o"}}');
    expect(fn({arr: [
      { name: { first: 'Joe' }, role: 'admin' },
      { name: { first: 'Jane' }, role: 'moderator' },
      { name: { first: 'Mary' }, role: 'admin' }
    ]})).to.deep.equal([
      {name: {first: 'Joe'}, role: 'admin'}
    ]);
  });

  it('allows using a custom comparator', function () {
    var fn = parse('arr | filter:{$: "o"}:myComparator');
    expect(fn({
      arr: ['o', 'oo', 'ao', 'aa'],
      myComparator: (left, right) => left === right
    })).to.deep.equal(['o']);
  });

  it('allows using an equality comparator', function () {
    const fn = parse('arr | filter:{name: "Jo"}:true');
    expect(fn({
      arr: [{ name: 'Jo' }, { name: 'Joe' }]
    })).to.deep.equal([{ name: 'Jo' }]);
  });
});
