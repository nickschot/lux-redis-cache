import * as naiveCacheExpiry from './cache-engines/naive-cache-expiry';
import * as relationshipBasedCacheExpiry from './cache-engines/relationship-based-cache-expiry';
import * as timeBased from './cache-engines/time-based';
/*
 * Middleware to automatically cache routes to Redis.
 * Initialize it in a beforeAction and afterAction hook.
 */

const requestKey = 'luxRedisCache';
const cacheEngines = new Map([
  ['naiveCacheExpiry', naiveCacheExpiry],
  ['relationshipBasedCacheExpiry', relationshipBasedCacheExpiry],
  ['timeBased', timeBased]
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
    enabled = true,
    expiresIn = -1
  } = options;

  if(cacheEngine && !cacheEngines.has(cacheEngine)){
    throw new Error('lux-redis-cache: Incorrect cache engine specified');
  }

  const cacheEngineInstance = cacheEngines.get(cacheEngine);

  return async (request, response) => {
    const {
      method,
      action,
      route: {
        path
      }
    } = request;

    if(enabled && method !== 'OPTIONS'){
      // pass options and cache engine instance in request to make sure the same
      // ones are used in this action cycle
      request[requestKey] = {
        cacheEngineInstance: cacheEngineInstance,
        redisInstance: redis,
        enabled: enabled,
        expiresIn: expiresIn
      };

      if(method === 'GET' && (action === 'index' || action === 'show')){
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

          if(payload) {
            return JSON.parse(payload);
          } else {
            request[requestKey].key = key;
          }
        }
      }
    }
  };
}

/**
 * Method meant to be used in any place where you wan't to add something to
 * redis. Most likely the `afterAction` controller hook.
 * @returns {function(*, *, *=)}
 */
export function addToRedis(){
  return (request, response, payload) => {
    const {
      method
    } = request;

    if(method !== 'OPTIONS'){
      if(!request[requestKey]){
        throw new Error(`lux-redis-cache: No lux-redis-cache options found on
         the request object. Make sure you added getFromRedis in the right 
         place!`);
      }

      if(request[requestKey].enabled){
        const redis               = request[requestKey].redisInstance;
        const cacheEngineInstance = request[requestKey].cacheEngineInstance;
        const expiresIn           = request[requestKey].expiresIn;
        const key                 = request[requestKey].key;

        if(key && redis.connected){
          let args = [key, JSON.stringify(payload)];
          if(expiresIn > 0){
            args.push('EX', expiresIn);
          }

          redis.set(args);
        } else if(cacheEngineInstance) {
          cacheEngineInstance.expireKeys(request, payload);
        }
      }
    }

    return payload;
  }
}
