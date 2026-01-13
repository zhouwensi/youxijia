/**
 * ==================== 安全防护模块 ====================
 * AI游戏工坊 - 综合安全中间件和工具函数
 * 
 * 包含:
 * - Helmet HTTP安全头
 * - 速率限制
 * - 输入验证
 * - XSS防护
 * - 管理员安全增强
 * - 日志审计
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');
const crypto = require('crypto');

// ==================== 配置常量 ====================

// 安全配置
const SECURITY_CONFIG = {
  // 速率限制配置
  rateLimit: {
    // 通用API限制
    general: {
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 200, // 每个IP最多200次请求
      message: { success: false, error: '请求过于频繁，请稍后再试' }
    },
    // 严格限制（登录、注册等敏感操作）
    strict: {
      windowMs: 60 * 1000, // 1分钟
      max: 10, // 每分钟最多10次
      message: { success: false, error: '操作过于频繁，请1分钟后再试' }
    },
    // 游戏生成限制（消耗资源较大）
    generate: {
      windowMs: 60 * 1000, // 1分钟
      max: 5, // 每分钟最多5次
      message: { success: false, error: '生成请求过于频繁，请稍后再试' }
    },
    // 管理员API限制
    admin: {
      windowMs: 60 * 1000, // 1分钟
      max: 30, // 每分钟最多30次
      message: { success: false, error: '管理操作过于频繁，请稍后再试' }
    }
  },
  // 管理员登录尝试限制
  adminLoginAttempts: {
    maxAttempts: 5, // 最大尝试次数
    lockoutTime: 15 * 60 * 1000, // 锁定15分钟
  },
  // 输入长度限制
  inputLimits: {
    title: 100,
    prompt: 2000,
    code: 500000, // 500KB
    nickname: 20,
    password: 128,
    accountId: 50,
  }
};

// ==================== Helmet 安全头配置 ====================

/**
 * 配置 Helmet 安全头中间件
 * 适配游戏网站需求（需要支持内联脚本和样式）
 */
function getHelmetConfig() {
  return helmet({
    // 内容安全策略 - 游戏网站需要宽松配置
    // 禁用CSP，因为用户生成的游戏代码需要完全的脚本执行自由（包括内联事件处理器）
    contentSecurityPolicy: false,
    // 跨域嵌入策略 - 允许游戏页面被嵌入
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // 禁止MIME类型嗅探
    noSniff: true,
    // XSS过滤器
    xssFilter: true,
    // 隐藏X-Powered-By头
    hidePoweredBy: true,
    // 引用策略
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // 点击劫持保护 - 允许同源iframe
    frameguard: { action: 'sameorigin' },
    // HSTS（仅在生产环境启用）
    hsts: process.env.NODE_ENV === 'production' ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    } : false,
  });
}

// ==================== 速率限制器 ====================

/**
 * 创建通用API速率限制器
 */
function createGeneralLimiter() {
  return rateLimit({
    windowMs: SECURITY_CONFIG.rateLimit.general.windowMs,
    max: SECURITY_CONFIG.rateLimit.general.max,
    message: SECURITY_CONFIG.rateLimit.general.message,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // 使用 X-Forwarded-For 或真实IP
      return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
             req.headers['x-real-ip'] || 
             req.ip;
    },
    skip: (req) => {
      // 跳过静态资源
      return req.path.startsWith('/css/') || 
             req.path.startsWith('/js/') || 
             req.path.startsWith('/images/') ||
             req.path.startsWith('/g/');
    }
  });
}

/**
 * 创建严格速率限制器（用于敏感操作）
 */
function createStrictLimiter() {
  return rateLimit({
    windowMs: SECURITY_CONFIG.rateLimit.strict.windowMs,
    max: SECURITY_CONFIG.rateLimit.strict.max,
    message: SECURITY_CONFIG.rateLimit.strict.message,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
             req.headers['x-real-ip'] || 
             req.ip;
    }
  });
}

/**
 * 创建游戏生成速率限制器
 */
