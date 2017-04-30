import * as naiveCacheExpiry from './cache-engines/naive-cache-expiry';
import * as relationshipBasedCacheExpiry from './cache-engines/relationship-based-cache-expiry';

/*
 * Middleware to automatically cache routes to Redis.
 * Initialize it in a beforeAction and afterAction hook.
 */

const requestKey = 'luxRedisCache';
const cacheEngines = new Map([
  ['naiveCacheExpiry', naiveCacheExpiry],
  ['relationshipBasedCacheExpiry', relationshipBasedCacheExpiry]
]);

/**
 * Method meant to be used in any place where you wan't to retrieve something
 * from redis. Most likely the `beforeAction` controller hook.
 * @param redis A node-redis instance
 * @param options May contain a naiveCacheExpiry option (default: true)
 * @returns {function(*, *)}
 */
export function getFromRedis(redis, options = {}) {
  const {
    cacheKey = 'cache',
    cacheEngine = 'naiveCacheExpiry',
    enabled = true
  } = options;

  const cacheEngineInstance = cacheEngines.get(cacheEngine);

  return async (request, response) => {
    const {
      method,
      action,
      route: {
        path
      }
    } = request;

    if(enabled && method === 'GET' && (action === 'index' || action === 'show')){
      const {
        params,
        controller: {
          model
        }
      } = request;

      // only cache controllers with model for now
      if(model && redis.connected){
        let key;

        if(cacheEngineInstance){
          key = cacheEngineInstance.buildKey(cacheKey, request);
        } else {
          key = `${cacheKey}:${model.modelName}:${path}:${
            new Buffer.from(JSON.stringify(params)).toString('base64')
          }`
        }

        const payload = await new Promise((resolve, reject) => {
          redis.get(key, (err, payload) => {
            if(err){
              reject(err);
            } else {
              resolve(payload);
            }
          });
        });

        // pass cache engine instance in request to make sure the same one is
        // used in this action cycle
        request[requestKey] = {
          cacheEngineInstance: cacheEngineInstance
        };

        if(payload) {
          return JSON.parse(payload);
        } else {
          request[requestKey].key = key;
        }
      }
    }
  };
}

/**
 * Method meant to be used in any place where you wan't to add something to
 * redis. Most likely the `afterAction` controller hook.
 * @param redis A node-redis instance
 * @param options May contain an expiresIn number in seconds in order to set a
 * cache expiry
 * @returns {function(*, *, *=)}
 */
export function addToRedis(redis, options = {}){
  const {
    expiresIn = -1
  } = options;

  return async (request, response, payload) => {
    const key = request[requestKey]
      ? request[requestKey].key
      : null;
    const cacheEngineInstance = request[requestKey]
      ? request[requestKey].cacheEngineInstance
      : null;

    if(key && redis.connected){
      let args = [key, JSON.stringify(payload)];
      if(expiresIn > 0){
        args.push('EX', expiresIn);
      }

      redis.set(args);
    } else if(cacheEngineInstance) {
      cacheEngineInstance.expireKeys(request, payload);
    }

    return payload;
  }
}
