# lux-redis-cache
Middleware based cache implementation using Redis for [Lux](https://github.com/postlight/lux).

## Install

    $ npm i --save lux-redis-cache redis

## Usage
lux-redis-cache is, as the name implies, a caching middleware for lux using redis. Two middlewares which are to be used in a Lux controller are exposed: `getFromRedis` and `addToRedis`. They will cache any `GET` request on the `index` and `show` controller actions.

By default the middlewares are configured as a naïve cache with implicit expiry. This means the cache will always return up-to-date data. It is recommended to set an automatic eviction policy like `allkeys-lru` in redis with this default setup so everything will continue to work when redis is filled up.

Another option is to use a simple timed expiration. You can disable the naïve cache expiration and set an expiration time in seconds. This does mean the returned data is not necessarily up-to-date.

### getFromRedis(redis, options)
`getFromRedis` is meant to be used in a `beforeAction` hook. It will try to get data from redis for any `GET` request from on an `index` or `show` controller action. It will immediately return the payload while the action/afterAction is skipped.

- **redis** - A connected node-redis instance
- **options** - Options object
  - **cacheKey** *(default: 'cache')* - The name of the top level key for redis
  - **naiveCacheExpiry** *(default: true)* - Set to false to disable naïve cache expiry
  - **enabled** *(default: true)* - Set to false to disable cache entirely

### addToRedis(redis, options)
`addToRedis` is meant to be used in an `afterAction` hook. It will add the response data to redis if the `getFromRedis` middleware detected the cache entry was missing. You can also pass an expiration time in the options object in order for your cache entries to expire in a certain number of seconds. This is meant mainly for when you don't use the naïve cache expiry.

- **redis** - A connected node-redis instance
- **options** - Options object
  - **expiresIn** *(default: -1)* - An expiration time in seconds

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

beforeAction = [
    getFromRedis(redis)
];

afterAction = [
    addToRedis(redis)
];

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
