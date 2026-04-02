/**
 * 批量更新 public/g 下所有 .html 中的积分弹窗与互动提示逻辑，与小程序一致（仅显示签到、看广告、关注公众号）
 * 1. 将 loadCreditsModalData 替换为 server.js 中的新版本（支持 creditsEarningLimited）
 * 2. 在 showInteractionCreditTip 的 API 回调中增加 creditsEarningLimited 判断，限制模式下不显示提示条
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const serverPath = path.join(projectRoot, 'server.js');
const publicGDir = path.join(projectRoot, 'public', 'g');

// 从 server.js 提取新的 loadCreditsModalData（含函数体到 "}\n\n// 渲染分类" 前的全部内容）
function extractNewLoadCreditsModalData(serverContent) {
  const startMark = '// 加载弹窗数据\nfunction loadCreditsModalData() {';
  const endMark = '    });\n}\n\n// 渲染分类';
  const start = serverContent.indexOf(startMark);
  if (start === -1) throw new Error('server.js 中未找到 loadCreditsModalData 起始标记');
  const endSearch = serverContent.indexOf(endMark, start);
  if (endSearch === -1) throw new Error('server.js 中未找到 loadCreditsModalData 结束标记');
  const funcEnd = endSearch + '    });\n}\n\n'.length;
  return serverContent.substring(start, funcEnd) + '// 渲染分类';
}

// 递归列出所有 .html
function listHtmlFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) listHtmlFiles(full, files);
    else if (e.name.endsWith('.html')) files.push(full);
  }
  return files;
}

// 互动提示条：在 API 成功返回后、使用 action_progress 前，若 creditsEarningLimited 则直接 return
const OLD_TIP_BLOCK = `        return;
      }
      var actionProgress = result.data.action_progress;`;

const NEW_TIP_BLOCK = `        return;
      }
      if (result.data && result.data.creditsEarningLimited) {
        console.log('[积分提示条] 积分途径已限制，不显示互动类提示');
        return;
      }
      var actionProgress = result.data.action_progress;`;

// 旧 loadCreditsModalData 的唯一起始
const OLD_LOAD_START = '// 加载弹窗数据\nfunction loadCreditsModalData() {';
// 旧版结束：catch 内唯一字符串 + 函数结尾 + "// 渲染分类"
const OLD_LOAD_END_MARK = "📱 去小程序查看更多获取积分的方式</div>';\n    });\n}\n\n// 渲染分类";

function main() {
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  const newLoadCreditsModalData = extractNewLoadCreditsModalData(serverContent);

  const htmlFiles = listHtmlFiles(publicGDir);
  console.log('找到', htmlFiles.length, '个 HTML 文件');

  let countTip = 0;
  let countModal = 0;

  for (const file of htmlFiles) {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // 1. 互动提示条：增加 creditsEarningLimited 判断（仅当尚未包含时）
    if (content.includes("var actionProgress = result.data.action_progress") &&
        content.includes("积分提示条") &&
        !content.includes('creditsEarningLimited') &&
        content.includes(OLD_TIP_BLOCK)) {
      content = content.replace(OLD_TIP_BLOCK, NEW_TIP_BLOCK);
      countTip++;
      changed = true;
    }

    // 2. 替换整个 loadCreditsModalData（仅当尚未包含 creditsEarningLimited 时）
    const idxStart = content.indexOf(OLD_LOAD_START);
    const idxEndMark = content.indexOf(OLD_LOAD_END_MARK, idxStart);
    if (idxStart !== -1 && idxEndMark !== -1) {
      const idxEnd = idxEndMark + OLD_LOAD_END_MARK.length;
      const oldBlock = content.substring(idxStart, idxEnd);
      if (!oldBlock.includes('creditsEarningLimited')) {
        content = content.substring(0, idxStart) + newLoadCreditsModalData + content.substring(idxEnd);
        countModal++;
        changed = true;
      }
    }

    if (changed) fs.writeFileSync(file, content, 'utf8');
  }

  console.log('已为', countTip, '个文件添加互动提示条 creditsEarningLimited 判断');
  console.log('已为', countModal, '个文件替换 loadCreditsModalData');
}

main();
