const { has } = Reflect;
/*
 * Middleware to automatically cache routes to Redis.
 * Initialize it in a beforeAction and afterAction hook.
 */

let currentCacheKey = Date.now();
const cacheKey = 'cache';
let _redis, get, set, scan, del;

function initializeRedis(redis) {
  if (!redis) {
    throw new Error('must provide valid redis instance.');
  }

  _redis = redis;

  if (!has(_redis, 'set')) {
    throw new Error('we expected redis to have a set function!');
  }

  set = _redis.set;

  if (has(_redis, 'getAsync')) {
    get = _redis.getAsync;
  } else {
    get = function(key) {
      return new Promise((resolve, reject) => {
        _redis.get(key).then(resolve).catch(reject);
      });
    };
  }

  if (has(_redis, 'scanAsync')) {
    scan = _redis.scanAsync;
  } else {
    scan = function() {
      return new Promise((resolve, reject) => {
        _redis.scan(...arguments).then(resolve).catch(reject);
      });
    };
  }

  if (has(_redis, 'delAsync')) {
    del = _redis.delAsync;
  } else {
    del = function() {
      return new Promise((resolve, reject) => {
        _redis.del(...arguments).then(resolve).catch(reject);
      });
    };
  }
}

/**
 * Method meant to be used in any place where you wan't to retrieve something
 * from redis. Most likely the `beforeAction` controller hook.
 * @param options
 * @returns {function(*, *)}
 */
export function getFromRedis(options = {}) {
  const {
    naiveCacheExpiry = true,
    redis
  } = options;

  // initializeRedis is broken still. :(
  // initializeRedis(redis);

  _redis = redis;

  return async (request, response) => {
    const {
      method,
      action,
      route: {
        path
      }
    } = request;

    if(method === 'GET' && (action === 'index' || action === 'show')){
      const {
        params,
        controller: {
          model
        }
      } = request;

      // only cache controllers with model for now
      if(model){
        let key = `${cacheKey}:${model.modelName}:${path}`;

        if(naiveCacheExpiry){
          key += `:${currentCacheKey}`;
        }

        key += `:${new Buffer.from(JSON.stringify(params)).toString('base64')}`;

        const payload = await _redis.getAsync(key);

        if(payload){
          return JSON.parse(payload);
        } else {
          request.cacheToRedis = key;
        }
      }
    }
  };
}

/**
 * Method meant to be used in any place where you wan't to add something to
 * redis. Most likely the `afterAction` controller hook.
 * @param options May contain an expiresIn number in seconds in order to set a
 * cache expiry
 * @returns {function(*, *, *=)}
 */
export function addToRedis(options = {}){
  const {
    expiresIn = 0,
    redis
  } = options;

  return async (request, response, payload) => {
    const {
      action,
      cacheToRedis
    } = request;

    if(cacheToRedis){
      let args = [cacheToRedis, JSON.stringify(payload)];
      if(expiresIn){
        args.push('EX', expiresIn);
      }

      _redis.set(args);
    } else if(
         action === 'update'
      || action === 'create'
      || action === 'destroy'
    ){
      currentCacheKey = Date.now();
    }

    return payload;
  }
}

/** @Deprecated
 * Meant to delete all keys which start with a given model name. Most likely to
 * be used in the `afterSave` and `afterDestroy` hooks in models.
 *
 * NOTE: you likely do not want to return or await this in a hook as it may take
 * some time to run.
 *
 * @param modelName The name of the model for which the keys need to be deleted.
 * @returns {Promise.<void>}
 */
 export async function modelAfterSaveDeleteFromRedis(modelName){
   let cursor = '0';
   let keys = [];
   // console.log('cleaning up model: ', modelName);
   do {
     let result =  await _redis.scanAsync(
       cursor,
       'MATCH',
       `${cacheKey}:${modelName}:*`
     );

     cursor = result[0];
     keys = keys.concat(result[1]);
   } while (cursor !== '0');

   if (keys && keys.length > 0) {
     _redis.delAsync(keys);
   }

 }

// /**
//  * Export the redis client
//  */
// export { redis };
