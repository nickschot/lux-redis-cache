# lux-redis-cache
Middleware based cache implementation using Redis for [Lux](https://github.com/postlight/lux).

## Install

    $ npm i --save lux-redis-cache redis

## Usage
lux-redis-cache is, as the name implies, a caching middleware for lux using redis. Two middlewares which are to be used in a Lux controller are exposed: `getFromRedis` and `addToRedis`. They will cache any `GET` request on the `index` and `show` controller actions.

It is recommended to use one of the available cache engines. They are outlined in the next section. By default the middlewares are configured as a naïve cache with implicit expiry.

Another option is to use a simple timed expiration. You can disable the naïve cache expiration and set an expiration time in seconds. This does mean the returned data is not necessarily up-to-date.

### Cache engines
lux-redis-cache comes with two (optional) cache engines. They are outlined below. For all engines you can optionally set an explicit expiration time by passing the expiresIn option to the `getFromRedis` method. When using one of the cache engines it is recommended to set an automatic eviction policy like `allkeys-lru` in redis with this engine so everything will continue to work when redis is filled up.

#### Naïve Cache Expiry (default)
This engine keeps a cache key which is updated on a create/update/destroy action. This means the cache engine will always return up-to-date data.

#### Relationship Based Cache Expiry
This is a more efficient variant of the Naïve Cache Expiry. It works in the same manner but instead of a single expiry key it keeps expiration keys for each model.

The cache expiration works as follows for the different actions.
- **Create/Update action:** expire the model and direct belongsTo and hasMany relationships
- **Destroy:** expire the whole cache, the database could be configured to CASCADE on delete, so we don't know what needs to be expired

#### Time Based Cache
This is a very simple cache strategy which just caches data. It can be enhanced with time based expiration by setting the `expiresIn` option passed into `getFromRedis`.  No cache invalidation is provided with this strategy. This engine will not always return up-to-date data.

### getFromRedis(redis, options)
`getFromRedis` is meant to be used in a `beforeAction` hook. It will try to get data from redis for any `GET` request from on an `index` or `show` controller action. It will immediately return the payload while the action/afterAction is skipped.

- **redis** - A connected node-redis instance
- **options** - Options object
  - **cacheKey** *(default: 'cache')* - The name of the top level key for redis
  - **cacheEngine** *(default: 'naiveCacheExpiry')* - Set to false, 'naiveCacheExpiry' or 'relationshipBasedCacheExpiry'
  - **enabled** *(default: true)* - Set to false to disable caching entirely
  - **expiresIn** *(default: -1)* - An expiration time in seconds

### addToRedis(redis, options)
`addToRedis` is meant to be used in an `afterAction` hook. It will add the response data to redis if the `getFromRedis` middleware detected the cache entry was missing. No options can or need to be passed to this method. `getFromRedis` will share the necessary options.

## Graceful failover
If redis becomes unavailable, the middleware will gracefully skip itself so your lux application will continue to work (albeit without redis). In order to keep your application from crashing when redis loses connection you must listen to errors on your node-redis instance and handle them. An example on how to do this is shown below.

```javascript
// app/utils/redis.js
import { createClient } from 'redis';

// try to connect to REDIS_URL env variable or localhost
const client = createClient(process.env.REDIS_URL || {});

client.on('error', function(e){
    console.error('redis-cache', e);
});

export default client;
```

## Example
An example of using redis API-wide is shown below.

```javascript
// app/controllers/application.js
import redis from 'app/utils/redis'
import { getFromRedis, addToRedis } from 'lux-redis-cache';

class ApplicationController extends Controller {
  beforeAction = [
      getFromRedis(redis)
  ];

  afterAction = [
      addToRedis()
  ];
}

export default ApplicationController;
```

```javascript
// app/utils/redis.js
import { createClient } from 'redis';

// try to connect to REDIS_URL env variable or localhost
const client = createClient(process.env.REDIS_URL || {});

client.on('error', function(e){
    console.error('redis-cache', e);
});

export default client;
```

The middleware can also be used in specific controllers in the same way. It is recommended not to nest redis usage (i.e. a parent and child controller both having the middlewares in their hooks).

Finally you can use [lux-unless](https://github.com/nickschot/lux-unless) to exclude certain routes from being cached. It is not necessary to explicitly skip requests which are not `GET` combined with an `index` or `show` action, as those are the only ones the middleware will listen to.

## Note
The current version of this middleware only caches on the `index` and `show` action for controllers which have a model associated with them. Other controllers and actions are not cached yet.

## Related Modules

- [lux-unless](https://github.com/nickschot/lux-unless) - Conditionally skip a middleware.

## Tests

    $ npm install
    $ npm test

## License
This project is licensed under the MIT license. See the [LICENSE](LICENSE) file for more info.
