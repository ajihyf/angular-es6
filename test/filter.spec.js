/* @flow */
/* eslint-env mocha */
import { expect } from 'chai';
import { register, filter } from '../src/filter';

describe('filter', function () {
  it('can be registered and obtained', function () {
    const myFilter = () => {};
    const myFilterFactory = () => myFilter;
    register('my', myFilterFactory);
    expect(filter('my')).to.equal(myFilter);
  });

  it('allows registering multiple filters with an object', function () {
    const filter1 = () => {};
    const filter2 = () => {};
    register({ oneFilter: () => filter1, anotherFilter: () => filter2 });
    expect(filter('oneFilter')).to.equal(filter1);
    expect(filter('anotherFilter')).to.equal(filter2);
  });
});
