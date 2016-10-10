--[[
    key 1 -> rdb:job:queueName:set
    key 2 -> rdb:job:queueName:stats

    arg 1 -> hash field postfix
    arg 2 -> UID
    arg 3 -> time taken
    arg 4 -> maximum list capacity
    arg 5 -> key ttl - reset every time this script runs
]]

local expires = tonumber(ARGV[5])
local maxRecords = tonumber(ARGV[4])
local currentRecords = redis.call("SCARD", KEYS[1])

if currentRecords and currentRecords > maxRecords then
  local sum = 0
  local max = 0
  local min = nil
  local members = redis.call("SMEMBERS", KEYS[1])

  for i, member in ipairs(members) do
    local jobid, timeRaw = member:match("([^,]+):([^,]+)")
    local time = tonumber(timeRaw)

    -- running total
    sum = sum + tonumber(time)

    -- check if min or max need updating
    if time > max then max = time end
    if not min or time < min then min = time end
  end

  local average = math.floor(sum / currentRecords)

  redis.call("HMSET", KEYS[2], 'avg' .. ARGV[1], average, 'max' .. ARGV[1], max, 'min' .. ARGV[1], min)
  -- empty the set
  redis.call("DEL", KEYS[1])
end

-- add the new time to the set
redis.call("SADD", KEYS[1], ARGV[2] .. ":" .. ARGV[3])

-- refresh expiry on both keys
redis.call("EXPIRE", KEYS[1], expires)
redis.call("EXPIRE", KEYS[2], expires)
