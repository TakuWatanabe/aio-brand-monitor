// api/health.js
// GET /api/health — サーバー稼働確認用エンドポイント

module.exports = (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "AIO Brand Monitor API",
    timestamp: new Date().toISOString(),
  });
};
