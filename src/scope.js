/* @flow */
import _ from 'lodash';

function areEqual(newValue: any, oldValue: any, valueEq: boolean) {
  if (valueEq) {
    return _.isEqual(newValue, oldValue);
  } else {
    return (newValue === oldValue) ||
      (_.isNaN(newValue) && _.isNaN(oldValue));
  }
}

function strictIsArrayLike(obj) {
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
  expression: CallWith<Scope, any>
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

const initWatchVal: AnyFunction = () => {};
const maxTTL: number = 10; // time to live

class Scope {
  $$watchers: Watcher[] = [];
  $$lastDirtyWatch: ?Watcher = null;
  $$asyncQueue: AsyncQueueItem[] = [];
  $$applyAsyncQueue: AnyFunction[] = [];
  $$applyAsyncId: ?number = null;
  $$phase: ?string = null;
  $$postDigestQueue: AnyFunction[] = [];
  $$children: Scope[] = [];
  $root: Scope = this;
  $parent: ?Scope = null;
  $$listeners: { [key: string]: (?ScopeEventListener)[] } = {};

  $on(eventName: string, listener: ScopeEventListener): AnyFunction {
    let listeners = this.$$listeners[eventName];
    if (!listeners) {
      this.$$listeners[eventName] = listeners = [];
    }
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners[index] = null;
      }
    };
  }

  $emit(eventName: string, ...args: any[]): ScopeEvent {
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
      scope.$$fireEventOnScope(eventName, event, args);
      scope = scope.$parent;
    } while (scope && !propagationStopped); // eslint-disable-line no-unmodified-loop-condition
    event.currentScope = null;
    return event;
  }

  $broadcast(eventName: string, ...args: any[]): ScopeEvent {
    const event: ScopeEvent = {
      name: eventName,
      targetScope: this,
      currentScope: this,
      defaultPrevented: false,
      preventDefault: () => {
        event.defaultPrevented = true;
      }
    };
    this.$$everyScope(scope => {
      event.currentScope = scope;
      scope.$$fireEventOnScope(eventName, event, args);
      return true;
    });
    event.currentScope = null;
    return event;
  }

  $$fireEventOnScope(eventName: string, event: ScopeEvent, args: any[]) {
    const listeners = this.$$listeners[eventName] || [];
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

  $$postDigest(fn: AnyFunction) {
    this.$$postDigestQueue.push(fn);
  }

  $apply(expr: CallWith<Scope, any>) {
    try {
      this.$beginPhase('$apply');
      return this.$eval(expr);
    } finally {
      this.$clearPhase();
      this.$root.$digest();
    }
  }

  $applyAsync(expr: CallWith<Scope, any>) {
    this.$$applyAsyncQueue.push(() => {
      this.$eval(expr);
    });
    if (this.$root.$$applyAsyncId === null) {
      this.$root.$$applyAsyncId = setTimeout(() => {
        this.$apply(() => {
          this.$$flushApplyAsync();
        });
      }, 0);
    }
  }

  $$flushApplyAsync() {
    while (this.$$applyAsyncQueue.length) {
      try {
        this.$$applyAsyncQueue.shift()();
      } catch (err) {
        console.error(err);
      }
    }
    this.$root.$$applyAsyncId = null;
  }

  $beginPhase(phase: string) {
    if (this.$$phase) {
      throw new Error(`${this.$$phase} already in progress.`);
    }
    this.$$phase = phase;
  }

  $clearPhase() {
    this.$$phase = null;
  }

  $eval(expr: CallWith<Scope, any>, locals?: any): any {
    return expr(this, locals);
  }

  $evalAsync(expr: CallWith<Scope, any>) {
    if (!this.$$phase && !this.$$asyncQueue.length) {
      setTimeout(() => {
        if (this.$$asyncQueue.length) {
          this.$root.$digest();
        }
      }, 0);
    }
    this.$$asyncQueue.push({
      scope: this,
      expression: expr
    });
  }

  $watch(watchFn: CallWith<Scope, any>, listenerFn?: ListenerFunction<any>, valueEq?: boolean = false): AnyFunction {
    const watcher: Watcher = {
      watchFn,
      listenerFn: listenerFn || (() => {}),
      valueEq,
      last: initWatchVal
    };
    this.$$watchers.unshift(watcher);
    this.$root.$$lastDirtyWatch = null;
    return () => {
      const index = this.$$watchers.indexOf(watcher);
      if (index >= 0) {
        this.$$watchers.splice(index, 1);
        this.$root.$$lastDirtyWatch = null;
      }
    };
  }

  $watchGroup(watchFns: CallWith<Scope, any>[], listenerFn?: ListenerFunction<any[]>): AnyFunction {
    const newValues: any[] = new Array(watchFns.length);
    const oldValues: any[] = new Array(watchFns.length);
    let changeReactionSchedules = false;
    let firstRun = true;

    if (watchFns.length === 0) {
      let shouldCall = true;
      this.$evalAsync(() => {
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
      return this.$watch(watchFn, (newValue, oldValue) => {
        newValues[i] = newValue;
        oldValues[i] = oldValue;
        if (!changeReactionSchedules) {
          changeReactionSchedules = true;
          this.$evalAsync(watchGroupListener);
        }
      });
    });

    return () => {
      _.each(destroyFns, destroyFn => {
        destroyFn();
      });
    };
  }

  $watchCollection(watchFn: CallWith<Scope, any>, listenerFn: ListenerFunction<any>): AnyFunction {
    let newValue, oldValue;
    let changeCount: number = 0;
    let oldLength: number;
    const trackVeryOldValue: boolean = listenerFn.length > 1;
    let veryOldValue;
    let firstRun: boolean = true;

    const internalWatchFn: CallWith<Scope, number> = (scope) => {
      let newLength;
      newValue = watchFn(scope);

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
            _.forOwn(oldValue, (oldValueVal, key) => {
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

    return this.$watch(internalWatchFn, internalListenerFn);
  }

  $$digestOnce(): boolean {
    let dirty: boolean = false;
    let continueLoop: boolean = true;
    this.$$everyScope(scope => {
      _.eachRight(scope.$$watchers, watcher => {
        try {
          if (watcher) {
            const newValue = watcher.watchFn(scope);
            const oldValue = watcher.last;
            if (!areEqual(newValue, oldValue, watcher.valueEq)) {
              scope.$root.$$lastDirtyWatch = watcher;
              watcher.last = watcher.valueEq ? _.cloneDeep(newValue) : newValue;
              watcher.listenerFn(newValue,
                (oldValue === initWatchVal ? newValue : oldValue),
                scope);
              dirty = true;
            } else if (scope.$root.$$lastDirtyWatch === watcher) {
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

  $digest() {
    let dirty: boolean = false;
    let ttl: number = maxTTL;
    this.$root.$$lastDirtyWatch = null;
    this.$beginPhase('$digest');

    if (this.$root.$$applyAsyncId) {
      clearTimeout(this.$root.$$applyAsyncId);
      this.$$flushApplyAsync();
    }

    do {
      while (this.$$asyncQueue.length) {
        try {
          const asyncTask = this.$$asyncQueue.shift();
          asyncTask.scope.$eval(asyncTask.expression);
        } catch (err) {
          console.error(err);
        }
      }
      dirty = this.$$digestOnce();
      if (dirty || this.$$asyncQueue.length) {
        ttl--;
        if (ttl < 0) {
          this.$clearPhase();
          throw new Error('Max digest iterations reached');
        }
      }
    } while (dirty || this.$$asyncQueue.length);

    while (this.$$postDigestQueue.length) {
      try {
        this.$$postDigestQueue.shift()();
      } catch (err) {
        console.error(err);
      }
    }

    this.$clearPhase();
  }

  $new(isolated: boolean = false, parent?: Scope): Scope {
    if (!parent) parent = this;
    let child: Scope;
    if (isolated) {
      child = new Scope();
      child.$root = parent.$root;
      child.$$asyncQueue = parent.$$asyncQueue;
      child.$$postDigestQueue = parent.$$postDigestQueue;
      child.$$applyAsyncQueue = parent.$$applyAsyncQueue;
    } else {
      child = Object.create(this);
    }
    parent.$$children.push(child);
    child.$$watchers = [];
    child.$$children = [];
    child.$$listeners = {};
    child.$parent = parent;
    return child;
  }

  $$everyScope(fn: CallWith<Scope, boolean>): boolean {
    if (fn(this)) {
      return this.$$children.every(child => child.$$everyScope(fn));
    } else {
      return false;
    }
  }

  $destroy() {
    this.$broadcast('$destroy');
    if (this.$parent) {
      const siblings = this.$parent.$$children;
      const index = siblings.indexOf(this);
      if (index >= 0) {
        siblings.splice(index, 1);
      }
    }
    this.$$watchers = [];
    this.$$listeners = {};
  }
}

export default Scope;
