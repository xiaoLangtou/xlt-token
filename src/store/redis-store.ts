import { XltTokenStore } from './xlt-token-store.interface';
import { Inject, Injectable } from '@nestjs/common';


export  const XLT_REDIS_CLIENT = 'XLT_REDIS_CLIENT';


@Injectable()
export  class RedisStore implements XltTokenStore {

  constructor(
    @Inject(XLT_REDIS_CLIENT)
    private readonly redisClient: any,
  ) {

  }


  async get(key:string):Promise<string | null> {
    return this.redisClient.get(key);
  }


  async set(key:string, value:string, timeoutSec:number):Promise<void> {
    if (timeoutSec === -1){
      await this.redisClient.set(key, value);
    }else {
      await this.redisClient.set(key, value, {EX: timeoutSec});
    }
  }


  async delete(key:string):Promise<void> {
    await this.redisClient.del(key);
  }


  async update(key:string, value:string):Promise<void> {
    const result = await this.redisClient.set(key, value,{XX:true,KEEPTTL:true})
    if (result ===null){
      throw new Error(`Key not found: ${key}`);
    }
  }


  async has(key:string):Promise<boolean> {
    const result = await this.redisClient.exists(key);
    return result === 1;
  }


  async updateTimeout(key:string, timeoutSec:number):Promise<void> {
    const exists =  await  this.redisClient.exists(key);

    if (!exists) {
      throw new Error(`Key not found: ${key}`);
    }

    if (timeoutSec === -1) {
      await this.redisClient.persist(key);
    }else {
      await this.redisClient.expire(key, timeoutSec);
    }

  }

  async getTimeout(key:string):Promise<number> {
    const result = await this.redisClient.ttl(key);
    // Redis TTL 返回值约定：
    // -2 = key 不存在
    // -1 = key 存在但无过期时间（永久）
    // >0 = 剩余秒数
    // 恰好与 XltTokenStore 接口约定一致
    return result;
  }
}
