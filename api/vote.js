module.exports = async (_req, res) => {
  res.status(410).json({
    message: 'Voting is retired; the Journal and critique are the canonical record.'
  });
};
