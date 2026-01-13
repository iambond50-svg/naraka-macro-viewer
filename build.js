const fs = require('fs');
const path = require('path');

// 读取静态文件
const indexHtml = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, 'public/app.js'), 'utf8');
const styleCss = fs.readFileSync(path.join(__dirname, 'public/style.css'), 'utf8');

// 生成 static.js 模块
const staticModule = `// 自动生成的静态文件内容 - 请勿手动编辑
export const INDEX_HTML = ${JSON.stringify(indexHtml)};
export const APP_JS = ${JSON.stringify(appJs)};
export const STYLE_CSS = ${JSON.stringify(styleCss)};
`;

fs.writeFileSync(path.join(__dirname, 'src/static.js'), staticModule);
console.log('✅ 静态文件已内嵌到 src/static.js');
