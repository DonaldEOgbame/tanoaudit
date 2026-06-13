router.get('/search', (req,res) => {
  const sql = `SELECT * FROM products WHERE n='${req.query.q}'`;
  const rows = db.raw(sql);
  res.json(rows);
});
