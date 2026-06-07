// 简单测试：验证 Vercel serverless function 是否正常工作
module.exports = (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Serverless function is working!',
    url: req.url,
    method: req.method,
    time: new Date().toISOString()
  })
}
