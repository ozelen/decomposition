'use strict';
/**
 * Cache Factory
 * Stateful factory for caching event data
 */
angular.module('app').
  factory('cacheFactory', function($q, timeFactory){
    /**
     * Cache object
     * @type {{events: {}, coupons: {}, eventsList: {}}}
     */
    var storedData = {};

    return {
      store: store,
      stored: stored,
      async: async,
      interval: interval,
    };

    /**
     * Caches the data passed in the last argument to the
     * runtime cache structure in two steps:
     * 1. Create a nested data structure with data inside,
     * 2. Merges it to stored data.
     * If the data already exists by this path, it should be
     * overwritten.
     * @return {[type]} [description]
     */
    function store () {
      var args   = [].slice.apply(arguments), // to array
          path   = args.slice(0, -1),
          source = pack(args);
      merge(storedData, source);
      return stored.apply(null, path);
    }

    /**
     * Creates a hierarchical object from provided array,
     * each element of it defines a folding level,
     * and the last one gets stored in the structure.
     * @param  {Array} path   Mixed array, last element is the data
     * @return {Object}       Packed object
     */
    function pack (path) {
      path = path.slice(0);
      var obj = {}, arg = path.splice(0,1)[0];
      obj[arg] = path.length > 0 ? pack(path) : undefined;
      return obj[arg] ? obj : new Cached(arg);
    }

    /**
     * Cached object constructor
     * @param {Object} data Cached data
     */
    function Cached (data) {
      _.extend(this, {
        data: data,
        updated: timeFactory.getCurrentTime()
      });
    }

    /**
     * Recursively merges source objects into target,
     * by modifying the first one.
     * It overwrites existing data endpoint.
     * @param  {Object} target target object
     * @param  {Object} source source object
     * @return {undefined}
     */
    function merge (target, source) {
      _.each(_.keys(source), function (key) {
        target[key] = source[key] instanceof Cached ?
          source[key] : target[key] || source[key];
        merge(target[key], source[key]);
      });
    }

    /**
     * A facade method of `dive` function, also checks
     * the existance of cached data
     * @return {[type]} [description]
     */
    function stored () {
      var args   = [].slice.apply(arguments),
          cached = dive(args, storedData);
      return cached && cached instanceof Cached ? // TODO: addinterval check
        cached.data : undefined;
    }

    /**
     * Recursively following the path in the deep
     * of the object and returns the remainder.
     * @param  {[type]} args [description]
     * @param  {[type]} obj  [description]
     * @return {[type]}      [description]
     */
    function dive (path, obj) {
      path = path.slice(0);
      var key  = path.shift();
      return !obj ? undefined :
        path.length > 0 ?
          dive(path, obj[key]) : obj[key];
    }

    /**
     * Wraps the plain data into promise
     * @param  {Object}       data Any data
     * @return {promise}      deferred data
     */
    function async (data) {
      var defer = $q.defer();
      defer.resolve(data);
      return defer.promise;
    }

    function interval (date) {
      var key = date === 'live' ?
        'eventsByClasses' : 'liveEvent';

      return timeFactory.apiDataCacheInterval[key];
    }
  });
