/*
 * Middleware to automatically cache routes to Redis.
 * Initialize it in a beforeAction and afterAction hook.
 */

let currentCacheKey = Date.now();

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
    naiveCacheExpiry = true,
    enabled = true
  } = options;

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
        let key = `${cacheKey}:${model.modelName}:${path}`;

        if(naiveCacheExpiry){
          key += `:${currentCacheKey}`;
        }

        key += `:${new Buffer.from(JSON.stringify(params)).toString('base64')}`;

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
          request.cacheToRedis = key;
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
    const {
      action,
      cacheToRedis
    } = request;

    if(cacheToRedis && redis.connected){
      let args = [cacheToRedis, JSON.stringify(payload)];
      if(expiresIn > 0){
        args.push('EX', expiresIn);
      }

      redis.set(args);
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
