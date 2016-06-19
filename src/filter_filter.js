/* @flow */
import _ from 'lodash';
import { register } from './filter';

type Predicate<T> = (u: T) => boolean;
type Compare<T> = (u: T, v: T) => boolean;

type AccpetedLiteral = Object | string | number | boolean | null;

type FilterFilterFunction<T> = (arr: T[], filterExpr: (Predicate<T> | AccpetedLiteral), comparator?: Compare) => T[];

function deepCompare(actual: any, expected: any, comparator: Compare,
  matchAnyProperty: boolean = false, isWildcard: boolean = false): boolean {
  if (_.isString(expected) && expected.startsWith('!')) {
    return !deepCompare(actual, expected.substring(1), comparator, matchAnyProperty);
  }
  if (_.isArray(actual)) {
    return _.some(actual, actualItem => deepCompare(actualItem, expected, comparator, matchAnyProperty));
  }
  if (_.isObject(actual)) {
    if (_.isObject(expected) && !isWildcard) {
      return _.every(
        _.toPlainObject(expected),
        (expectedVal, expectedKey) => {
          if (_.isUndefined(expectedVal)) return true;
          const isWildcard = expectedKey === '$';
          const actualVal = isWildcard ? actual : actual[expectedKey];
          return deepCompare(actualVal, expectedVal, comparator, isWildcard, isWildcard);
        }
      );
    } else if (matchAnyProperty) {
      return _.some(actual, (value, key) => deepCompare(value, expected, comparator, matchAnyProperty));
    } else {
      return comparator(actual, expected);
    }
  } else {
    return comparator(actual, expected);
  }
}

function basicComparator(item: AccpetedLiteral, expected: AccpetedLiteral): boolean {
  if (_.isUndefined(item)) {
    return false;
  }
  if (_.isNull(expected) || _.isNull(item)) {
    return item === expected;
  }
  const itemStr = ('' + (item: any)).toLowerCase();
  const expectedStr = ('' + (expected: any)).toLowerCase();
  return itemStr.indexOf(expectedStr) !== -1;
}

function createPredicateFn(expression: AccpetedLiteral, comparator?: Compare | true): Predicate {
  const shouldMatchPrimitives = _.isObject(expression) && _.has((expression: any), '$');
  if (comparator === true) {
    comparator = _.isEqual;
  }
  if (!_.isFunction(comparator)) {
    comparator = basicComparator;
  }
  return item => {
    if (shouldMatchPrimitives && !_.isObject(item)) {
      return deepCompare(item, (expression: any).$, (comparator: any));
    }
    return deepCompare(item, expression, (comparator: any), true);
  };
}

function filterFilter(): FilterFilterFunction<any> {
  return (arr, filterExpr, comparator) => {
    let predicateFn: Predicate;
    if (_.isFunction(filterExpr)) {
      predicateFn = (filterExpr: any);
    } else if (_.isString(filterExpr) || _.isNumber(filterExpr) ||
              _.isBoolean(filterExpr) || _.isNull(filterExpr) || _.isObject(filterExpr)) {
      predicateFn = createPredicateFn((filterExpr: any), comparator);
    } else {
      return arr;
    }
    return _.filter(arr, predicateFn);
  };
}

register('filter', filterFilter);
