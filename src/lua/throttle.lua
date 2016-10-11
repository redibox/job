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