function createGenerateLimiter() {
  return rateLimit({
    windowMs: SECURITY_CONFIG.rateLimit.generate.windowMs,
    max: SECURITY_CONFIG.rateLimit.generate.max,
    message: SECURITY_CONFIG.rateLimit.generate.message,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // 优先使用用户token，其次使用IP
      return req.headers['x-user-token'] || 
             req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
             req.ip;
    }
  });
}

/**
 * 创建管理员API速率限制器
 */
function createAdminLimiter() {
  return rateLimit({
    windowMs: SECURITY_CONFIG.rateLimit.admin.windowMs,
    max: SECURITY_CONFIG.rateLimit.admin.max,
    message: SECURITY_CONFIG.rateLimit.admin.message,
    standardHeaders: true,
    legacyHeaders: false,
  });
}

// ==================== 管理员登录保护 ====================

// 管理员登录尝试记录
const adminLoginAttempts = new Map();

/**
 * 管理员登录尝试限制中间件
 */
function adminLoginProtection(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
             req.headers['x-real-ip'] || 
             req.ip;
  
  const attempts = adminLoginAttempts.get(ip);
  const now = Date.now();
  
  if (attempts) {
    // 检查是否在锁定期内
    if (attempts.lockUntil && attempts.lockUntil > now) {
      const remainingTime = Math.ceil((attempts.lockUntil - now) / 1000 / 60);
      console.log(`[SECURITY] 管理员登录被锁定: IP=${ip}, 剩余${remainingTime}分钟`);
      return res.status(429).json({ 
        success: false, 
        error: `登录尝试次数过多，请${remainingTime}分钟后再试` 
      });
    }
    
    // 锁定期已过，重置计数
    if (attempts.lockUntil && attempts.lockUntil <= now) {
      adminLoginAttempts.delete(ip);
    }
  }
  
  next();
}

/**
 * 记录管理员登录失败
 */
function recordAdminLoginFailure(ip) {
  const attempts = adminLoginAttempts.get(ip) || { count: 0 };
  attempts.count++;
  attempts.lastAttempt = Date.now();
  
  if (attempts.count >= SECURITY_CONFIG.adminLoginAttempts.maxAttempts) {
    attempts.lockUntil = Date.now() + SECURITY_CONFIG.adminLoginAttempts.lockoutTime;
    console.log(`[SECURITY] 管理员登录锁定: IP=${ip}, 尝试次数=${attempts.count}`);
  }
  
  adminLoginAttempts.set(ip, attempts);
}

/**
 * 重置管理员登录尝试（登录成功时调用）
 */
function resetAdminLoginAttempts(ip) {
  adminLoginAttempts.delete(ip);
}

// ==================== 安全审计日志 ====================

// 审计日志存储（生产环境应该持久化到数据库）
const auditLogs = [];
const MAX_AUDIT_LOGS = 10000;

/**
 * 记录安全审计日志
 */
function logSecurityEvent(event) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...event
  };
  
  auditLogs.push(logEntry);
  
  // 控制日志大小
  if (auditLogs.length > MAX_AUDIT_LOGS) {
    auditLogs.shift();
  }
  
  // 同时输出到控制台
  console.log(`[SECURITY] ${logEntry.timestamp} | ${event.type} | ${event.ip || 'N/A'} | ${event.details || ''}`);
}

/**
 * 获取最近的审计日志
 */
function getAuditLogs(limit = 100) {
  return auditLogs.slice(-limit).reverse();
}

/**
 * 创建审计日志中间件
 */
function createAuditMiddleware(eventType) {
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
               req.headers['x-real-ip'] || 
               req.ip;
    
    logSecurityEvent({
      type: eventType,
      ip: ip,
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent']?.substring(0, 200),
      userToken: req.headers['x-user-token']?.substring(0, 10) + '...',
    });
    
    next();
  };
}

// ==================== 输入验证规则 ====================

/**
 * 通用输入清理函数
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  // 移除空字符
  let clean = input.replace(/\0/g, '');
  
  // 移除控制字符（保留换行和制表符）
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  return clean.trim();
}

/**
 * 游戏创建/更新的验证规则
 */
