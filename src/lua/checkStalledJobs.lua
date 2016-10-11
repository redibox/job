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
