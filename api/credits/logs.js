/**
 * 积分明细 API - 占位文件
 * 
 * 实际API由server.js中的路由处理
 * 保留此文件是为了避免路由冲突
 */
module.exports = (req, res) => {
  return res.status(500).json({ 
    success: false, 
    error: '请通过主服务器访问此API'
  });
};