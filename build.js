/**
 * JavaScript 混淆构建脚本
 * 将 src/js/ 目录下的源码混淆后输出到 public/js/
 * 
 * 使用方法: npm run build
 */

const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

// 配置
const SRC_DIR = path.join(__dirname, 'src', 'js');
const DIST_DIR = path.join(__dirname, 'public', 'js');

// 混淆配置 - 平衡安全与体积
const obfuscatorOptions = {
  compact: true,
  controlFlowFlattening: false,              // 关闭! 这是体积膨胀主因
  controlFlowFlatteningThreshold: 0,
  deadCodeInjection: false,                  // 关闭! 会注入大量无用代码
  deadCodeInjectionThreshold: 0,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: false,               // 关闭! 减少体积
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  splitStrings: false,                       // 关闭! 减少体积
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayCallsTransform: false,          // 关闭! 减少体积
  stringArrayEncoding: [],                   // 不编码，减少体积
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 1,               // 减少包装器数量
  stringArrayWrappersChainedCalls: false,
  stringArrayWrappersParametersMaxCount: 2,
  stringArrayWrappersType: 'variable',
  stringArrayThreshold: 0.5,                 // 降低阈值
  transformObjectKeys: false,                // 关闭! 减少体积
  unicodeEscapeSequence: false
};

// security.js 专用配置 - 更稳定的混淆
const securityObfuscatorOptions = {
  compact: true,
  controlFlowFlattening: false,         // 关闭控制流扁平化，避免递归问题
  deadCodeInjection: false,             // 关闭死代码注入
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: false,                 // 必须关闭
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 1,
  stringArrayWrappersChainedCalls: false,
  stringArrayWrappersParametersMaxCount: 2,
  stringArrayWrappersType: 'variable',
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false
};

// 轻度混淆配置（用于调试）
const lightObfuscatorOptions = {
  compact: true,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  stringArray: true,
  stringArrayThreshold: 0.75
};

// 确保目录存在
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 混淆单个文件
function obfuscateFile(srcFile, distFile, options) {
  try {
    const code = fs.readFileSync(srcFile, 'utf8');
    const obfuscatedCode = JavaScriptObfuscator.obfuscate(code, options);
    
    // 添加版权注释
    const header = `/**\n * Obfuscated - ${new Date().toISOString()}\n * DO NOT MODIFY\n */\n`;
    fs.writeFileSync(distFile, header + obfuscatedCode.getObfuscatedCode());
    
    const srcSize = (code.length / 1024).toFixed(2);
    const distSize = (obfuscatedCode.getObfuscatedCode().length / 1024).toFixed(2);
    console.log(`✓ ${path.basename(srcFile)}: ${srcSize}KB → ${distSize}KB`);
    
    return true;
  } catch (error) {
    console.error(`✗ ${path.basename(srcFile)}: ${error.message}`);
    return false;
  }
}

// 主函数
function build() {
  console.log('========================================');
  console.log('  JavaScript 混淆构建');
  console.log('========================================\n');
  
  // 检查源目录
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`错误: 源目录不存在 ${SRC_DIR}`);
    process.exit(1);
  }
  
  // 确保输出目录存在
  ensureDir(DIST_DIR);
  
  // 获取所有JS文件
  const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.js'));
  
  if (files.length === 0) {
    console.log('没有找到需要处理的JS文件');
    return;
  }
  
  console.log(`找到 ${files.length} 个文件需要处理:\n`);
  
  // 根据环境选择混淆强度
  const isProduction = process.env.NODE_ENV === 'production';
  const options = isProduction ? obfuscatorOptions : lightObfuscatorOptions;
  
  console.log(`模式: ${isProduction ? '生产环境 (高强度混淆)' : '开发环境 (轻度混淆)'}\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  files.forEach(file => {
    const srcFile = path.join(SRC_DIR, file);
    const distFile = path.join(DIST_DIR, file);
    
    // security.js 使用专用配置，其他文件使用通用配置
    let fileOptions;
    if (file === 'security.js') {
      fileOptions = isProduction ? securityObfuscatorOptions : lightObfuscatorOptions;
      console.log('  (使用安全模块专用配置)');
    } else {
      fileOptions = options;
    }
    
    if (obfuscateFile(srcFile, distFile, fileOptions)) {
      successCount++;
    } else {
      failCount++;
    }
  });
  
  console.log('\n========================================');
  console.log(`完成: ${successCount} 成功, ${failCount} 失败`);
  console.log('========================================');
}

// 运行
build();