const gameValidationRules = [
  body('title')
    .optional()
    .isString()
    .isLength({ max: SECURITY_CONFIG.inputLimits.title })
    .withMessage(`标题不能超过${SECURITY_CONFIG.inputLimits.title}个字符`)
    .customSanitizer(sanitizeInput),
  
  body('prompt')
    .optional()
    .isString()
    .isLength({ max: SECURITY_CONFIG.inputLimits.prompt })
    .withMessage(`描述不能超过${SECURITY_CONFIG.inputLimits.prompt}个字符`)
    .customSanitizer(sanitizeInput),
  
  body('code')
    .optional()
    .isString()
    .isLength({ max: SECURITY_CONFIG.inputLimits.code })
    .withMessage('游戏代码过大'),
  
  body('authorName')
    .optional()
    .isString()
    .isLength({ max: SECURITY_CONFIG.inputLimits.nickname })
    .withMessage(`作者名不能超过${SECURITY_CONFIG.inputLimits.nickname}个字符`)
    .customSanitizer(sanitizeInput),
];

/**
 * 用户相关的验证规则
 */
const userValidationRules = {
  nickname: [
    body('nickname')
      .notEmpty()
      .withMessage('昵称不能为空')
      .isString()
      .isLength({ max: SECURITY_CONFIG.inputLimits.nickname })
      .withMessage(`昵称不能超过${SECURITY_CONFIG.inputLimits.nickname}个字符`)
      .customSanitizer(sanitizeInput),
  ],
  
  password: [
    body('password')
      .notEmpty()
      .withMessage('密码不能为空')
      .isString()
      .isLength({ min: 6, max: SECURITY_CONFIG.inputLimits.password })
      .withMessage('密码长度必须在6-128个字符之间'),
  ],
  
  accountId: [
    body('accountId')
      .notEmpty()
      .withMessage('账号ID不能为空')
      .isString()
      .isLength({ max: SECURITY_CONFIG.inputLimits.accountId })
      .withMessage('账号ID过长')
      .customSanitizer(sanitizeInput),
  ],
};

/**
 * 搜索验证规则
 */
const searchValidationRules = [
  param('keyword')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('搜索关键词过长')
    .customSanitizer(sanitizeInput),
  
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('页码无效'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('每页数量无效'),
];

/**
 * 验证结果处理中间件
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logSecurityEvent({
      type: 'VALIDATION_FAILED',
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
      details: JSON.stringify(errors.array().map(e => e.msg)),
      path: req.path
    });
    
    return res.status(400).json({ 
      success: false, 
      error: errors.array()[0].msg,
      errors: errors.array()
    });
  }
  next();
}

// ==================== 额外的安全中间件 ====================

/**
 * 清理请求体中的潜在XSS内容（轻量级）
 */
function xssCleanMiddleware(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    // 对非代码字段进行基本XSS清理
    const fieldsToClean = ['title', 'prompt', 'nickname', 'authorName', 'accountId'];
    
    for (const field of fieldsToClean) {
      if (req.body[field] && typeof req.body[field] === 'string') {
        // 移除最危险的脚本标签（但保留其他HTML，因为游戏代码可能需要）
        req.body[field] = req.body[field]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      }
    }
  }
  next();
}

/**
 * 检测并阻止常见攻击模式
 */
