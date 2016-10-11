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
