const fs = require('fs');
const macros = require('C:/Users/Administrator/Desktop/个人项目/永劫宏按键/cloudflare-dist/macros.json');

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''").replace(/\\/g, "\\\\") + "'";
}

const batchSize = 50;
let batchNum = 0;

for (let i = 0; i < macros.length; i += batchSize) {
  const batch = macros.slice(i, i + batchSize);
  let sql = '';
  
  batch.forEach(m => {
    const id = escapeSql(m.id);
    const name = escapeSql(m.name);
    const appId = escapeSql(m.applicationId || '');
    const category = escapeSql(m.category || '');
    const macroType = escapeSql(m.macroType || m.macro?.type || 'UNKNOWN');
    const actionName = escapeSql(m.actionName || m.macro?.actionName || '');
    const readOnly = m.readOnly ? 1 : 0;
    const macroData = escapeSql(JSON.stringify(m.macro || {}));
    
    sql += `INSERT OR REPLACE INTO macros (id, name, application_id, category, macro_type, action_name, read_only, macro_data) VALUES (${id}, ${name}, ${appId}, ${category}, ${macroType}, ${actionName}, ${readOnly}, ${macroData});\n`;
  });
  
  fs.writeFileSync(`batch_${batchNum}.sql`, sql);
  console.log(`Batch ${batchNum}: ${batch.length} records (${i}-${i + batch.length - 1})`);
  batchNum++;
}

console.log(`\n总共生成 ${batchNum} 个批次文件`);