function attackPatternDetection(req, res, next) {
  const suspiciousPatterns = [
    // SQL注入模式（虽然使用参数化查询，但多一层防护）
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b.*\b(from|into|table|database)\b)/i,
    // 命令注入模式
    /(\||;|`|\$\(|\${)/,
    // LDAP注入
    /(\(|\)|\*|\\)/,
  ];
  
  const checkValue = (value) => {
    if (typeof value !== 'string') return false;
    return suspiciousPatterns.some(pattern => pattern.test(value));
  };
  
  // 检查查询参数
  for (const key in req.query) {
    if (checkValue(req.query[key])) {
      logSecurityEvent({
        type: 'ATTACK_PATTERN_DETECTED',
        ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
        details: `Suspicious query param: ${key}`,
        path: req.path
      });
      return res.status(400).json({ success: false, error: 'Invalid request' });
    }
  }
  
  // 检查部分请求体字段（排除code字段，因为它是游戏代码）
  if (req.body && typeof req.body === 'object') {
    const fieldsToCheck = ['title', 'prompt', 'nickname', 'accountId'];
    for (const field of fieldsToCheck) {
      if (checkValue(req.body[field])) {
        logSecurityEvent({
          type: 'ATTACK_PATTERN_DETECTED',
          ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
          details: `Suspicious body field: ${field}`,
          path: req.path
        });
        return res.status(400).json({ success: false, error: 'Invalid request' });
      }
    }
  }
  
  next();
}

/**
 * 请求体大小检查中间件
 */
function bodySizeCheck(maxSize = 1024 * 1024) { // 默认1MB
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    if (contentLength > maxSize) {
      logSecurityEvent({
        type: 'OVERSIZED_REQUEST',
        ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
        details: `Size: ${contentLength} bytes`,
        path: req.path
      });
      return res.status(413).json({ success: false, error: '请求体过大' });
    }
    next();
  };
}

// ==================== CORS 配置 ====================

/**
 * 获取CORS配置
 */
function getCorsConfig() {
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:80', 'http://127.0.0.1:80'];
  
  return {
    origin: function(origin, callback) {
      // 允许无origin的请求（如移动端app、Postman等）
      if (!origin) return callback(null, true);
      
      // 生产环境：检查白名单
      if (process.env.NODE_ENV === 'production') {
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          callback(null, true);
        } else {
          console.log(`[SECURITY] CORS阻止来源: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      } else {
        // 开发环境：允许所有
        callback(null, true);
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'X-User-Token', 
      'X-Admin-Key', 
      'X-Author-Token',
      'X-Requested-With'
    ],
    credentials: true,
    maxAge: 86400, // 预检请求缓存24小时
  };
}

// ==================== 密码安全 ====================

// bcrypt配置
const BCRYPT_ROUNDS = 12;

/**
 * 安全的密码哈希（使用bcrypt）
 * 兼容旧版SHA256哈希
 */
async function hashPasswordSecure(password) {
  const bcrypt = require('bcrypt');
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * 验证密码
 * 支持bcrypt和旧版SHA256格式
 */
async function verifyPassword(password, hash) {
  const bcrypt = require('bcrypt');
  
  // 检查是否是bcrypt格式（以$2开头）
  if (hash.startsWith('$2')) {
    return await bcrypt.compare(password, hash);
  }
  
  // 兼容旧版SHA256格式
  const oldHash = crypto.createHash('sha256')
    .update(password + 'aigame_salt_2025')
    .digest('hex');
  return oldHash === hash;
}

/**
 * 检查密码是否需要升级（从SHA256升级到bcrypt）
 */
function needsPasswordUpgrade(hash) {
  return !hash.startsWith('$2');
}

// ==================== 导出模块 ====================

module.exports = {
  // 配置
  SECURITY_CONFIG,
  
  // Helmet
  getHelmetConfig,
  
  // 速率限制器
  createGeneralLimiter,
  createStrictLimiter,
  createGenerateLimiter,
  createAdminLimiter,
  
  // 管理员保护
  adminLoginProtection,
  recordAdminLoginFailure,
  resetAdminLoginAttempts,
  
  // 审计日志
  logSecurityEvent,
  getAuditLogs,
  createAuditMiddleware,
  
  // 输入验证
  gameValidationRules,
  userValidationRules,
  searchValidationRules,
  handleValidationErrors,
  sanitizeInput,
  
  // 安全中间件
  xssCleanMiddleware,
  attackPatternDetection,
  bodySizeCheck,
  
  // CORS
  getCorsConfig,
  
  // 密码
  hashPasswordSecure,
  verifyPassword,
  needsPasswordUpgrade,
  BCRYPT_ROUNDS,
};
