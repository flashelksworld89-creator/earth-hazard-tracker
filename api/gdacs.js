export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    const fmt = (d) => {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const params = new URLSearchParams({
      eventlist: 'TC;VO;FL;WF;DR',
      fromdate: fmt(from),
      todate: fmt(to)
    });

    const url = `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?${params}`;
    const upstream = await fetch(url, {
      headers: {
        'Accept': 'application/json, application/geo+json',
        'User-Agent': 'EarthHazardTracker/1.0'
      }
    });

    if (!upstream.ok) {
      const body = await upstream.text();
      return res.status(upstream.status).json({
        error: 'GDACS request failed',
        status: upstream.status,
        detail: body.slice(0, 500)
      });
    }

    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        error: 'GDACS returned a non-JSON response',
        detail: text.slice(0, 500)
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: 'GDACS proxy error',
      detail: error?.message || String(error)
    });
  }
}
