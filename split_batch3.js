const fs = require('fs');
const macros = require('C:/Users/Administrator/Desktop/个人项目/永劫宏按键/cloudflare-dist/macros.json');

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''").replace(/\\/g, "\\\\") + "'";
}

// batch_3 对应索引 150-199
const startIdx = 150;
const endIdx = 199;

for (let i = startIdx; i <= endIdx; i++) {
  const m = macros[i];
  const id = escapeSql(m.id);
  const name = escapeSql(m.name);
  const appId = escapeSql(m.applicationId || '');
  const category = escapeSql(m.category || '');
  const macroType = escapeSql(m.macroType || m.macro?.type || 'UNKNOWN');
  const actionName = escapeSql(m.actionName || m.macro?.actionName || '');
  const readOnly = m.readOnly ? 1 : 0;
  const macroData = escapeSql(JSON.stringify(m.macro || {}));
  
  const dataLen = JSON.stringify(m.macro || {}).length;
  
  const sql = `INSERT OR REPLACE INTO macros (id, name, application_id, category, macro_type, action_name, read_only, macro_data) VALUES (${id}, ${name}, ${appId}, ${category}, ${macroType}, ${actionName}, ${readOnly}, ${macroData});`;
  
  fs.writeFileSync(`single_${i}.sql`, sql);
  console.log(`#${i}: ${m.name} (数据长度: ${dataLen})`);
}
