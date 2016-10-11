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
