/* @flow */
import _ from 'lodash';
import parse from './parse';

function areEqual(newValue: any, oldValue: any, valueEq: boolean) {
  if (valueEq) {
    return _.isEqual(newValue, oldValue);
  } else {
    return (newValue === oldValue) ||
      (_.isNaN(newValue) && _.isNaN(oldValue));
  }
}

function strictIsArrayLike(obj: any) {
  const isArrayLike = _.isArrayLike(obj);
  if (isArrayLike) {
    if (obj.length > 0) {
      return obj.hasOwnProperty(obj.length - 1);
    }
  }
  return isArrayLike;
}

type ListenerFunction<T> = (newValue: T, oldValue: T, scope: Scope) => any;
type Watcher = {
  watchFn: CallWith<Scope, any>,
  listenerFn: ListenerFunction<any>,
  valueEq: boolean,
  last: any
};
type AsyncQueueItem = {
  scope: Scope,
  expression: AcceptableExpr
};
type ScopeEvent = {
  name: string,
  defaultPrevented: boolean,
  preventDefault: AnyFunction,
  stopPropagation?: AnyFunction,
  currentScope: ?Scope,
  targetScope: Scope
};
type ScopeEventListener = (event: ScopeEvent, ...rest: any[]) => any;

type AcceptableExpr = CallWith<Scope, any> | string;

const initWatchVal: AnyFunction = () => {};
const maxTTL: number = 10; // time to live

function constantWatchDelegate(scope: Scope, listnerFn?: ListenerFunction, valueEq?: boolean, watchFn: CallWith<Scope, any>) {
  const unwatch = scope._watch(() => watchFn(scope),
  (...args) => {
    if (_.isFunction(listnerFn)) {
      // $FlowIssue
      listnerFn.call(scope, ...args);
    }
    unwatch();
  }, valueEq);
  return unwatch;
}

function isAnyUndefined(val: any): boolean {
  return _.some(val, _.isUndefined);
}

function oneTimeWatchDelegate(scope: Scope, listnerFn?: ListenerFunction, valueEq?: boolean, watchFn: CallWith<Scope, any>, literal?: boolean) {
  let lastValue;
  let testFn = literal ? isAnyUndefined : _.isUndefined;
  const unwatch = scope._watch(() => watchFn(scope),
  (newValue, ...args) => {
    lastValue = newValue;
    if (_.isFunction(listnerFn)) {
      // $FlowIssue
      listnerFn.call(scope, newValue, ...args);
    }
    scope.__postDigest(() => {
      if (!testFn(lastValue)) {
        unwatch();
      }
    });
  }, valueEq);
  return unwatch;
}

class Scope {
  __watchers: Watcher[] = [];
  __lastDirtyWatch: ?Watcher = null;
  __asyncQueue: AsyncQueueItem[] = [];
  __applyAsyncQueue: AnyFunction[] = [];
  __applyAsyncId: ?number = null;
  __phase: ?string = null;
  __postDigestQueue: AnyFunction[] = [];
  __children: Scope[] = [];
  _root: Scope = this;
  _parent: ?Scope = null;
  __listeners: { [key: string]: (?ScopeEventListener)[] } = {};

