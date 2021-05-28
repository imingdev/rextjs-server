export default () => (req, res, next) => {
  try {
    const url = decodeURI(req.url);
    console.log('urlurl', url, req.headers.accept);
    res.statusCode = 200;
    const html = 'nihao';

    // Send response
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Accept-Ranges', 'none'); // #3870
    res.setHeader('Content-Length', Buffer.byteLength(html));
    res.end(html, 'utf8');

    next();
  } catch (err) {
    if (err.name === 'URIError') {
      err.statusCode = 400;
    }
    return next(err);
  }
};
