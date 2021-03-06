/*
 * Relationship Based Cache Expiry
 */

import { dasherize, singularize } from 'inflection';


// a mapping from model names to their current cache keys
const currentCacheKeys = new Map();

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

  return `${cacheKey}:${model.modelName}:${path}:${
    currentCacheKeys.get(model.modelName)
  }:${
    new Buffer.from(JSON.stringify(params)).toString('base64')
  }`;
}

export function expireKeys(request, payload, response){
  const {
    action,
    controller: {
      model
    }
  } = request;

  if(action === 'create' || action === 'update'){
    // expire the model and it's relationships
    const belongsToModelNames = Object.values(model.belongsTo)
      .map(relationship => relationship.model.modelName);
    const hasManyModelNames = Object.values(model.hasMany)
      .map(relationship => relationship.model.modelName);

    const relationshipModelNames = new Set(
      belongsToModelNames.concat(hasManyModelNames)
    );

    currentCacheKeys.delete(model.modelName);
    relationshipModelNames.forEach((relationshipModelName) => {
      currentCacheKeys.delete(relationshipModelName);
    });
  } else if(action === 'destroy'){
    // expire everything, we can't know whether or not the database CASCADE's
    currentCacheKeys.clear();
  }
}
