/* eslint-env mocha */
import parse from '../src/parse';
import { expect } from 'chai';
import sinon from 'sinon';
import _ from 'lodash';

describe('parse', function () {
  it('can parse an integer', function () {
    const fn = parse('233');
    expect(fn).to.be.a('function');
    expect(fn()).to.equal(233);
  });
});
