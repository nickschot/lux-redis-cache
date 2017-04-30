/*
 * [WIP] Relationship Based Cache Expiry
 */


// a mapping from model names to their current cache keys
const currentCacheKeys = new WeakMap();

export function buildKey(cacheKey, request) {
  const {
    params,
    controller: {
      model
    },
    route: {
      path
    }
  } = request;

  // add current model to the map of cache keys if it doesn't exist yet
  if(!currentCacheKeys.has(model.modelName)){
    currentCacheKeys.set(model.modelName, Date.now());
  }

  return `${cacheKey}:${model.modelName}:${path}:${currentCacheKeys.get(model.modelName)}:${
    new Buffer.from(JSON.stringify(params)).toString('base64')
  }`;
}

export function expireKeys(request, payload){
  const {
    action,
    controller: {
      model
    }
  } = request;

  if(
    action === 'update'
    || action === 'create'
    || action === 'destroy'
  ) {
    //TODO: update necessary cache keys
  }
}
