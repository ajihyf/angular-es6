/* eslint-env mocha */
import Scope from '../src/scope';
import { expect } from 'chai';
import sinon from 'sinon';
import _ from 'lodash';

describe('Scope', function () {
  let scope;

  beforeEach(function () {
    scope = new Scope();
  });

  it('can be constructed and used as an object', function () {
    scope.someProperty = 1;
    expect(scope.someProperty).to.equal(1);
  });

  describe('#$watch', function () {
    it('calls the listener function of a watch on first $digest', function () {
      const watchFn = () => 'wat';
      const listenerFn = sinon.spy();
      scope.$watch(watchFn, listenerFn);

      scope.$digest();

      expect(listenerFn).to.have.been.called;
    });

    it('calls the watch function with the scope as first argument', function () {
      const watchFn = sinon.spy();
      const listenerFn = () => {};
      scope.$watch(watchFn, listenerFn);

      scope.$digest();

      expect(watchFn).to.have.been.calledWith(scope);
    });

    it('calls the listener function when the watched value changes', function () {
      scope.someValue = 'a';
      const listenerFn = sinon.spy();

      scope.$watch(
        scope => scope.someValue,
        listenerFn
      );

      expect(listenerFn).to.have.not.been.called;

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;

      scope.someValue = 'aji';
      expect(listenerFn).to.have.been.calledOnce;

      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('calls listener when watch value is first undefined', function () {
      const listenerFn = sinon.spy();

      scope.$watch(
        scope => scope.someValue,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('calls listener with new value as old value the first time', function () {
      scope.someValue = 233;
      let oldValueGiven;

      scope.$watch(
        scope => scope.someValue,
        (newValue, oldValue, scope) => { oldValueGiven = oldValue; }
      );

      scope.$digest();
      expect(oldValueGiven).to.equal(233);
    });

    it('may have watcher that omit listener', function () {
      const watchFn = sinon.stub().returns('hello');
      scope.$watch(watchFn);

      scope.$digest();
      expect(watchFn).to.have.been.called;
    });

    it('triggers chained watchers in the same digest', function () {
      scope.name = 'Keal';

      scope.$watch(
        scope => scope.nameUpper,
        (newValue, oldValue, scope) => {
          if (newValue) {
            scope.initial = newValue[0] + '@@';
          }
        }
      );

      scope.$watch(
        scope => scope.name,
        (newValue, oldValue, scope) => {
          if (newValue) {
            scope.nameUpper = newValue.toUpperCase();
          }
        }
      );

      scope.$digest();
      expect(scope.initial).to.equal('K@@');

      scope.name = 'Aji';
      scope.$digest();
      expect(scope.initial).to.equal('A@@');
    });

    it('ends the digest when the last watch is clean', function () {
      scope.arr = _.range(100);
      let executedNum = 0;

      _.times(100, function (i) {
        scope.$watch(
          scope => {
            executedNum++;
            return scope.arr[i];
          }
        );
      });

      scope.$digest();
      expect(executedNum).to.equal(200);

      scope.arr[0] = 233;
      scope.$digest();
      expect(executedNum).to.equal(301);
    });

    it('does not end digest so that new watches are not run', function () {
      scope.someValue = 'hello';
      const listenerFn = sinon.spy();

      scope.$watch(
        scope => scope.someValue,
        (newValue, oldValue, scope) => {
          scope.$watch(
            scope => scope.someValue,
            listenerFn
          );
        }
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('compare based on value if enabled', function () {
      scope.arr = _.range(3);
      const listenerFn = sinon.spy();

      scope.$watch(
        scope => scope.arr,
        listenerFn,
        true
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;

      scope.arr.push(3);
      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('handles NaN correctly', function () {
      scope.number = 0 / 0;
      const listenerFn = sinon.spy();

      scope.$watch(
        scope => scope.number,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('returns a function to destroy watch', function () {
      scope.someValue = 233;
      const listenerFn = sinon.spy();

      const destroyWatch = scope.$watch(
        scope => scope.someValue,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;

      scope.someValue = 256;
      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;

      scope.someValue = 512;
      destroyWatch();
      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('allows destroying a $watch during digest', function () {
      scope.someValue = 233;
      const watchSpy = [];

      scope.$watch(
        scope => {
          watchSpy.push(0);
          return scope.someValue;
        }
      );

      const destroyWatch = scope.$watch(
        () => {
          watchSpy.push(1);
          destroyWatch();
        }
      );

      scope.$watch(
        scope => {
          watchSpy.push(2);
          return scope.someValue;
        }
      );

      scope.$digest();
      expect(watchSpy).to.deep.equal([0, 1, 2, 0, 2]);
    });

    it('allows a $watch to destroy another during digest', function () {
      scope.someValue = 233;
      const listenerFn = sinon.spy();
      let destroyWatch;

      scope.$watch(
        scope => scope.someValue,
        () => { destroyWatch(); }
      );

      destroyWatch = scope.$watch(
        () => {},
        () => {}
      );

      scope.$watch(
        scope => scope.someValue,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('allows destroying multiple $watches during digest', function () {
      scope.someValue = 233;
      const listenerFn = sinon.spy();
      let destroyWatch1, destroyWatch2;

      destroyWatch1 = scope.$watch(
        () => {
          destroyWatch1();
          destroyWatch2();
        }
      );

      destroyWatch2 = scope.$watch(
        scope => scope.someValue,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.not.been.called;
    });
  });

  describe('#$eval', function () {
    it('executes $eval function and returns result', function () {
      scope.someValue = 233;

      const result = scope.$eval(scope => scope.someValue);

      expect(result).to.equal(233);
    });

    it('passes the second function argument', function () {
      scope.someValue = 233;

      const result = scope.$eval((scope, arg) => scope.someValue + arg, 2);

      expect(result).to.equal(235);
    });
  });

  describe('#$apply', function () {
    it('executes $apply function and starts digest', function () {
      scope.someValue = 233;
      const listenerFn = sinon.spy();

      scope.$watch(
        scope => scope.someValue,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;

      scope.$apply(scope => { scope.someValue = 235; });
      expect(listenerFn).to.have.been.calledTwice;
    });
  });

  describe('#$evalAsync', function () {
    it('executes $evalAsync function later in the same cycle', function () {
      scope.someValue = 233;
      scope.asyncEvaluated = false;
      scope.asyncEvaluatedImmediately = false;

      scope.$watch(
        scope => scope.someValue,
        (newValue, oldValue, scope) => {
          scope.$evalAsync(scope => { scope.asyncEvaluated = true; });
          scope.asyncEvaluatedImmediately = scope.asyncEvaluated;
        }
      );

      scope.$digest();
      expect(scope.asyncEvaluated).to.be.true;
      expect(scope.asyncEvaluatedImmediately).to.be.false;
    });

    it('executes $evalAsync function added by watch function', function () {
      scope.someValue = 233;
      scope.asyncEvaluated = false;

      scope.$watch(
        scope => {
          if (!scope.asyncEvaluated) {
            scope.$evalAsync(scope => { scope.asyncEvaluated = true; });
          }
          return scope.someValue;
        }
      );

      scope.$digest();
      expect(scope.asyncEvaluated).to.be.true;
    });

    it('executes $evalAsync function even when not dirty', function () {
      scope.someValue = 233;
      scope.asyncEvaluatedTime = 0;

      scope.$watch(
        scope => {
          if (scope.asyncEvaluatedTime < 2) {
            scope.$evalAsync(scope => { scope.asyncEvaluatedTime++; });
          }
          return scope.someValue;
        }
      );

      scope.$digest();
      expect(scope.asyncEvaluatedTime).to.equal(2);
    });

    it('throws error when halted by $evalAsyncs added by watch', function () {
      scope.$watch(
        scope => {
          scope.$evalAsync(() => {});
          return scope.someValue;
        }
      );

      expect(() => { scope.$digest(); }).to.throw();
    });

    it('schedules a digest in $evalAsync', function (done) {
      scope.someValue = 233;
      const listernerFn = sinon.spy();

      scope.$watch(
        scope => scope.someValue,
        listernerFn
      );

      scope.$evalAsync(() => {});
      expect(listernerFn).to.have.not.been.called;
      setTimeout(function () {
        expect(listernerFn).to.have.been.calledOnce;
        done();
      }, 10);
    });
  });

  describe('#$applyAsync', function () {
    it('apply function asynchronously', function (done) {
      const listenerFn = sinon.spy();

      scope.$watch(
        scope => scope.someValue,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;

      scope.$applyAsync(scope => { scope.someValue = 233; });
      expect(listenerFn).to.have.been.calledOnce;

      setTimeout(() => {
        expect(listenerFn).to.have.been.calledTwice;
        done();
      }, 10);
    });

    it('does not execute $applyAsync\'ed function in the same cycle', function (done) {
      scope.someValue = 233;
      const asyncAppliedFn = sinon.spy();

      scope.$watch(
        scope => scope.someValue,
        (newValue, oldValue, scope) => {
          scope.$applyAsync(asyncAppliedFn);
        }
      );

      scope.$digest();
      expect(asyncAppliedFn).to.have.not.been.called;
      setTimeout(() => {
        expect(asyncAppliedFn).to.have.been.calledOnce;
        done();
      }, 10);
    });

    it('coalesces many calls to $applyAsync', function (done) {
      const watcherFn = sinon.spy(scope => scope.someValue);

      scope.$watch(
        watcherFn
      );

      scope.$applyAsync(scope => { scope.someValue = 233; });
      scope.$applyAsync(scope => { scope.someValue = 256; });

      setTimeout(() => {
        expect(watcherFn).to.have.been.calledTwice;
        done();
      }, 10);
    });

    it('cancels and flushes $applyAsync if digest', function (done) {
      const watcherFn = sinon.spy(scope => scope.someValue);

      scope.$watch(
        watcherFn
      );

      scope.$applyAsync(scope => { scope.someValue = 233; });
      scope.$applyAsync(scope => { scope.someValue = 256; });

      scope.$digest();
      expect(watcherFn).to.have.been.calledTwice;
      expect(scope.someValue).to.equal(256);

      setTimeout(() => {
        expect(watcherFn).to.have.been.calledTwice;
        done();
      }, 50);
    });
  });

  describe('#$phase', function () {
    it('has a $$phase as the current digest phase', function () {
      scope.someValue = 233;
      let phaseInWatch, phaseInListener, phaseInApply;

      scope.$watch(
        scope => {
          phaseInWatch = scope.$$phase;
          return scope.someValue;
        },
        (newValue, oldValue, scope) => {
          phaseInListener = scope.$$phase;
        }
      );

      scope.$apply(scope => {
        phaseInApply = scope.$$phase;
      });

      expect(phaseInWatch).to.equal('$digest');
      expect(phaseInListener).to.equal('$digest');
      expect(phaseInApply).to.equal('$apply');
    });
  });

  describe('#$$postDigest', function () {
    it('runs a $$postDigest function after each digest', function () {
      const postDigestFn = sinon.spy();

      scope.$$postDigest(postDigestFn);

      expect(postDigestFn).to.have.not.been.called;

      scope.$digest();
      expect(postDigestFn).to.have.been.calledOnce;

      scope.$digest();
      expect(postDigestFn).to.have.been.calledOnce;
    });

    it('does not include $$postDigest in a digest', function () {
      scope.someValue = 233;

      scope.$$postDigest(() => { scope.someValue = 256; });

      scope.$watch(
        scope => scope.someValue,
        (newValue, oldValue, scope) => { scope.watchedValue = newValue; }
      );

      scope.$digest();
      expect(scope.watchedValue).to.equal(233);

      scope.$digest();
      expect(scope.watchedValue).to.equal(256);
    });
  });

  describe('#$watchGroup', function () {
    it('takes watches as an array and calls listener with arrays', function () {
      scope.someValue = 0;
      scope.anotherValue = 1;

      scope.$watchGroup([
        scope => scope.someValue,
        scope => scope.anotherValue
      ], (newValues, oldValues, scope) => {
        scope.gotNewValues = newValues;
        scope.gotOldValues = oldValues;
      });

      scope.$digest();
      expect(scope.gotOldValues).to.deep.equal([0, 1]);
      expect(scope.gotOldValues).to.deep.equal([0, 1]);
    });

    it('only calls listener once per digest', function () {
      const listenerFn = sinon.spy();
      scope.someValue = 0;
      scope.anotherValue = 1;

      scope.$watchGroup([
        scope => scope.someValue,
        scope => scope.anotherValue
      ], listenerFn);

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('uses the same array of old and new values when first run', function () {
      scope.someValue = 0;
      scope.anotherValue = 1;

      scope.$watchGroup([
        scope => scope.someValue,
        scope => scope.anotherValue
      ], (newValues, oldValues, scope) => {
        scope.gotOldValues = oldValues;
        scope.gotNewValues = newValues;
      });

      scope.$digest();
      expect(scope.gotOldValues).to.equal(scope.gotNewValues);
    });

    it('uses different arrays of old and new values for subsequent runs', function () {
      scope.someValue = 0;
      scope.anotherValue = 1;

      scope.$watchGroup([
        scope => scope.someValue,
        scope => scope.anotherValue
      ], (newValues, oldValues, scope) => {
        scope.gotOldValues = oldValues;
        scope.gotNewValues = newValues;
      });

      scope.$digest();
      expect(scope.gotOldValues).to.deep.equal([0, 1]);

      scope.anotherValue = 2;
      scope.$digest();
      expect(scope.gotOldValues).to.deep.equal([0, 1]);
      expect(scope.gotNewValues).to.deep.equal([0, 2]);
    });

    it('calls the listener once when the watch array is empty', function () {
      scope.someValue = 0;
      scope.anotherValue = 1;

      scope.$watchGroup([], (newValues, oldValues, scope) => {
        scope.gotOldValues = oldValues;
        scope.gotNewValues = newValues;
      });

      scope.$digest();
      expect(scope.gotOldValues).to.be.an('array').and.empty;
      expect(scope.gotNewValues).to.be.an('array').and.empty;
    });

    it('can be deregistered', function () {
      scope.someValue = 0;
      scope.anotherValue = 1;
      const listenerFn = sinon.spy();

      const destroyGroup = scope.$watchGroup([
        scope => scope.someValue,
        scope => scope.anotherValue
      ], listenerFn);

      scope.$digest();
      scope.anotherValue = 2;
      destroyGroup();
      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('does not call the zero-watch listener when deregistered first', function () {
      const listenerFn = sinon.spy();

      const destroyGroup = scope.$watchGroup([], listenerFn);

      destroyGroup();
      scope.$digest();

      expect(listenerFn).to.have.not.been.called;
    });
  });

  describe('#$watchCollection', function () {
    it('works like a normal watch for non-colletions', function () {
      scope.someValue = 233;
      let value;
      const listenerFn = sinon.spy((newValue, oldValue, scope) => { value = oldValue; });

      scope.$watchCollection(
        scope => scope.someValue,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;
      expect(value).to.equal(233);

      scope.someValue = 256;
      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;

      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('correctly handles NaNs', function () {
      scope.someValue = 0 / 0;
      const listenerFn = sinon.spy();

      scope.$watchCollection(
        scope => scope.someValue,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('notices when the value becomes an array', function () {
      const listenerFn = sinon.spy();

      scope.$watchCollection(
        scope => scope.arr,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;

      scope.arr = [0, 1];
      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;

      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('detects new items in an array', function () {
      scope.arr = [0, 1, 2];
      const listenerFn = sinon.spy();

      scope.$watchCollection(
        scope => scope.arr,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;

      scope.arr.push(3);
      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;

      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('detects items removed in an array', function () {
      scope.arr = [0, 1, 2];
      const listenerFn = sinon.spy();

      scope.$watchCollection(
        scope => scope.arr,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;

      scope.arr.shift();
      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;

      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('detects an item replaced in an array', function () {
      scope.arr = [0, 1, 2];
      const listenerFn = sinon.spy();

      scope.$watchCollection(
        scope => scope.arr,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;

      scope.arr[1] = 10;
      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;

      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('detects items reordered in an array', function () {
      scope.arr = [3, 1, 2];
      const listenerFn = sinon.spy();

      scope.$watchCollection(
        scope => scope.arr,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;

      scope.arr.sort();
      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;

      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('correctly handles NaNs in an array', function () {
      scope.arr = [0, Number.NaN, 2, Number.NaN];
      const listenerFn = sinon.spy();

      scope.$watchCollection(
        scope => scope.arr,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('detects an item replaced in an argument object', function () {
      (function () {
        scope.arrLike = arguments;
      })(0, 1, 2);
      const listenerFn = sinon.spy();

      scope.$watchCollection(
        scope => scope.arrLike,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;

      scope.arrLike[1] = 233;
      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;

      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('detects an item replaced in a NodeList object', function () {
      document.documentElement.appendChild(document.createElement('div'));
      scope.arrLike = document.getElementsByTagName('div');
      const listenerFn = sinon.spy();

      scope.$watchCollection(
        scope => scope.arrLike,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;

      document.documentElement.appendChild(document.createElement('div'));
      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;

      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('notices when the value becomes an object', function () {
      const listenerFn = sinon.spy();

      scope.$watchCollection(
        scope => scope.obj,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;

      scope.obj = { a: 1 };
      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;

      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('detects when an attribute is added to an object', function () {
      scope.obj = { a: 1 };
      const listenerFn = sinon.spy();

      scope.$watchCollection(
        scope => scope.obj,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;

      scope.obj.b = 2;
      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;

      scope.$digest();
    });

    it('detects when an attribute is changed in an object', function () {
      scope.obj = { a: 1 };
      const listenerFn = sinon.spy();

      scope.$watchCollection(
        scope => scope.obj,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;

      scope.obj.a = 2;
      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;

      scope.$digest();
    });

    it('detects when an attribute is deleted to an object', function () {
      scope.obj = { a: 1 };
      const listenerFn = sinon.spy();

      scope.$watchCollection(
        scope => scope.obj,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;

      delete scope.obj.a;
      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('correctly handles NaNs in an object', function () {
      scope.obj = { a: Number.NaN };
      const listenerFn = sinon.spy();

      scope.$watchCollection(
        scope => scope.obj,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('does not consider object with length property as an array', function () {
      scope.obj = { length: 233, someKey: 1 };
      const listenerFn = sinon.spy();

      scope.$watchCollection(
        scope => scope.obj,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;

      scope.obj.otherKey = 256;
      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('get newValue and oldValue in listenerFn', function () {
      scope.arr = [0, 1, 2];
      let gotNewValue;
      let gotOldValue;

      scope.$watchCollection(
        scope => scope.arr,
        (newValue, oldValue) => {
          gotNewValue = newValue;
          gotOldValue = oldValue;
        }
      );

      scope.$digest();
      expect(gotNewValue).to.deep.equal([0, 1, 2]);
      expect(gotOldValue).to.deep.equal([0, 1, 2]);

      scope.arr.push(3);
      scope.$digest();
      expect(gotNewValue).to.deep.equal([0, 1, 2, 3]);
      expect(gotOldValue).to.deep.equal([0, 1, 2]);
    });
  });

  describe('Events', function () {
    let child, isolatedChild;

    beforeEach(() => {
      child = scope.$new();
      isolatedChild = scope.$new(true);
    });

    it('allows registering listeners', function () {
      const listener1 = () => {};
      const listener2 = () => {};
      const listener3 = () => {};

      scope.$on('aEvent', listener1);
      scope.$on('aEvent', listener2);
      scope.$on('bEvent', listener3);

      expect(scope.$$listeners).to.deep.equal({
        aEvent: [listener1, listener2],
        bEvent: [listener3]
      });
    });

    it('registers different listeners for every scope', function () {
      const listener1 = () => {};
      const listener2 = () => {};
      const listener3 = () => {};

      scope.$on('aEvent', listener1);
      child.$on('aEvent', listener2);
      isolatedChild.$on('aEvent', listener3);

      expect(scope.$$listeners).to.deep.equal({ aEvent: [listener1] });
      expect(child.$$listeners).to.deep.equal({ aEvent: [listener2] });
      expect(isolatedChild.$$listeners).to.deep.equal({ aEvent: [listener3] });
    });

    _.each(['$emit', '$broadcast'], method => {
      it(`calls the listeners of the matching event on ${method}`, function () {
        const listener1 = sinon.spy();
        const listener2 = sinon.spy();
        const listener3 = sinon.spy();

        scope.$on('aEvent', listener1);
        scope.$on('aEvent', listener2);
        scope.$on('bEvent', listener3);

        scope[method]('aEvent');
        expect(listener1).to.have.been.calledOnce;
        expect(listener2).to.have.been.calledOnce;
        expect(listener3).to.have.not.been.called;
      });

      it(`passes an event object with a name to listener on ${method}`, function () {
        const listener = sinon.spy();
        scope.$on('aEvent', listener);

        scope[method]('aEvent');
        expect(listener).to.have.been.calledOnce;
        expect(listener.lastCall.args[0].name).to.equal('aEvent');
      });

      it(`passes the same event object to each listener on ${method}`, function () {
        const listener1 = sinon.spy();
        const listener2 = sinon.spy();

        scope.$on('aEvent', listener1);
        scope.$on('aEvent', listener2);

        scope[method]('aEvent');
        expect(listener1.lastCall.args[0]).to.equal(listener2.lastCall.args[0]);
      });

      it(`passes additional arguments to listeners on ${method}`, function () {
        const listener = sinon.spy();
        scope.$on('aEvent', listener);

        scope[method]('aEvent', 'some', ['additional', 'arguments'], '...');

        expect(listener.lastCall.args[1]).to.deep.equal('some');
        expect(listener.lastCall.args[2]).to.deep.equal(['additional', 'arguments']);
        expect(listener.lastCall.args[3]).to.deep.equal('...');
      });

      it(`returns the event object on ${method}`, function () {
        const returnedEvent = scope[method]('aEvent');

        expect(returnedEvent).to.be.an('object').and.have.property('name', 'aEvent');
      });

      it(`can be deregistered ${method}`, function () {
        const listener = sinon.spy();
        const deregister = scope.$on('aEvent', listener);

        deregister();
        scope[method]('aEvent');

        expect(listener).have.not.been.called;
      });

      it(`does not skip the next listener when removed on ${method}`, function () {
        const listener = () => {
          deregister();
        };
        const nextListener = sinon.spy();
        const deregister = scope.$on('aEvent', listener);
        scope.$on('aEvent', nextListener);

        scope[method]('aEvent');
        expect(nextListener).to.have.been.calledOnce;
      });

      it(`sets defaultPrevented when preventDefault called on ${method}`, function () {
        scope.$on('aEvent', event => { event.preventDefault(); });

        const event = scope[method]('aEvent');

        expect(event).to.have.property('defaultPrevented', true);
      });

      it(`does not stop on exceptions on ${method}`, function () {
        const listener = sinon.spy();
        scope.$on('aEvent', () => { throw new Error('error'); });
        scope.$on('aEvent', listener);

        scope[method]('aEvent');
        expect(listener).to.have.been.calledOnce;
      });
    });

    it('propagates up the scope hierarchy on $emit', function () {
      const scopeListener = sinon.spy();
      const childListener = sinon.spy();

      scope.$on('aEvent', scopeListener);
      child.$on('aEvent', childListener);

      child.$emit('aEvent');
      expect(scopeListener).to.have.been.calledOnce;
      expect(childListener).to.have.been.calledOnce;
    });

    it('propagates the same event up on $emit', function () {
      const scopeListener = sinon.spy();
      const childListener = sinon.spy();

      scope.$on('aEvent', scopeListener);
      child.$on('aEvent', childListener);

      child.$emit('aEvent');
      expect(scopeListener.lastCall.args[0]).to.equal(childListener.lastCall.args[0]);
    });

    it('propagates down the scope hierarchy on $broadcast', function () {
      const scopeListener = sinon.spy();
      const childListener = sinon.spy();
      const isolatedChildListener = sinon.spy();

      scope.$on('aEvent', scopeListener);
      child.$on('aEvent', childListener);
      isolatedChild.$on('aEvent', isolatedChildListener);

      scope.$broadcast('aEvent');
      expect(scopeListener).to.have.been.calledOnce;
      expect(childListener).to.have.been.calledOnce;
      expect(isolatedChildListener).to.have.been.calledOnce;
    });

    it('propagates the same event down on $broadcast', function () {
      const scopeListener = sinon.spy();
      const childListener = sinon.spy();
      const isolatedChildListener = sinon.spy();

      scope.$on('aEvent', scopeListener);
      child.$on('aEvent', childListener);
      isolatedChild.$on('aEvent', isolatedChildListener);

      scope.$broadcast('aEvent');
      expect(scopeListener.lastCall.args[0]).to.equal(childListener.lastCall.args[0]);
      expect(scopeListener.lastCall.args[0]).to.equal(isolatedChildListener.lastCall.args[0]);
    });

    it('attaches targetScope on $emit', function () {
      const scopeListener = sinon.spy();
      const childListener = sinon.spy();

      scope.$on('aEvent', scopeListener);
      child.$on('aEvent', childListener);

      child.$emit('aEvent');
      expect(scopeListener.lastCall.args[0]).to.have.property('targetScope', child);
      expect(childListener.lastCall.args[0]).to.have.property('targetScope', child);
    });

    it('attaches targetScope on $broadcast', function () {
      const scopeListener = sinon.spy();
      const childListener = sinon.spy();

      scope.$on('aEvent', scopeListener);
      child.$on('aEvent', childListener);

      scope.$broadcast('aEvent');
      expect(scopeListener.lastCall.args[0]).to.have.property('targetScope', scope);
      expect(childListener.lastCall.args[0]).to.have.property('targetScope', scope);
    });

    it('attaches currentScope on $emit', function () {
      let currentScopeOnScope;
      let currentScopeOnChild;
      scope.$on('aEvent', (event) => { currentScopeOnScope = event.currentScope; });
      child.$on('aEvent', (event) => { currentScopeOnChild = event.currentScope; });

      child.$emit('aEvent');
      expect(currentScopeOnChild).to.equal(child);
      expect(currentScopeOnScope).to.equal(scope);
    });

    it('attaches currentScope on $broadcast', function () {
      let currentScopeOnScope;
      let currentScopeOnChild;
      scope.$on('aEvent', event => { currentScopeOnScope = event.currentScope; });
      child.$on('aEvent', event => { currentScopeOnChild = event.currentScope; });

      scope.$broadcast('aEvent');
      expect(currentScopeOnChild).to.equal(child);
      expect(currentScopeOnScope).to.equal(scope);
    });

    it('sets currentScope to null after propagation on $emit', function () {
      scope.$on('aEvent', () => {});

      const event = scope.$emit('aEvent');
      expect(event.currentScope).to.be.null;
    });

    it('sets currentScope to null after propagation on $broadcast', function () {
      scope.$on('aEvent', () => {});

      const event = scope.$broadcast('aEvent');
      expect(event.currentScope).to.be.null;
    });

    it('does not propagate to parents when stopped', function () {
      const scopeListener = sinon.spy();

      child.$on('aEvent', event => { event.stopPropagation(); });
      scope.$on('aEvent', scopeListener);

      child.$emit('aEvent');
      expect(scopeListener).to.have.not.been.called;
    });

    it('fires $destroy when destroyed', function () {
      const listener = sinon.spy();
      scope.$on('$destroy', listener);

      scope.$destroy();
      expect(listener).to.have.been.calledOnce;
    });

    it('broadcast $destroy to children when destroyed', function () {
      const listener = sinon.spy();
      child.$on('$destroy', listener);

      scope.$destroy();
      expect(listener).to.have.been.calledOnce;
    });

    it('does not call listeners after destroyed', function () {
      const listener = sinon.spy();
      scope.$on('aEvent', listener);

      scope.$destroy();
      scope.$emit('aEvent');
      expect(listener).to.have.not.been.called;
    });
  });

  describe('errorHandling', function () {
    it('catches exceptions in watch functions', function () {
      scope.someValue = 233;
      const listenerFn = sinon.spy();

      scope.$watch(
        () => { throw new Error('error'); }
      );

      scope.$watch(
        scope => scope.someValue,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('catches exceptions in listener functions', function () {
      scope.someValue = 233;
      const listenerFn = sinon.spy();

      scope.$watch(
        scope => scope.someValue,
        () => { throw new Error('error'); }
      );

      scope.$watch(
        scope => scope.someValue,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('catches exceptions in $evalAsync', function (done) {
      scope.someValue = 233;
      const listenerFn = sinon.spy();

      scope.$watch(
        scope => scope.someValue,
        listenerFn
      );

      scope.$evalAsync(() => {
        throw new Error('error');
      });

      setTimeout(() => {
        expect(listenerFn).to.have.been.calledOnce;
        done();
      }, 10);
    });

    it('catches exceptions in $applyAsync', function (done) {
      const appliedFn = sinon.spy();

      scope.$applyAsync(() => {
        throw new Error('error');
      });

      scope.$applyAsync(() => {
        throw new Error('error');
      });

      scope.$applyAsync(appliedFn);

      setTimeout(() => {
        expect(appliedFn).to.have.been.calledOnce;
        done();
      }, 10);
    });

    it('catches exceptions in $$postDigest', function () {
      const postDigestFn = sinon.spy();

      scope.$$postDigest(() => {
        throw new Error('error');
      });

      scope.$$postDigest(postDigestFn);

      scope.$digest();
      expect(postDigestFn).to.have.been.calledOnce;
    });
  });

  describe('inheritance', function () {
    it('inherits the parent\'s properties', function () {
      scope.someValue = 233;
      const child = scope.$new();

      expect(child.someValue).to.equal(233);
    });

    it('does not cause a parent to inherit its properties', function () {
      const child = scope.$new();

      child.someValue = 233;
      expect(scope.someValue).to.be.undefined;
    });

    it('inherits the parent\'s value whenever the are defined', function () {
      const child = scope.$new();
      scope.someValue = 233;

      expect(child.someValue).to.equal(233);
    });

    it('can manipulate parent\'s properties', function () {
      const child = scope.$new();
      scope.arr = [0, 1, 2];

      child.arr.push(3);
      expect(child.arr).to.deep.equal([0, 1, 2, 3]);
      expect(scope.arr).to.deep.equal([0, 1, 2, 3]);
    });

    it('can watch a property in parent', function () {
      const child = scope.$new();
      const listenerFn = sinon.spy();
      scope.arr = [0, 1, 2];

      child.$watch(
        scope => scope.arr,
        listenerFn,
        true
      );

      child.$digest();
      expect(listenerFn).to.have.been.calledOnce;

      scope.arr.push(3);
      child.$digest();
      expect(listenerFn).to.have.been.calledTwice;
    });

    it('can be nested at any depth', function () {
      const c1 = scope.$new();
      const c2 = scope.$new();
      const c1c1 = c1.$new();
      const c1c2 = c1.$new();
      const c2c1 = c2.$new();

      scope.someValue = 233;
      expect(c1.someValue).to.equal(233);
      expect(c2.someValue).to.equal(233);
      expect(c1c1.someValue).to.equal(233);
      expect(c1c2.someValue).to.equal(233);
      expect(c2c1.someValue).to.equal(233);

      c2.anotherValue = 256;
      expect(c2c1.anotherValue).to.equal(256);
      expect(c1.anotherValue).to.be.undefined;
      expect(c1c1.anotherValue).to.be.undefined;
      expect(c1c2.anotherValue).to.be.undefined;
    });

    it('shadows parent\'s property with the same name', function () {
      const child = scope.$new();

      scope.someValue = 233;
      child.someValue = 256;

      expect(scope.someValue).to.equal(233);
      expect(child.someValue).to.equal(256);
    });

    it('does not deeply shadow parents\'s properties', function () {
      const child = scope.$new();

      scope.user = { name: 'Aji' };
      child.user.name = 'Keal';

      expect(child.user.name).to.equal('Keal');
      expect(scope.user.name).to.equal('Keal');
    });

    it('does not digest its parent', function () {
      const child = scope.$new();
      const listenerFn = sinon.spy();

      scope.someValue = 233;
      scope.$watch(
        scope => scope.someValue,
        listenerFn
      );

      child.$digest();
      expect(listenerFn).to.have.not.been.called;
    });

    it('keeps a record of its children', function () {
      const child1 = scope.$new();
      const child2 = scope.$new();
      const child2child1 = child2.$new();

      expect(scope.$$children).to.have.lengthOf(2);
      expect(scope.$$children[0]).to.equal(child1);
      expect(scope.$$children[1]).to.equal(child2);

      expect(child1.$$children).to.have.lengthOf(0);
      expect(child2.$$children).to.have.lengthOf(1);
      expect(child2.$$children[0]).to.equal(child2child1);
    });

    it('digests its children', function () {
      scope.someValue = 233;
      const child = scope.$new();
      const listenerFn = sinon.spy();

      child.$watch(
        scope => scope.someValue,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('digests from root when $apply', function () {
      scope.someValue = 233;
      const child1 = scope.$new();
      const child1child1 = child1.$new();
      const listenerFn = sinon.spy();

      scope.$watch(
        scope => scope.someValue,
        listenerFn
      );

      child1child1.$apply(() => {});
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('schedules a digest from root on $evalAsync', function (done) {
      scope.someValue = 233;
      const child1 = scope.$new();
      const child1child1 = child1.$new();
      const listenerFn = sinon.spy();

      scope.$watch(
        scope => scope.someValue,
        listenerFn
      );

      child1child1.$evalAsync(() => {});
      setTimeout(() => {
        expect(listenerFn).to.have.been.calledOnce;
        done();
      }, 10);
    });

    it('does not have access to parent scope attributes when isolated', function () {
      scope.someValue = 233;
      const child = scope.$new(true);

      expect(child.someValue).to.be.undefined;
    });

    it('digests its isolated children', function () {
      const child = scope.$new(true);
      child.someValue = 233;
      const listenerFn = sinon.spy();

      child.$watch(
        scope => scope.someValue,
        listenerFn
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('digests from root on $apply when isolated', function () {
      scope.someValue = 233;
      const child1 = scope.$new(true);
      const child1child1 = child1.$new();
      const listenerFn = sinon.spy();

      scope.$watch(
        scope => scope.someValue,
        listenerFn
      );

      child1child1.$apply(() => {});
      expect(listenerFn).to.have.been.calledOnce;
    });

    it('schedules a digest from root on $evalAsync when isolated', function (done) {
      scope.someValue = 233;
      const child1 = scope.$new(true);
      const child1child1 = child1.$new();
      const listenerFn = sinon.spy();

      scope.$watch(
        scope => scope.someValue,
        listenerFn
      );

      child1child1.$evalAsync(() => {});
      setTimeout(() => {
        expect(listenerFn).to.have.been.calledOnce;
        done();
      }, 10);
    });

    it('executes $evalAsync functions on isolated scopes', function (done) {
      const child = scope.$new(true);
      const evalFn = sinon.spy();

      child.$evalAsync(evalFn);
      setTimeout(() => {
        expect(evalFn).to.have.been.calledOnce;
        done();
      }, 10);
    });

    it('executes $$postDigest functions on isolated scopes', function () {
      const child = scope.$new(true);
      const postDigestFn = sinon.spy();

      child.$$postDigest(postDigestFn);
      scope.$digest();

      expect(postDigestFn).to.have.been.calledOnce;
    });

    it('coalesces $applyAsync functions in isolated scopes', function (done) {
      const child1 = scope.$new(true);
      const child2 = scope.$new(true);
      const watchFn = sinon.spy();

      child1.$watch(watchFn);
      child1.$applyAsync(scope => { scope.someValue = 233; });
      child2.$applyAsync(scope => { scope.someValue = 256; });

      setTimeout(() => {
        expect(watchFn).to.have.been.calledTwice;
        done();
      }, 10);
    });

    it('can take some other scope as the parent', function () {
      const anotherScope = new Scope();
      const child = scope.$new(false, anotherScope);
      const childWatcherFn = sinon.spy();

      scope.someValue = 233;
      expect(child.someValue).to.equal(233);

      child.$watch(childWatcherFn);

      scope.$digest();
      expect(childWatcherFn).to.have.not.been.called;

      anotherScope.$digest();
      expect(childWatcherFn).to.have.been.calledTwice;
    });

    it('not longer digests after $destroy', function () {
      const child = scope.$new();
      const listenerFn = sinon.spy();

      child.arr = [0, 1, 2];
      child.$watch(
        scope => scope.arr,
        listenerFn,
        true
      );

      scope.$digest();
      expect(listenerFn).to.have.been.calledOnce;

      child.arr.push(3);
      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;

      child.$destroy();
      child.arr.push(4);
      scope.$digest();
      expect(listenerFn).to.have.been.calledTwice;
    });
  });
});
