const { resolve } = require('path');
const { readFileSync } = require('fs');

function loadLuaScript(script) {
  try {
    return readFileSync(resolve(__dirname, `./lua/${script}.lua`)).toString();
  } catch (e) {
    return '';
  }
}

module.exports.loadLuaScript = loadLuaScript;
