/* @flow */
/* eslint-env mocha */
import Scope from '../src/scope';
import { expect } from 'chai';
import sinon from 'sinon';
import _ from 'lodash';

describe('Scope', function () {
  let scope: Scope;

  beforeEach(function () {
    scope = new Scope();
  });

  it('can be constructed and used as an object', function () {
    (scope: any).someProperty = 1;
    expect((scope: any).someProperty).to.equal(1);
  });

  describe('#_watch', function () {
    it('calls the listener function of a watch on first _digest', function () {
      const watchFn = () => 'wat';
      const listenerFn = sinon.spy();
      scope._watch(watchFn, listenerFn);

      scope._digest();

      expect(listenerFn).to.have.been.called;
    });

    it('calls the watch function with the scope as first argument', function () {
      const watchFn = sinon.spy();
      const listenerFn = () => {};
      scope._watch(watchFn, listenerFn);

      scope._digest();

      expect(watchFn).to.have.been.calledWith(scope);
    });

    it('calls the listener function when the watched value changes', function () {
      (scope: any).someValue = 'a';
      const listenerFn = sinon.spy();

      scope._watch(
        scope => (scope: any).someValue,
        listenerFn
      );

      expect(listenerFn).to.have.not.been.called;

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;

      (scope: any).someValue = 'aji';
      expect(listenerFn).to.have.been.calledOnce;

      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('calls listener when watch value is first undefined', function () {
      const listenerFn = sinon.spy();

      scope._watch(
        scope => (scope: any).someValue,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('calls listener with new value as old value the first time', function () {
      (scope: any).someValue = 233;
      let oldValueGiven;

      scope._watch(
        scope => (scope: any).someValue,
        (newValue, oldValue, scope) => { oldValueGiven = oldValue; }
      );

      scope._digest();
      expect(oldValueGiven).to.equal(233);
    });

    it('may have watcher that omit listener', function () {
      const watchFn = sinon.stub().returns('hello');
      scope._watch(watchFn);

      scope._digest();
      expect(watchFn).to.have.been.called;
    });

    it('triggers chained watchers in the same digest', function () {
      (scope: any).name = 'Keal';

      scope._watch(
        scope => (scope: any).nameUpper,
        (newValue, oldValue, scope) => {
          if (newValue) {
            (scope: any).initial = newValue[0] + '@@';
          }
        }
      );

      scope._watch(
        scope => (scope: any).name,
        (newValue, oldValue, scope) => {
          if (newValue) {
            (scope: any).nameUpper = newValue.toUpperCase();
          }
        }
      );

      scope._digest();
      expect((scope: any).initial).to.equal('K@@');

      (scope: any).name = 'Aji';
      scope._digest();
      expect((scope: any).initial).to.equal('A@@');
    });

    it('ends the digest when the last watch is clean', function () {
      (scope: any).arr = _.range(100);
      let executedNum = 0;

      _.times(100, function (i) {
        scope._watch(
          scope => {
            executedNum++;
            return (scope: any).arr[i];
          }
        );
      });

      scope._digest();
      expect(executedNum).to.equal(200);

      (scope: any).arr[0] = 233;
      scope._digest();
      expect(executedNum).to.equal(301);
    });

    it('does not end digest so that new watches are not run', function () {
      (scope: any).someValue = 'hello';
      const listenerFn = sinon.spy();

      scope._watch(
        scope => (scope: any).someValue,
        (newValue, oldValue, scope) => {
          scope._watch(
            scope => (scope: any).someValue,
            listenerFn
          );
        }
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('compare based on value if enabled', function () {
      (scope: any).arr = _.range(3);
      const listenerFn = sinon.spy();

      scope._watch(
        scope => (scope: any).arr,
        listenerFn,
        true
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;

      (scope: any).arr.push(3);
      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('handles NaN correctly', function () {
      (scope: any).number = 0 / 0;
      const listenerFn = sinon.spy();

      scope._watch(
        scope => (scope: any).number,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('returns a function to destroy watch', function () {
      (scope: any).someValue = 233;
      const listenerFn = sinon.spy();

      const destroyWatch = scope._watch(
        scope => (scope: any).someValue,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;

      (scope: any).someValue = 256;
      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;

      (scope: any).someValue = 512;
      destroyWatch();
      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('allows destroying a _watch during digest', function () {
      (scope: any).someValue = 233;
      const watchSpy = [];

      scope._watch(
        scope => {
          watchSpy.push(0);
          return (scope: any).someValue;
        }
      );

      const destroyWatch = scope._watch(
        () => {
          watchSpy.push(1);
          destroyWatch();
        }
      );

      scope._watch(
        scope => {
          watchSpy.push(2);
          return (scope: any).someValue;
        }
      );

      scope._digest();
      expect(watchSpy).to.deep.equal([0, 1, 2, 0, 2]);
    });

    it('allows a _watch to destroy another during digest', function () {
      (scope: any).someValue = 233;
      const listenerFn = sinon.spy();
      let destroyWatch;

      scope._watch(
        scope => (scope: any).someValue,
        () => { destroyWatch(); }
      );

      destroyWatch = scope._watch(
        () => {},
        () => {}
      );

      scope._watch(
        scope => (scope: any).someValue,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('allows destroying multiple __watches during digest', function () {
      (scope: any).someValue = 233;
      const listenerFn = sinon.spy();
      let destroyWatch1, destroyWatch2;

      destroyWatch1 = scope._watch(
        () => {
          destroyWatch1();
          destroyWatch2();
        }
      );

      destroyWatch2 = scope._watch(
        scope => (scope: any).someValue,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.not.been.called;
    });
  });

  describe('#_eval', function () {
    it('executes _eval function and returns result', function () {
      (scope: any).someValue = 233;

      const result = scope._eval(scope => (scope: any).someValue);

      expect(result).to.equal(233);
    });

    it('passes the second function argument', function () {
      (scope: any).someValue = 233;

      const result = scope._eval((scope, arg) => (scope: any).someValue + arg, 2);

      expect(result).to.equal(235);
    });
  });

  describe('#_apply', function () {
    it('executes _apply function and starts digest', function () {
      (scope: any).someValue = 233;
      const listenerFn = sinon.spy();

      scope._watch(
        scope => (scope: any).someValue,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;

      scope._apply(scope => { (scope: any).someValue = 235; });
      expect(listenerFn).to.have.been.calledTwice;
    });
  });

  describe('#_evalAsync', function () {
    it('executes _evalAsync function later in the same cycle', function () {
      (scope: any).someValue = 233;
      (scope: any).asyncEvaluated = false;
      (scope: any).asyncEvaluatedImmediately = false;

      scope._watch(
        scope => (scope: any).someValue,
        (newValue, oldValue, scope) => {
          scope._evalAsync(scope => { (scope: any).asyncEvaluated = true; });
          (scope: any).asyncEvaluatedImmediately = (scope: any).asyncEvaluated;
        }
      );

      scope._digest();
      expect((scope: any).asyncEvaluated).to.be.true;
      expect((scope: any).asyncEvaluatedImmediately).to.be.false;
    });

    it('executes _evalAsync function added by watch function', function () {
      (scope: any).someValue = 233;
      (scope: any).asyncEvaluated = false;

      scope._watch(
        scope => {
          if (!(scope: any).asyncEvaluated) {
            scope._evalAsync(scope => { (scope: any).asyncEvaluated = true; });
          }
          return (scope: any).someValue;
        }
      );

      scope._digest();
      expect((scope: any).asyncEvaluated).to.be.true;
    });

    it('executes _evalAsync function even when not dirty', function () {
      (scope: any).someValue = 233;
      (scope: any).asyncEvaluatedTime = 0;

      scope._watch(
        scope => {
          if ((scope: any).asyncEvaluatedTime < 2) {
            scope._evalAsync(scope => { (scope: any).asyncEvaluatedTime++; });
          }
          return (scope: any).someValue;
        }
      );

      scope._digest();
      expect((scope: any).asyncEvaluatedTime).to.equal(2);
    });

    it('throws error when halted by __evalAsyncs added by watch', function () {
      scope._watch(
        scope => {
          scope._evalAsync(() => {});
          return (scope: any).someValue;
        }
      );

      expect(() => { scope._digest(); }).to.throw();
    });

    it('schedules a digest in _evalAsync', function (done) {
      (scope: any).someValue = 233;
      const listernerFn = sinon.spy();

      scope._watch(
        scope => (scope: any).someValue,
        listernerFn
      );

      scope._evalAsync(() => {});
      expect(listernerFn).to.have.not.been.called;
      setTimeout(function () {
        expect(listernerFn).to.have.been.calledOnce;
        done();
      }, 10);
    });
  });

  describe('#_applyAsync', function () {
    it('apply function asynchronously', function (done) {
      const listenerFn = sinon.spy();

      scope._watch(
        scope => (scope: any).someValue,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;

      scope._applyAsync(scope => { (scope: any).someValue = 233; });
      expect(listenerFn).to.have.been.calledOnce;

      setTimeout(() => {
        expect(listenerFn).to.have.been.calledTwice;
        done();
      }, 10);
    });

    it('does not execute _applyAsync\'ed function in the same cycle', function (done) {
      (scope: any).someValue = 233;
      const asyncAppliedFn = sinon.spy();

      scope._watch(
        scope => (scope: any).someValue,
        (newValue, oldValue, scope) => {
          scope._applyAsync(asyncAppliedFn);
        }
      );

      scope._digest();
      expect(asyncAppliedFn).to.have.not.been.called;
      setTimeout(() => {
        expect(asyncAppliedFn).to.have.been.calledOnce;
        done();
      }, 10);
    });

    it('coalesces many calls to _applyAsync', function (done) {
      const watcherFn = sinon.spy(scope => (scope: any).someValue);

      scope._watch(
        watcherFn
      );

      scope._applyAsync(scope => { (scope: any).someValue = 233; });
      scope._applyAsync(scope => { (scope: any).someValue = 256; });

      setTimeout(() => {
        expect(watcherFn).to.have.been.calledTwice;
        done();
      }, 10);
    });

    it('cancels and flushes _applyAsync if digest', function (done) {
      const watcherFn = sinon.spy(scope => (scope: any).someValue);

      scope._watch(
        watcherFn
      );

      scope._applyAsync(scope => { (scope: any).someValue = 233; });
      scope._applyAsync(scope => { (scope: any).someValue = 256; });

      scope._digest();
      expect(watcherFn).to.have.been.calledTwice;
      expect((scope: any).someValue).to.equal(256);

      setTimeout(() => {
        expect(watcherFn).to.have.been.calledTwice;
        done();
      }, 50);
    });
  });

  describe('#__phase', function () {
    it('has a __phase as the current digest phase', function () {
      (scope: any).someValue = 233;
      let phaseInWatch, phaseInListener, phaseInApply;

      scope._watch(
        scope => {
          phaseInWatch = scope.__phase;
          return (scope: any).someValue;
        },
        (newValue, oldValue, scope) => {
          phaseInListener = scope.__phase;
        }
      );

      scope._apply(scope => {
        phaseInApply = scope.__phase;
      });

      expect(phaseInWatch).to.equal('_digest');
      expect(phaseInListener).to.equal('_digest');
      expect(phaseInApply).to.equal('_apply');
    });
  });

  describe('#__postDigest', function () {
    it('runs a __postDigest function after each digest', function () {
      const postDigestFn = sinon.spy();

      scope.__postDigest(postDigestFn);

      expect(postDigestFn).to.have.not.been.called;

      scope._digest();
      expect(postDigestFn).to.have.been.calledOnce;

      scope._digest();
      expect(postDigestFn).to.have.been.calledOnce;
    });

    it('does not include __postDigest in a digest', function () {
      (scope: any).someValue = 233;

      scope.__postDigest(() => { (scope: any).someValue = 256; });

      scope._watch(
        scope => (scope: any).someValue,
        (newValue, oldValue, scope) => { (scope: any).watchedValue = newValue; }
      );

      scope._digest();
      expect((scope: any).watchedValue).to.equal(233);

      scope._digest();
      expect((scope: any).watchedValue).to.equal(256);
    });
  });

  describe('#_watchGroup', function () {
    it('takes watches as an array and calls listener with arrays', function () {
      (scope: any).someValue = 0;
      (scope: any).anotherValue = 1;

      scope._watchGroup([
        scope => (scope: any).someValue,
        scope => (scope: any).anotherValue
      ], (newValues, oldValues, scope) => {
        (scope: any).gotNewValues = newValues;
        (scope: any).gotOldValues = oldValues;
      });

      scope._digest();
      expect((scope: any).gotOldValues).to.deep.equal([0, 1]);
      expect((scope: any).gotOldValues).to.deep.equal([0, 1]);
    });

    it('only calls listener once per digest', function () {
      const listenerFn = sinon.spy();
      (scope: any).someValue = 0;
      (scope: any).anotherValue = 1;

      scope._watchGroup([
        scope => (scope: any).someValue,
        scope => (scope: any).anotherValue
      ], listenerFn);

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('uses the same array of old and new values when first run', function () {
      (scope: any).someValue = 0;
      (scope: any).anotherValue = 1;

      scope._watchGroup([
        scope => (scope: any).someValue,
        scope => (scope: any).anotherValue
      ], (newValues, oldValues, scope) => {
        (scope: any).gotOldValues = oldValues;
        (scope: any).gotNewValues = newValues;
      });

      scope._digest();
      expect((scope: any).gotOldValues).to.equal((scope: any).gotNewValues);
    });

    it('uses different arrays of old and new values for subsequent runs', function () {
      (scope: any).someValue = 0;
      (scope: any).anotherValue = 1;

      scope._watchGroup([
        scope => (scope: any).someValue,
        scope => (scope: any).anotherValue
      ], (newValues, oldValues, scope) => {
        (scope: any).gotOldValues = oldValues;
        (scope: any).gotNewValues = newValues;
      });

      scope._digest();
      expect((scope: any).gotOldValues).to.deep.equal([0, 1]);

      (scope: any).anotherValue = 2;
      scope._digest();
      expect((scope: any).gotOldValues).to.deep.equal([0, 1]);
      expect((scope: any).gotNewValues).to.deep.equal([0, 2]);
    });

    it('calls the listener once when the watch array is empty', function () {
      (scope: any).someValue = 0;
      (scope: any).anotherValue = 1;

      scope._watchGroup([], (newValues, oldValues, scope) => {
        (scope: any).gotOldValues = oldValues;
        (scope: any).gotNewValues = newValues;
      });

      scope._digest();
      expect((scope: any).gotOldValues).to.be.an('array').and.empty;
      expect((scope: any).gotNewValues).to.be.an('array').and.empty;
    });

    it('can be deregistered', function () {
      (scope: any).someValue = 0;
      (scope: any).anotherValue = 1;
      const listenerFn = sinon.spy();

      const destroyGroup = scope._watchGroup([
        scope => (scope: any).someValue,
        scope => (scope: any).anotherValue
      ], listenerFn);

      scope._digest();
      (scope: any).anotherValue = 2;
      destroyGroup();
      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('does not call the zero-watch listener when deregistered first', function () {
      const listenerFn = sinon.spy();

      const destroyGroup = scope._watchGroup([], listenerFn);

      destroyGroup();
      scope._digest();

      expect(listenerFn).to.have.not.been.called;
    });
  });

  describe('#_watchCollection', function () {
    it('works like a normal watch for non-colletions', function () {
      (scope: any).someValue = 233;
      let value;
      const listenerFn = sinon.spy((newValue, oldValue, scope) => { value = oldValue; });

      scope._watchCollection(
        scope => (scope: any).someValue,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;
      expect(value).to.equal(233);

      (scope: any).someValue = 256;
      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;

      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('correctly handles NaNs', function () {
      (scope: any).someValue = 0 / 0;
      const listenerFn = sinon.spy();

      scope._watchCollection(
        scope => (scope: any).someValue,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('notices when the value becomes an array', function () {
      const listenerFn = sinon.spy();

      scope._watchCollection(
        scope => (scope: any).arr,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;

      (scope: any).arr = [0, 1];
      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;

      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('detects new items in an array', function () {
      (scope: any).arr = [0, 1, 2];
      const listenerFn = sinon.spy();

      scope._watchCollection(
        scope => (scope: any).arr,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;

      (scope: any).arr.push(3);
      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;

      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('detects items removed in an array', function () {
      (scope: any).arr = [0, 1, 2];
      const listenerFn = sinon.spy();

      scope._watchCollection(
        scope => (scope: any).arr,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;

      (scope: any).arr.shift();
      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;

      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('detects an item replaced in an array', function () {
      (scope: any).arr = [0, 1, 2];
      const listenerFn = sinon.spy();

      scope._watchCollection(
        scope => (scope: any).arr,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;

      (scope: any).arr[1] = 10;
      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;

      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('detects items reordered in an array', function () {
      (scope: any).arr = [3, 1, 2];
      const listenerFn = sinon.spy();

      scope._watchCollection(
        scope => (scope: any).arr,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;

      (scope: any).arr.sort();
      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;

      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('correctly handles NaNs in an array', function () {
      (scope: any).arr = [0, Number.NaN, 2, Number.NaN];
      const listenerFn = sinon.spy();

      scope._watchCollection(
        scope => (scope: any).arr,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('detects an item replaced in an argument object', function () {
      (function () {
        (scope: any).arrLike = arguments;
      })(0, 1, 2);
      const listenerFn = sinon.spy();

      scope._watchCollection(
        scope => (scope: any).arrLike,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;

      (scope: any).arrLike[1] = 233;
      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;

      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('detects an item replaced in a NodeList object', function () {
      document.documentElement.appendChild(document.createElement('div'));
      (scope: any).arrLike = document.getElementsByTagName('div');
      const listenerFn = sinon.spy();

      scope._watchCollection(
        scope => (scope: any).arrLike,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;

      document.documentElement.appendChild(document.createElement('div'));
      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;

      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('notices when the value becomes an object', function () {
      const listenerFn = sinon.spy();

      scope._watchCollection(
        scope => (scope: any).obj,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;

      (scope: any).obj = { a: 1 };
      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;

      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('detects when an attribute is added to an object', function () {
      (scope: any).obj = { a: 1 };
      const listenerFn = sinon.spy();

      scope._watchCollection(
        scope => (scope: any).obj,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;

      (scope: any).obj.b = 2;
      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;

      scope._digest();
    });

    it('detects when an attribute is changed in an object', function () {
      (scope: any).obj = { a: 1 };
      const listenerFn = sinon.spy();

      scope._watchCollection(
        scope => (scope: any).obj,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;

      (scope: any).obj.a = 2;
      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;

      scope._digest();
    });

    it('detects when an attribute is deleted to an object', function () {
      (scope: any).obj = { a: 1 };
      const listenerFn = sinon.spy();

      scope._watchCollection(
        scope => (scope: any).obj,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;

      delete (scope: any).obj.a;
      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('correctly handles NaNs in an object', function () {
      (scope: any).obj = { a: Number.NaN };
      const listenerFn = sinon.spy();

      scope._watchCollection(
        scope => (scope: any).obj,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('does not consider object with length property as an array', function () {
      (scope: any).obj = { length: 233, someKey: 1 };
      const listenerFn = sinon.spy();

      scope._watchCollection(
        scope => (scope: any).obj,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;

      (scope: any).obj.otherKey = 256;
      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('get newValue and oldValue in listenerFn', function () {
      (scope: any).arr = [0, 1, 2];
      let gotNewValue;
      let gotOldValue;

      scope._watchCollection(
        scope => (scope: any).arr,
        (newValue, oldValue) => {
          gotNewValue = newValue;
          gotOldValue = oldValue;
        }
      );

      scope._digest();
      expect(gotNewValue).to.deep.equal([0, 1, 2]);
      expect(gotOldValue).to.deep.equal([0, 1, 2]);

      (scope: any).arr.push(3);
      scope._digest();
      expect(gotNewValue).to.deep.equal([0, 1, 2, 3]);
      expect(gotOldValue).to.deep.equal([0, 1, 2]);
    });
  });

  describe('Events', function () {
    let child, isolatedChild;

    beforeEach(() => {
      child = scope._new();
      isolatedChild = scope._new(true);
    });

    it('allows registering listeners', function () {
      const listener1 = () => {};
      const listener2 = () => {};
      const listener3 = () => {};

      scope._on('aEvent', listener1);
      scope._on('aEvent', listener2);
      scope._on('bEvent', listener3);

      expect(scope.__listeners).to.deep.equal({
        aEvent: [listener1, listener2],
        bEvent: [listener3]
      });
    });

    it('registers different listeners for every scope', function () {
      const listener1 = () => {};
      const listener2 = () => {};
      const listener3 = () => {};

      scope._on('aEvent', listener1);
      child._on('aEvent', listener2);
      isolatedChild._on('aEvent', listener3);

      expect(scope.__listeners).to.deep.equal({ aEvent: [listener1] });
      expect(child.__listeners).to.deep.equal({ aEvent: [listener2] });
      expect(isolatedChild.__listeners).to.deep.equal({ aEvent: [listener3] });
    });

    _.each(['_emit', '_broadcast'], method => {
      it(`calls the listeners of the matching event on ${method}`, function () {
        const listener1 = sinon.spy();
        const listener2 = sinon.spy();
        const listener3 = sinon.spy();

        scope._on('aEvent', listener1);
        scope._on('aEvent', listener2);
        scope._on('bEvent', listener3);

        (scope: any)[method]('aEvent');
        expect(listener1).to.have.been.calledOnce;
        expect(listener2).to.have.been.calledOnce;
        expect(listener3).to.have.not.been.called;
      });

      it(`passes an event object with a name to listener on ${method}`, function () {
        const listener = sinon.spy();
        scope._on('aEvent', listener);

        (scope: any)[method]('aEvent');
        expect(listener).to.have.been.calledOnce;
        expect(listener.lastCall.args[0].name).to.equal('aEvent');
      });

      it(`passes the same event object to each listener on ${method}`, function () {
        const listener1 = sinon.spy();
        const listener2 = sinon.spy();

        scope._on('aEvent', listener1);
        scope._on('aEvent', listener2);

        (scope: any)[method]('aEvent');
        expect(listener1.lastCall.args[0]).to.equal(listener2.lastCall.args[0]);
      });

      it(`passes additional arguments to listeners on ${method}`, function () {
        const listener = sinon.spy();
        scope._on('aEvent', listener);

        (scope: any)[method]('aEvent', 'some', ['additional', 'arguments'], '...');

        expect(listener.lastCall.args[1]).to.deep.equal('some');
        expect(listener.lastCall.args[2]).to.deep.equal(['additional', 'arguments']);
        expect(listener.lastCall.args[3]).to.deep.equal('...');
      });

      it(`returns the event object on ${method}`, function () {
        const returnedEvent = (scope: any)[method]('aEvent');

        expect(returnedEvent).to.be.an('object').and.have.property('name', 'aEvent');
      });

      it(`can be deregistered ${method}`, function () {
        const listener = sinon.spy();
        const deregister = scope._on('aEvent', listener);

        deregister();
        (scope: any)[method]('aEvent');

        expect(listener).have.not.been.called;
      });

      it(`does not skip the next listener when removed on ${method}`, function () {
        const listener = () => {
          deregister();
        };
        const nextListener = sinon.spy();
        const deregister = scope._on('aEvent', listener);
        scope._on('aEvent', nextListener);

        (scope: any)[method]('aEvent');
        expect(nextListener).to.have.been.calledOnce;
      });

      it(`sets defaultPrevented when preventDefault called on ${method}`, function () {
        scope._on('aEvent', event => { event.preventDefault(); });

        const event = (scope: any)[method]('aEvent');

        expect(event).to.have.property('defaultPrevented', true);
      });

      it(`does not stop on exceptions on ${method}`, function () {
        const listener = sinon.spy();
        scope._on('aEvent', () => { throw new Error('error'); });
        scope._on('aEvent', listener);

        (scope: any)[method]('aEvent');
        expect(listener).to.have.been.calledOnce;
      });
    });

    it('propagates up the scope hierarchy on _emit', function () {
      const scopeListener = sinon.spy();
      const childListener = sinon.spy();

      scope._on('aEvent', scopeListener);
      child._on('aEvent', childListener);

      child._emit('aEvent');
      expect(scopeListener).to.have.been.calledOnce;
      expect(childListener).to.have.been.calledOnce;
    });

    it('propagates the same event up on _emit', function () {
      const scopeListener = sinon.spy();
      const childListener = sinon.spy();

      scope._on('aEvent', scopeListener);
      child._on('aEvent', childListener);

      child._emit('aEvent');
      expect(scopeListener.lastCall.args[0]).to.equal(childListener.lastCall.args[0]);
    });

    it('propagates down the scope hierarchy on _broadcast', function () {
      const scopeListener = sinon.spy();
      const childListener = sinon.spy();
      const isolatedChildListener = sinon.spy();

      scope._on('aEvent', scopeListener);
      child._on('aEvent', childListener);
      isolatedChild._on('aEvent', isolatedChildListener);

      scope._broadcast('aEvent');
      expect(scopeListener).to.have.been.calledOnce;
      expect(childListener).to.have.been.calledOnce;
      expect(isolatedChildListener).to.have.been.calledOnce;
    });

    it('propagates the same event down on _broadcast', function () {
      const scopeListener = sinon.spy();
      const childListener = sinon.spy();
      const isolatedChildListener = sinon.spy();

      scope._on('aEvent', scopeListener);
      child._on('aEvent', childListener);
      isolatedChild._on('aEvent', isolatedChildListener);

      scope._broadcast('aEvent');
      expect(scopeListener.lastCall.args[0]).to.equal(childListener.lastCall.args[0]);
      expect(scopeListener.lastCall.args[0]).to.equal(isolatedChildListener.lastCall.args[0]);
    });

    it('attaches targetScope on _emit', function () {
      const scopeListener = sinon.spy();
      const childListener = sinon.spy();

      scope._on('aEvent', scopeListener);
      child._on('aEvent', childListener);

      child._emit('aEvent');
      expect(scopeListener.lastCall.args[0]).to.have.property('targetScope', child);
      expect(childListener.lastCall.args[0]).to.have.property('targetScope', child);
    });

    it('attaches targetScope on _broadcast', function () {
      const scopeListener = sinon.spy();
      const childListener = sinon.spy();

      scope._on('aEvent', scopeListener);
      child._on('aEvent', childListener);

      scope._broadcast('aEvent');
      expect(scopeListener.lastCall.args[0]).to.have.property('targetScope', scope);
      expect(childListener.lastCall.args[0]).to.have.property('targetScope', scope);
    });

    it('attaches currentScope on _emit', function () {
      let currentScopeOnScope;
      let currentScopeOnChild;
      scope._on('aEvent', (event) => { currentScopeOnScope = event.currentScope; });
      child._on('aEvent', (event) => { currentScopeOnChild = event.currentScope; });

      child._emit('aEvent');
      expect(currentScopeOnChild).to.equal(child);
      expect(currentScopeOnScope).to.equal(scope);
    });

    it('attaches currentScope on _broadcast', function () {
      let currentScopeOnScope;
      let currentScopeOnChild;
      scope._on('aEvent', event => { currentScopeOnScope = event.currentScope; });
      child._on('aEvent', event => { currentScopeOnChild = event.currentScope; });

      scope._broadcast('aEvent');
      expect(currentScopeOnChild).to.equal(child);
      expect(currentScopeOnScope).to.equal(scope);
    });

    it('sets currentScope to null after propagation on _emit', function () {
      scope._on('aEvent', () => {});

      const event = scope._emit('aEvent');
      expect(event.currentScope).to.be.null;
    });

    it('sets currentScope to null after propagation on _broadcast', function () {
      scope._on('aEvent', () => {});

      const event = scope._broadcast('aEvent');
      expect(event.currentScope).to.be.null;
    });

    it('does not propagate to parents when stopped', function () {
      const scopeListener = sinon.spy();

      child._on('aEvent', event => { event.stopPropagation && event.stopPropagation(); });
      scope._on('aEvent', scopeListener);

      child._emit('aEvent');
      expect(scopeListener).to.have.not.been.called;
    });

    it('fires _destroy when destroyed', function () {
      const listener = sinon.spy();
      scope._on('_destroy', listener);

      scope._destroy();
      expect(listener).to.have.been.calledOnce;
    });

    it('broadcast _destroy to children when destroyed', function () {
      const listener = sinon.spy();
      child._on('_destroy', listener);

      scope._destroy();
      expect(listener).to.have.been.calledOnce;
    });

    it('does not call listeners after destroyed', function () {
      const listener = sinon.spy();
      scope._on('aEvent', listener);

      scope._destroy();
      scope._emit('aEvent');
      expect(listener).to.have.not.been.called;
    });
  });

  describe('errorHandling', function () {
    it('catches exceptions in watch functions', function () {
      (scope: any).someValue = 233;
      const listenerFn = sinon.spy();

      scope._watch(
        () => { throw new Error('error'); }
      );

      scope._watch(
        scope => (scope: any).someValue,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('catches exceptions in listener functions', function () {
      (scope: any).someValue = 233;
      const listenerFn = sinon.spy();

      scope._watch(
        scope => (scope: any).someValue,
        () => { throw new Error('error'); }
      );

      scope._watch(
        scope => (scope: any).someValue,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('catches exceptions in _evalAsync', function (done) {
      (scope: any).someValue = 233;
      const listenerFn = sinon.spy();

      scope._watch(
        scope => (scope: any).someValue,
        listenerFn
      );

      scope._evalAsync(() => {
        throw new Error('error');
      });

      setTimeout(() => {
        expect(listenerFn).to.have.been.calledOnce;
        done();
      }, 10);
    });

    it('catches exceptions in _applyAsync', function (done) {
      const appliedFn = sinon.spy();

      scope._applyAsync(() => {
        throw new Error('error');
      });

      scope._applyAsync(() => {
        throw new Error('error');
      });

      scope._applyAsync(appliedFn);

      setTimeout(() => {
        expect(appliedFn).to.have.been.calledOnce;
        done();
      }, 10);
    });

    it('catches exceptions in __postDigest', function () {
      const postDigestFn = sinon.spy();

      scope.__postDigest(() => {
        throw new Error('error');
      });

      scope.__postDigest(postDigestFn);

      scope._digest();
      expect(postDigestFn).to.have.been.calledOnce;
    });
  });

  describe('inheritance', function () {
    it('inherits the parent\'s properties', function () {
      (scope: any).someValue = 233;
      const child = scope._new();

      expect((child: any).someValue).to.equal(233);
    });

    it('does not cause a parent to inherit its properties', function () {
      const child = scope._new();

      (child: any).someValue = 233;
      expect((scope: any).someValue).to.be.undefined;
    });

    it('inherits the parent\'s value whenever the are defined', function () {
      const child = scope._new();
      (scope: any).someValue = 233;

      expect((child: any).someValue).to.equal(233);
    });

    it('can manipulate parent\'s properties', function () {
      const child = scope._new();
      (scope: any).arr = [0, 1, 2];

      (child: any).arr.push(3);
      expect((child: any).arr).to.deep.equal([0, 1, 2, 3]);
      expect((scope: any).arr).to.deep.equal([0, 1, 2, 3]);
    });

    it('can watch a property in parent', function () {
      const child = scope._new();
      const listenerFn = sinon.spy();
      (scope: any).arr = [0, 1, 2];

      child._watch(
        scope => (scope: any).arr,
        listenerFn,
        true
      );

      child._digest();
      expect(listenerFn).to.have.been.calledOnce;

      (scope: any).arr.push(3);
      child._digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('can be nested at any depth', function () {
      const c1 = scope._new();
      const c2 = scope._new();
      const c1c1 = c1._new();
      const c1c2 = c1._new();
      const c2c1 = c2._new();

      (scope: any).someValue = 233;
      expect((c1: any).someValue).to.equal(233);
      expect((c2: any).someValue).to.equal(233);
      expect((c1c1: any).someValue).to.equal(233);
      expect((c1c2: any).someValue).to.equal(233);
      expect((c2c1: any).someValue).to.equal(233);

      (c2: any).anotherValue = 256;
      expect((c2c1: any).anotherValue).to.equal(256);
      expect((c1: any).anotherValue).to.be.undefined;
      expect((c1c1: any).anotherValue).to.be.undefined;
      expect((c1c2: any).anotherValue).to.be.undefined;
    });

    it('shadows parent\'s property with the same name', function () {
      const child = scope._new();

      (scope: any).someValue = 233;
      (child: any).someValue = 256;

      expect((scope: any).someValue).to.equal(233);
      expect((child: any).someValue).to.equal(256);
    });

    it('does not deeply shadow parents\'s properties', function () {
      const child = scope._new();

      (scope: any).user = { name: 'Aji' };
      (child: any).user.name = 'Keal';

      expect((child: any).user.name).to.equal('Keal');
      expect((scope: any).user.name).to.equal('Keal');
    });

    it('does not digest its parent', function () {
      const child = scope._new();
      const listenerFn = sinon.spy();

      (scope: any).someValue = 233;
      scope._watch(
        scope => (scope: any).someValue,
        listenerFn
      );

      child._digest();
      expect(listenerFn).to.have.not.been.called;
    });

    it('keeps a record of its children', function () {
      const child1 = scope._new();
      const child2 = scope._new();
      const child2child1 = child2._new();

      expect(scope.__children).to.have.lengthOf(2);
      expect(scope.__children[0]).to.equal(child1);
      expect(scope.__children[1]).to.equal(child2);

      expect(child1.__children).to.have.lengthOf(0);
      expect(child2.__children).to.have.lengthOf(1);
      expect(child2.__children[0]).to.equal(child2child1);
    });

    it('digests its children', function () {
      (scope: any).someValue = 233;
      const child = scope._new();
      const listenerFn = sinon.spy();

      child._watch(
        scope => (scope: any).someValue,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('digests from root when _apply', function () {
      (scope: any).someValue = 233;
      const child1 = scope._new();
      const child1child1 = child1._new();
      const listenerFn = sinon.spy();

      scope._watch(
        scope => (scope: any).someValue,
        listenerFn
      );

      child1child1._apply(() => {});
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('schedules a digest from root on _evalAsync', function (done) {
      (scope: any).someValue = 233;
      const child1 = scope._new();
      const child1child1 = child1._new();
      const listenerFn = sinon.spy();

      scope._watch(
        scope => (scope: any).someValue,
        listenerFn
      );

      child1child1._evalAsync(() => {});
      setTimeout(() => {
        expect(listenerFn).to.have.been.calledOnce;
        done();
      }, 10);
    });

    it('does not have access to parent scope attributes when isolated', function () {
      (scope: any).someValue = 233;
      const child = scope._new(true);

      expect((child: any).someValue).to.be.undefined;
    });

    it('digests its isolated children', function () {
      const child = scope._new(true);
      (child: any).someValue = 233;
      const listenerFn = sinon.spy();

      child._watch(
        scope => (scope: any).someValue,
        listenerFn
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('digests from root on _apply when isolated', function () {
      (scope: any).someValue = 233;
      const child1 = scope._new(true);
      const child1child1 = child1._new();
      const listenerFn = sinon.spy();

      scope._watch(
        scope => (scope: any).someValue,
        listenerFn
      );

      child1child1._apply(() => {});
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('schedules a digest from root on _evalAsync when isolated', function (done) {
      (scope: any).someValue = 233;
      const child1 = scope._new(true);
      const child1child1 = child1._new();
      const listenerFn = sinon.spy();

      scope._watch(
        scope => (scope: any).someValue,
        listenerFn
      );

      child1child1._evalAsync(() => {});
      setTimeout(() => {
        expect(listenerFn).to.have.been.calledOnce;
        done();
      }, 10);
    });

    it('executes _evalAsync functions on isolated scopes', function (done) {
      const child = scope._new(true);
      const evalFn = sinon.spy();

      child._evalAsync(evalFn);
      setTimeout(() => {
        expect(evalFn).to.have.been.calledOnce;
        done();
      }, 10);
    });

    it('executes __postDigest functions on isolated scopes', function () {
      const child = scope._new(true);
      const postDigestFn = sinon.spy();

      child.__postDigest(postDigestFn);
      scope._digest();

      expect(postDigestFn).to.have.been.calledOnce;
    });

    it('coalesces _applyAsync functions in isolated scopes', function (done) {
      const child1 = scope._new(true);
      const child2 = scope._new(true);
      const watchFn = sinon.spy();

      child1._watch(watchFn);
      child1._applyAsync(scope => { (scope: any).someValue = 233; });
      child2._applyAsync(scope => { (scope: any).someValue = 256; });

      setTimeout(() => {
        expect(watchFn).to.have.been.calledTwice;
        done();
      }, 10);
    });

    it('can take some other scope as the parent', function () {
      const anotherScope = new Scope();
      const child = scope._new(false, anotherScope);
      const childWatcherFn = sinon.spy();

      (scope: any).someValue = 233;
      expect((child: any).someValue).to.equal(233);

      child._watch(childWatcherFn);

      scope._digest();
      expect(childWatcherFn).to.have.not.been.called;

      anotherScope._digest();
      expect(childWatcherFn).to.have.been.calledTwice;
    });

    it('not longer digests after _destroy', function () {
      const child = scope._new();
      const listenerFn = sinon.spy();

      (child: any).arr = [0, 1, 2];
      child._watch(
        scope => (scope: any).arr,
        listenerFn,
        true
      );

      scope._digest();
      expect(listenerFn).to.have.been.calledOnce;

      (child: any).arr.push(3);
      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;

      child._destroy();
      (child: any).arr.push(4);
      scope._digest();
      expect(listenerFn).to.have.been.calledTwice;
    });
  });
});
