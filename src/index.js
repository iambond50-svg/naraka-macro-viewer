/**
 * 永劫无间宏查看器 - Cloudflare Workers + D1
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (path.startsWith('/api/')) {
        return handleAPI(path, url, env, corsHeaders);
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

async function handleAPI(path, url, env, corsHeaders) {
  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };

  if (path === '/api/macros') {
    const page = parseInt(url.searchParams.get('page') || '1');
    const perPage = parseInt(url.searchParams.get('per_page') || '50');
    const search = url.searchParams.get('search') || '';
    const category = url.searchParams.get('category') || '';

    let query = 'SELECT * FROM macros WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM macros WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR action_name LIKE ?)';
      countQuery += ' AND (name LIKE ? OR action_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      query += ' AND category = ?';
      countQuery += ' AND category = ?';
      params.push(category);
    }

    const countResult = await env.DB.prepare(countQuery).bind(...params).first();
    const total = countResult?.total || 0;

    query += ' ORDER BY name LIMIT ? OFFSET ?';
    const rows = await env.DB.prepare(query)
      .bind(...params, perPage, (page - 1) * perPage)
      .all();

    const macros = rows.results.map(row => ({
      id: row.id,
      name: row.name,
      applicationId: row.application_id,
      category: row.category,
      macroType: row.macro_type,
      actionName: row.action_name,
      readOnly: !!row.read_only,
      macro: JSON.parse(row.macro_data)
    }));

    return new Response(JSON.stringify({
      success: true,
      data: macros,
      pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) }
    }), { headers });
  }

  if (path === '/api/categories') {
    const rows = await env.DB.prepare(`
      SELECT category, COUNT(*) as count FROM macros WHERE category != '' GROUP BY category ORDER BY category
    `).all();
    return new Response(JSON.stringify({
      success: true,
      data: rows.results.map(r => ({ name: r.category, count: r.count }))
    }), { headers });
  }

  if (path.startsWith('/api/macro/')) {
    const id = path.replace('/api/macro/', '');
    const row = await env.DB.prepare('SELECT * FROM macros WHERE id = ?').bind(id).first();
    if (!row) {
      return new Response(JSON.stringify({ success: false, error: 'Not found' }), { status: 404, headers });
    }
    return new Response(JSON.stringify({
      success: true,
      data: {
        id: row.id, name: row.name, applicationId: row.application_id,
        category: row.category, macroType: row.macro_type, actionName: row.action_name,
        readOnly: !!row.read_only, macro: JSON.parse(row.macro_data)
      }
    }), { headers });
  }

  if (path === '/api/stats') {
    const total = await env.DB.prepare('SELECT COUNT(*) as total FROM macros').first();
    const types = await env.DB.prepare('SELECT macro_type, COUNT(*) as count FROM macros GROUP BY macro_type').all();
    const categories = await env.DB.prepare(`
      SELECT category, COUNT(*) as count FROM macros WHERE category != '' GROUP BY category ORDER BY count DESC LIMIT 10
    `).all();
    return new Response(JSON.stringify({
      success: true,
      data: {
        total: total?.total || 0,
        types: types.results.map(r => ({ type: r.macro_type, count: r.count })),
        topCategories: categories.results.map(r => ({ category: r.category, count: r.count }))
      }
    }), { headers });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
}