  _on(eventName: string, listener: ScopeEventListener): AnyFunction {
    let listeners = this.__listeners[eventName];
    if (!listeners) {
      this.__listeners[eventName] = listeners = [];
    }
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners[index] = null;
      }
    };
  }

  _emit(eventName: string, ...args: any[]): ScopeEvent {
    let propagationStopped = false;
    const event: ScopeEvent = {
      name: eventName,
      targetScope: this,
      currentScope: this,
      defaultPrevented: false,
      stopPropagation: () => {
        propagationStopped = true;
      },
      preventDefault: () => {
        event.defaultPrevented = true;
      }
    };
    let scope = this;
    do {
      event.currentScope = scope;
      scope.__fireEventOnScope(eventName, event, args);
      scope = scope._parent;
    } while (scope && !propagationStopped); // eslint-disable-line no-unmodified-loop-condition
    event.currentScope = null;
    return event;
  }

  _broadcast(eventName: string, ...args: any[]): ScopeEvent {
    const event: ScopeEvent = {
      name: eventName,
      targetScope: this,
      currentScope: this,
      defaultPrevented: false,
      preventDefault: () => {
        event.defaultPrevented = true;
      }
    };
    this.__everyScope(scope => {
      event.currentScope = scope;
      scope.__fireEventOnScope(eventName, event, args);
      return true;
    });
    event.currentScope = null;
    return event;
  }

  __fireEventOnScope(eventName: string, event: ScopeEvent, args: any[]) {
    const listeners = this.__listeners[eventName] || [];
    let i = 0;
    const listenerArgs = [event, ...args];
    while (i < listeners.length) {
      if (listeners[i] == null) {
        listeners.splice(i, 1);
      } else {
        try {
          listeners[i].apply(null, listenerArgs);
        } catch (err) {
          console.error(err);
        }
        i++;
      }
    }
  }

  __postDigest(fn: AnyFunction) {
    this.__postDigestQueue.push(fn);
  }

  _apply(expr: AcceptableExpr) {
    try {
      this.__beginPhase('_apply');
      return this._eval(expr);
    } finally {
      this.__clearPhase();
      this._root._digest();
    }
  }

  _applyAsync(expr: AcceptableExpr) {
    this.__applyAsyncQueue.push(() => {
      this._eval(expr);
    });
    if (this._root.__applyAsyncId === null) {
      this._root.__applyAsyncId = setTimeout(() => {
        this._apply(() => {
          this.__flushApplyAsync();
        });
      }, 0);
    }
  }

  __flushApplyAsync() {
    while (this.__applyAsyncQueue.length) {
      try {
        this.__applyAsyncQueue.shift()();
      } catch (err) {
        console.error(err);
      }
    }
    this._root.__applyAsyncId = null;
  }

  __beginPhase(phase: string) {
    if (this.__phase) {
      throw new Error(`${this.__phase} already in progress.`);
    }
    this.__phase = phase;
  }

  __clearPhase() {
    this.__phase = null;
  }

  _eval(expr: AcceptableExpr, locals?: any): any {
    return parse(expr)(this, locals);
  }

  _evalAsync(expr: AcceptableExpr) {
    if (!this.__phase && !this.__asyncQueue.length) {
      setTimeout(() => {
        if (this.__asyncQueue.length) {
          this._root._digest();
        }
      }, 0);
    }
    this.__asyncQueue.push({
      scope: this,
      expression: expr
    });
  }

  _watch(watchFn: AcceptableExpr, listenerFn?: ListenerFunction<any>, valueEq?: boolean = false): AnyFunction {
    const parsedWatchFn = parse(watchFn);

    if (parsedWatchFn.constant) {
      return constantWatchDelegate(this, listenerFn, valueEq, parsedWatchFn);
    } else if (parsedWatchFn.oneTime) {
      return oneTimeWatchDelegate(this, listenerFn, valueEq, parsedWatchFn, parsedWatchFn.literal);
    }

    const watcher: Watcher = {
      watchFn: parsedWatchFn,
      listenerFn: listenerFn || (() => {}),
      valueEq,
      last: initWatchVal
    };
    this.__watchers.unshift(watcher);
    this._root.__lastDirtyWatch = null;
    return () => {
      const index = this.__watchers.indexOf(watcher);
      if (index >= 0) {
        this.__watchers.splice(index, 1);
        this._root.__lastDirtyWatch = null;
      }
    };
  }

  _watchGroup(watchFns: CallWith<Scope, any>[], listenerFn?: ListenerFunction<any[]>): AnyFunction {
    const newValues: any[] = new Array(watchFns.length);
    const oldValues: any[] = new Array(watchFns.length);
    let changeReactionSchedules = false;
    let firstRun = true;

    if (watchFns.length === 0) {
      let shouldCall = true;
      this._evalAsync(() => {
        if (shouldCall && listenerFn != null) {
          listenerFn(newValues, newValues, this);
        }
      });
      return () => {
        shouldCall = false;
      };
    }

    const watchGroupListener: AnyFunction = () => {
      if (!listenerFn) return;
      if (firstRun) {
        firstRun = false;
        listenerFn(newValues, newValues, this);
      } else {
        listenerFn(newValues, oldValues, this);
      }
      changeReactionSchedules = false;
    };

    const destroyFns: AnyFunction[] = _.map(watchFns, (watchFn, i) => {
      return this._watch(watchFn, (newValue, oldValue) => {
        newValues[i] = newValue;
        oldValues[i] = oldValue;
        if (!changeReactionSchedules) {
          changeReactionSchedules = true;
          this._evalAsync(watchGroupListener);
        }
      });
    });

    return () => {
      _.each(destroyFns, destroyFn => {
        destroyFn();
      });
    };
  }

  _watchCollection(watchFn: AcceptableExpr, listenerFn: ListenerFunction<any>): AnyFunction {
    let newValue, oldValue;
    let changeCount: number = 0;
    let oldLength: number;
    const trackVeryOldValue: boolean = listenerFn.length > 1;
    let veryOldValue;
    let firstRun: boolean = true;
    const parsedWatchFn = parse(watchFn);

    const internalWatchFn: CallWith<Scope, number> = (scope) => {
      let newLength;
      newValue = parsedWatchFn(scope);

      if (_.isObject(newValue)) {
        if (strictIsArrayLike(newValue)) {
          if (!_.isArray(oldValue)) {
            changeCount++;
            oldValue = [];
          }
          if (newValue.length !== oldValue.length) {
            changeCount++;
            oldValue.length = newValue.length;
          }
          _.each(newValue, (newValueItem, i) => {
            if (!areEqual(newValueItem, oldValue[i], false)) {
              changeCount++;
              oldValue[i] = newValueItem;
            }
          });
        } else {
          if (!_.isObject(oldValue) || strictIsArrayLike(oldValue)) {
            changeCount++;
            oldValue = {};
            oldLength = 0;
          }
          newLength = 0;
          _.forOwn(newValue, (newValueVal, key) => {
            newLength++;
            if (oldValue.hasOwnProperty(key)) {
              if (!areEqual(newValueVal, oldValue[key], false)) {
                changeCount++;
                oldValue[key] = newValueVal;
              }
            } else {
              changeCount++;
              oldLength++;
              oldValue[key] = newValueVal;
            }
          });
          if (oldLength > newLength) {
            changeCount++;
            _.forOwn((oldValue: any), (oldValueVal, key) => {
              if (!newValue.hasOwnProperty(key)) {
                oldLength--;
                delete oldValue[key];
              }
            });
          }
        }
      } else {
        if (!areEqual(newValue, oldValue, false)) {
          changeCount++;
        }
        oldValue = newValue;
      }

      return changeCount;
    };

    const internalListenerFn = () => {
      if (firstRun) {
        listenerFn(newValue, newValue, this);
        firstRun = false;
      } else {
        listenerFn(newValue, veryOldValue, this);
      }

      if (trackVeryOldValue) {
        veryOldValue = _.clone(newValue);
      }
    };

    return this._watch(internalWatchFn, internalListenerFn);
  }

  __digestOnce(): boolean {
    let dirty: boolean = false;
    let continueLoop: boolean = true;
    this.__everyScope(scope => {
      _.eachRight(scope.__watchers, watcher => {
        try {
          if (watcher) {
            const newValue = watcher.watchFn(scope);
            const oldValue = watcher.last;
            if (!areEqual(newValue, oldValue, watcher.valueEq)) {
              scope._root.__lastDirtyWatch = watcher;
              watcher.last = watcher.valueEq ? _.cloneDeep(newValue) : newValue;
              watcher.listenerFn(newValue,
                (oldValue === initWatchVal ? newValue : oldValue),
                scope);
              dirty = true;
            } else if (scope._root.__lastDirtyWatch === watcher) {
              continueLoop = false;
              return false;
            }
          }
        } catch (err) {
          console.error(err);
        }
      });
      return continueLoop;
    });
    return dirty;
  }

  _digest() {
    let dirty: boolean = false;
    let ttl: number = maxTTL;
    this._root.__lastDirtyWatch = null;
    this.__beginPhase('_digest');

    if (this._root.__applyAsyncId) {
      clearTimeout(this._root.__applyAsyncId);
      this.__flushApplyAsync();
    }

    do {
      while (this.__asyncQueue.length) {
        try {
          const asyncTask = this.__asyncQueue.shift();
          asyncTask.scope._eval(asyncTask.expression);
        } catch (err) {
          console.error(err);
        }
      }
      dirty = this.__digestOnce();
      if (dirty || this.__asyncQueue.length) {
        ttl--;
        if (ttl < 0) {
          this.__clearPhase();
          throw new Error('Max digest iterations reached');
        }
      }
    } while (dirty || this.__asyncQueue.length);

    while (this.__postDigestQueue.length) {
      try {
        this.__postDigestQueue.shift()();
      } catch (err) {
        console.error(err);
      }
    }

    this.__clearPhase();
  }

  _new(isolated: boolean = false, parent?: Scope): Scope {
    if (!parent) parent = this;
    let child: Scope;
    if (isolated) {
      child = new Scope();
      child._root = parent._root;
      child.__asyncQueue = parent.__asyncQueue;
      child.__postDigestQueue = parent.__postDigestQueue;
      child.__applyAsyncQueue = parent.__applyAsyncQueue;
    } else {
      child = Object.create(this);
    }
    parent.__children.push(child);
    child.__watchers = [];
    child.__children = [];
    child.__listeners = {};
    child._parent = parent;
    return child;
  }

  __everyScope(fn: CallWith<Scope, boolean>): boolean {
    if (fn(this)) {
      return this.__children.every(child => child.__everyScope(fn));
    } else {
      return false;
    }
  }

  _destroy() {
    this._broadcast('_destroy');
    if (this._parent) {
      const siblings = this._parent.__children;
      const index = siblings.indexOf(this);
      if (index >= 0) {
        siblings.splice(index, 1);
      }
    }
    this.__watchers = [];
    this.__listeners = {};
  }
}

export default Scope;
