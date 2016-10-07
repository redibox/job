module.exports = {

  addJob: {
    keys: 2,
    lua: `
        --[[
        key 1 -> rdb:job:name:jobs
        key 2 -> rdb:job:name:waiting
        arg 1 -> job data
        arg 2 -> should be unique?
        arg 3 -> customId
        ]]


        -- if unique enabled
        if ARGV[2] == "true" then
          local exists = redis.call("hsetnx", KEYS[1], ARGV[3], ARGV[1])
          if exists == 1 then
            redis.call("lpush", KEYS[2], ARGV[3])
            return ARGV[3]
          end
          return 0
        else
          -- if not unique enabled
          redis.call("hset", KEYS[1], ARGV[3], ARGV[1])
          redis.call("lpush", KEYS[2], ARGV[3])
          return ARGV[3]
        end
    `,
  },

  checkStalledJobs: {
    keys: 4,
    lua: `
        --[[
        key 1 -> rdb:job:queue:stallTime
        key 2 -> rdb:job:queue:stalling
        key 3 -> rdb:job:queue:waiting
        key 4 -> rdb:job:queue:active
        arg 1 -> ms timestamp ("now")
        arg 2 -> ms stallInterval

        returns {resetJobId1, resetJobId2, ...}

        workers remove the jobs from the stalling set every 'stallInterval' ms
        if a job isn't removed from the stall set within the stallInterval time period then
        we assume that the job has stalled and we'll reset it (moved from active back to waiting)
        --]]

        local now = tonumber(ARGV[1])
        local stallTime = tonumber(redis.call("get", KEYS[1]) or 0)

        if now < stallTime then
          return 0
        end

        -- move stalled jobs from active to waiting set
        local stalling = redis.call("smembers", KEYS[2])
        if #stalling > 0 then
          redis.call("rpush", KEYS[3], unpack(stalling))
          for i = 1, #stalling do
            redis.call("lrem", KEYS[4], 0, stalling[i])
          end
          redis.call("del", KEYS[2])
        end

        -- copy active jobs into stalling set
        local actives = redis.call("lrange", KEYS[4], 0, -1)
        if #actives > 0 then
          redis.call("sadd", KEYS[2], unpack(actives))
        end

        redis.call("set", KEYS[1], now + ARGV[2])

        return stalling
    `,
  },

  removeJob: {
    keys: 6,
    lua: `
        --[[
        key 1 -> rdb:job:queue:succeeded
        key 2 -> rdb:job:queue:failed
        key 3 -> rdb:job:queue:waiting
        key 4 -> rdb:job:queue:active
        key 5 -> rdb:job:queue:stalling
        key 6 -> rdb:job:queue:jobs
        arg 1 -> jobId
        ]]

        local jobId = ARGV[1]

        if (redis.call("sismember", KEYS[1], jobId) + redis.call("sismember", KEYS[2], jobId)) == 0 then
          redis.call("lrem", KEYS[3], 0, jobId)
          redis.call("lrem", KEYS[4], 0, jobId)
        end

        redis.call("srem", KEYS[1], jobId)
        redis.call("srem", KEYS[2], jobId)
        redis.call("srem", KEYS[5], jobId)
        redis.call("hdel", KEYS[6], jobId)
    `,
  },

  throttle: {
    keys: 1,
    lua: `
        --[[
          key 1 -> key name - ip, user id or some unique key to throttle X by
          arg 1 -> limit
          arg 2 -> seconds
          returns {
            throttled: ->  1 if should throttle, 0 if still within limit
            remaining: ->  how many reqs left until throttled,
            ttl:       ->  seconds remaining until limit resets
          }
        ]]
        
        local count = redis.call('INCR', KEYS[1])
        local ttl = redis.call('ttl', KEYS[1])
        local remaining = tonumber(ARGV[1]) - count
        
        if count == 1 or ttl == -1 then
          redis.call('EXPIRE', KEYS[1], ARGV[2])
        end
        
        if ttl == -1 then
          ttl = tonumber(ARGV[2])
        end
        
        if count > tonumber(ARGV[1]) then
          return {1, 0, ttl}
        end
        
        if remaining == 0 then
          return {1, 0, ttl}
        end
        
        return {0, remaining, ttl}
  `,
  },

  pThrottle: {
    keys: 1,
    lua: `
        --[[
          key 1 -> key name - ip, user id or some unique key to throttle X by
          arg 1 -> limit
          arg 2 -> milliseconds
          returns 0 if request is ok
          returns 1 if request denied
        ]]
        
        local count = redis.call('INCR', KEYS[1])
        local pttl = redis.call('pttl',KEYS[1])
        local remaining = tonumber(ARGV[1]) - count

        if count == 1 or pttl == -1 then
          redis.call('PEXPIRE', KEYS[1], ARGV[2])
        end
        
        if pttl == -1 then
          pttl = tonumber(ARGV[2])
        end
        
        if count > tonumber(ARGV[1]) then
          return {1,0,pttl}
        end
        
        if remaining == 0 then
          return {1, 0, pttl}
        end
        
        return {0, remaining, pttl}
  `,
  },

  throttleNoIncr: {
    keys: 1,
    lua: `
        --[[
          key 1 -> key name - ip, user id or some unique key to throttle X by
          arg 1 -> limit
          arg 2 -> seconds
          returns 0/1
        ]]
        if redis.call('exists',KEYS[1]) > 0 then
          local currentVal = tonumber(redis.call('get',KEYS[1]))
          if currentVal >= tonumber(ARGV[1]) then
             return 1
          else
             redis.call('incr',KEYS[1])
             return 0
          end
        else
          redis.call('setex',KEYS[1], tonumber(ARGV[2]), 1)
          return 0
        end
    `,
  },

  throttleDecr: {
    keys: 1,
    lua: `
        --[[
          key 1 -> key name - ip, user id or some unique key to throttle X by
          returns 0/1
        ]]
    
        if redis.call('exists',KEYS[1]) > 0 then
          redis.call('decr',KEYS[1])
          return 1
        else
          return 1
        end
    `,
  },
};
