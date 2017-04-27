import bluebird from 'bluebird';
import redis from 'redis';

export default redis.createClient(process.env.REDIS_URL);

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);
