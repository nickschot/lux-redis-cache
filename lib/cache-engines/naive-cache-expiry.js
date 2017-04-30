/*
 * Naïve Cache Expiry
 */

let currentCacheKey = Date.now();

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

  return `${cacheKey}:${model.modelName}:${path}:${currentCacheKey}:${
    new Buffer.from(JSON.stringify(params)).toString('base64')
  }`;
}

export function expireKeys(request, payload){
  const {
    action
  } = request;

  if(
    action === 'update'
    || action === 'create'
    || action === 'destroy'
  ) {
    currentCacheKey = Date.now();
  }
}
