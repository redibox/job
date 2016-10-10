--[[
key 1 -> rdb:job:name:set
key 2 -> rdb:job:name:stats
arg 1 -> hash field
arg 2 -> job ID
arg 3 -> time taken
arg 4 -> maximum list capacity
]]

local sum = 0
local maxRecords = tonumber(ARGV[4])
local currentRecords = redis.call("scard", KEYS[1])

if currentRecords > maxRecords then
  local members = redis.call("smembers", KEYS[1])

  for i, member in members do
    local jobid, time = occurrence:match("([^,]+):([^,]+)")

    redis.call("srem", KEYS[1], member)

    sum = sum + tonumber(time)
  end

  local average = sum / currentRecords

  redis.call("hset", KEYS[2], ARGV[1], average)
  redis.call("sadd", KEYS[1], ARGV[2] .. ":" .. ARGV[3])
else
  redis.call("sadd", KEYS[1], ARGV[2] .. ":" .. ARGV[3])
end
