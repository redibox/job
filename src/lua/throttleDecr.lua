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
