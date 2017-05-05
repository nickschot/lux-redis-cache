/*
 * Time Based Cache
 */

export function buildKey(cacheKey, request) {
  const {
    url: {
      path
    },
    controller: {
      model
    }
  } = request;

  return `${cacheKey}:${model.modelName}:${path}`;
}

export function expireKeys(request, payload){
  // noop as we rely on the redis expiration time here
}
