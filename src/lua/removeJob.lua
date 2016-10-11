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
