import _ from 'lodash'

const initWatchVal = () => {}
const maxTTL = 10 // time to live

function areEqual (newValue, oldValue, valueEq) {
  if (valueEq) {
    return _.isEqual(newValue, oldValue)
  } else {
    return (newValue === oldValue) ||
      (_.isNaN(newValue) && _.isNaN(oldValue))
  }
}

class Scope {
  $$watchers = []
  $$lastDirtyWatch = null
  $$asyncQueue = []
  $$applyAsyncQueue = []
  $$applyAsyncId = null
  $$phase = null
  $$postDigestQueue = []

  $$postDigest (fn) {
    this.$$postDigestQueue.push(fn)
  }

  $apply (expr) {
    try {
      this.$beginPhase('$apply')
      return this.$eval(expr)
    } finally {
      this.$clearPhase()
      this.$digest()
    }
  }

  $applyAsync (expr) {
    this.$$applyAsyncQueue.push(() => {
      this.$eval(expr)
    })
    if (this.$$applyAsyncId === null) {
      this.$$applyAsyncId = setTimeout(() => {
        this.$apply(() => {
          this.$flushApplyAsync()
        })
      }, 0)
    }
  }

  $flushApplyAsync () {
    while (this.$$applyAsyncQueue.length) {
      try {
        this.$$applyAsyncQueue.shift()()
      } catch (err) {
        console.error(err)
      }
    }
    this.$$applyAsyncId = null
  }

  $beginPhase (phase) {
    if (this.$$phase) {
      throw new Error(`${this.$$phase} already in progress.`)
    }
    this.$$phase = phase
  }

  $clearPhase () {
    this.$$phase = null
  }

  $eval (expr, locals) {
    return expr(this, locals)
  }

  $evalAsync (expr) {
    if (!this.$$phase && !this.$$asyncQueue.length) {
      setTimeout(() => {
        if (this.$$asyncQueue.length) {
          this.$digest()
        }
      }, 0)
    }
    this.$$asyncQueue.push({
      scope: this,
      expression: expr
    })
  }

  $watch (watchFn, listenerFn, valueEq = false) {
    const watcher = {
      watchFn,
      listenerFn: listenerFn || (() => {}),
      valueEq,
      last: initWatchVal
    }
    this.$$watchers.unshift(watcher)
    this.$$lastDirtyWatch = null
    return () => {
      const index = this.$$watchers.indexOf(watcher)
      if (index >= 0) {
        this.$$watchers.splice(index, 1)
        this.$$lastDirtyWatch = null
      }
    }
  }

  $watchGroup (watchFns, listenerFn) {
    const newValues = new Array(watchFns.length)
    const oldValues = new Array(watchFns.length)
    let changeReactionSchedules = false
    let firstRun = true

    if (watchFns.length === 0) {
      let shouldCall = true
      this.$evalAsync(() => {
        if (shouldCall) {
          listenerFn(newValues, newValues, this)
        }
      })
      return () => {
        shouldCall = false
      }
    }

    const watchGroupListener = () => {
      if (firstRun) {
        firstRun = false
        listenerFn(newValues, newValues, this)
      } else {
        listenerFn(newValues, oldValues, this)
      }
      changeReactionSchedules = false
    }

    const destroyFns = _.map(watchFns, (watchFn, i) => {
      return this.$watch(watchFn, (newValue, oldValue) => {
        newValues[i] = newValue
        oldValues[i] = oldValue
        if (!changeReactionSchedules) {
          changeReactionSchedules = true
          this.$evalAsync(watchGroupListener)
        }
      })
    })

    return () => {
      _.each(destroyFns, destroyFn => {
        destroyFn()
      })
    }
  }

  $digestOnce () {
    let dirty = false
    _.eachRight(this.$$watchers, watcher => {
      try {
        if (watcher) {
          const newValue = watcher.watchFn(this)
          const oldValue = watcher.last
          if (!areEqual(newValue, oldValue, watcher.valueEq)) {
            this.$$lastDirtyWatch = watcher
            watcher.last = watcher.valueEq ? _.cloneDeep(newValue) : newValue
            watcher.listenerFn(newValue,
              (oldValue === initWatchVal ? newValue : oldValue),
              this)
            dirty = true
          } else if (this.$$lastDirtyWatch === watcher) {
            return false
          }
        }
      } catch (err) {
        console.error(err)
      }
    })
    return dirty
  }

  $digest () {
    let dirty = false
    let ttl = maxTTL
    this.$$lastDirtyWatch = null
    this.$beginPhase('$digest')

    if (this.$$applyAsyncId) {
      clearTimeout(this.$$applyAsyncId)
      this.$flushApplyAsync()
    }

    do {
      while (this.$$asyncQueue.length) {
        try {
          const asyncTask = this.$$asyncQueue.shift()
          asyncTask.scope.$eval(asyncTask.expression)
        } catch (err) {
          console.error(err)
        }
      }
      dirty = this.$digestOnce()
      if (dirty || this.$$asyncQueue.length) {
        ttl--
        if (ttl < 0) {
          this.$clearPhase()
          throw new Error('Max digest iterations reached')
        }
      }
    } while (dirty || this.$$asyncQueue.length)

    while (this.$$postDigestQueue.length) {
      try {
        this.$$postDigestQueue.shift()()
      } catch (err) {
        console.error(err)
      }
    }

    this.$clearPhase()
  }
}

export default Scope
