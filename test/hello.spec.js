/* eslint-env mocha,chai */
import hello from '../src/hello'
import {expect} from 'chai'

describe('Hello', function () {
  it('says hello word', function () {
    expect(hello()).to.be.equal('Hello world')
  })
})
