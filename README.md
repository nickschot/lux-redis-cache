# lux-redis-cache
Middleware based cache implementation using Redis for [Lux](https://github.com/postlight/lux).

## Install

    $ npm i --save lux-redis-cache

## Usage

Here is an example of a api wide implementation of the middleware, excluding specific routes.  and a basic redis util to pass into the middleware.  Currently you must initialize and provide your own promisifyAll'd redis client instance.


app/controllers/application.js

```js
import { Controller } from 'lux-framework';
import unless from 'lux-unless';
import redis from 'app/utils/redis';
import { getFromRedis, addToRedis } from 'lux-redis-cache';

const { REDIS_CACHE_EXPIRES_IN = 600 } = process.env; // 600 = 10 minutes

const pathsToNotCache = [
  '/auth/login',
  '/auth/token-refresh',
  /product-(variants|separates)/gi,
  /sync-logs/gi
];

class ApplicationController extends Controller {
  beforeAction = [
    ...,
    unless({
      path: pathsToNotCache,
      method: ['OPTIONS']
    }, getFromRedis({
      naiveCacheExpiry: false,
      redis
    }))
  ];
  afterAction = [
    ...
    addToRedis({ expiresIn: REDIS_CACHE_EXPIRES_IN })
  ];
}

export default ApplicationController;
```


// app/utils/redis.js

```js
// load your env vars if needed.
// import dotenv from './dotenv';
// dotenv();

import bluebird from 'bluebird';
import redis from 'redis';
let client;

if (typeof client !== 'object') {
  const {
    REDIS_HOST,
    REDIS_PORT
  } = process.env;

  try {
    client = redis.createClient(REDIS_PORT, REDIS_HOST);
  } catch (e) {
    debug('exception creating client: ', e);
  }

  bluebird.promisifyAll(redis.RedisClient.prototype);
  bluebird.promisifyAll(redis.Multi.prototype);
}


export default client;
```


## Related Modules

- [lux-unless](https://github.com/nickschot/lux-unless) - Conditionally skip a middleware.

## Tests

    $ npm install
    $ npm test

## License
This project is licensed under the MIT license. See the [LICENSE](LICENSE) file for more info.
