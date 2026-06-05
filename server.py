import os
from flask import Flask, request, jsonify, send_from_directory
from scraper import search_movies, parse_post_details, parse_nexdrive_links, get_recent_uploads
from resolver import get_direct_link

app = Flask(__name__, static_folder='static', static_url_path='/static')

# Serve single-page dashboard
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

# Endpoint: Search Movies/Series
@app.route('/api/search')
def api_search():
    query = request.args.get('q', '').strip()
    page  = int(request.args.get('page', 1))
    if not query:
        return jsonify({'status': 'error', 'message': 'Query string required'}), 400
        
    if query.startswith('http://') or query.startswith('https://'):
        return jsonify({
            'status': 'direct_url',
            'url': query
        })
        
    results, has_more = search_movies(query, page=page)
    return jsonify({
        'status': 'success',
        'query': query,
        'page': page,
        'has_more': has_more,
        'results': results
    })


# Endpoint: Get Recent Uploads
@app.route('/api/recent')
def api_recent():
    recent = get_recent_uploads()
    return jsonify({
        'status': 'success',
        'results': recent
    })

# Endpoint: Extract Post Details (Resolutions/Downloads Packs)
@app.route('/api/details')
def api_details():
    post_url = request.args.get('url', '').strip()
    if not post_url:
        return jsonify({'status': 'error', 'message': 'Post URL required'}), 400
        
    details = parse_post_details(post_url)
    if not details:
        return jsonify({'status': 'error', 'message': 'Failed to scrape post details'}), 500
        
    return jsonify({
        'status': 'success',
        'url': post_url,
        'title': details['title'],
        'packages': details['packages']
    })

# Endpoint: Extract Episodes list or Movie file options
@app.route('/api/episodes')
def api_episodes():
    nexdrive_url = request.args.get('url', '').strip()
    if not nexdrive_url:
        return jsonify({'status': 'error', 'message': 'Nexdrive URL required'}), 400
        
    episodes_data = parse_nexdrive_links(nexdrive_url)
    return jsonify({
        'status': 'success',
        'url': nexdrive_url,
        'data': episodes_data
    })

# Endpoint: Resolve dynamic download shorteners to ultimate unthrottled link
@app.route('/api/resolve')
def api_resolve():
    vcloud_url = request.args.get('url', '').strip()
    if not vcloud_url:
        return jsonify({'status': 'error', 'message': 'V-Cloud URL required'}), 400
        
    direct_link = get_direct_link(vcloud_url)
    if not direct_link:
        return jsonify({'status': 'error', 'message': 'Bypass failed. Could not resolve direct link.'}), 500
        
    return jsonify({
        'status': 'success',
        'vcloud_url': vcloud_url,
        'direct_url': direct_link
    })

if __name__ == '__main__':
    # Ensure static directory exists
    os.makedirs(app.static_folder, exist_ok=True)
    # Start server on dynamic port (standard for container environments)
    port = int(os.environ.get("PORT", 5001))
    print(f"Vegamovies Chatbot Backend launching on http://0.0.0.0:{port} ...")
    app.run(host='0.0.0.0', port=port, debug=True)
