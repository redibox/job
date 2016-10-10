--[[
key 1 -> rdb:job:name:jobs
key 2 -> rdb:job:name:waiting
key 3 -> rdb:job:name:stats
arg 1 -> job data
arg 2 -> should be unique?
arg 3 -> customId
]]


-- if unique enabled
if ARGV[2] == "true" then
  local exists = redis.call("hsetnx", KEYS[1], ARGV[3], ARGV[1])
  if exists == 1 then
    redis.call("lpush", KEYS[2], ARGV[3])
    redis.call("hincrby", KEYS[3], 'created', 1)
    return ARGV[3]
  end
  return 0
else
  -- if not unique enabled
  redis.call("hset", KEYS[1], ARGV[3], ARGV[1])
  redis.call("lpush", KEYS[2], ARGV[3])
  redis.call("hincrby", KEYS[3], 'created', 1)
  return ARGV[3]
end
