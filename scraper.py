import re
from curl_cffi import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

BASE_URL = "https://vegamovies.market/"

def search_movies(query, page=1):
    """
    Queries both Vegamovies and Rogmovies search proxies and aggregates top results.
    Supports pagination via the page parameter.
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    results = []
    seen_urls = set()
    
    # 1. Search Vegamovies
    vega_search_url = f"https://vegamovies.market/search.php?q={query}&page={page}"
    try:
        resp = requests.get(vega_search_url, impersonate="chrome120", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            hits = data.get('hits', [])
            for hit in hits:
                doc = hit.get('document', {})
                title = doc.get('post_title', '')
                permalink = doc.get('permalink', '')
                thumbnail = doc.get('post_thumbnail', '')
                
                if permalink.startswith('/'):
                    permalink = urljoin("https://vegamovies.market/", permalink)
                if thumbnail.startswith('/'):
                    thumbnail = urljoin("https://vegamovies.market/", thumbnail)
                    
                if permalink not in seen_urls:
                    seen_urls.add(permalink)
                    results.append({
                        'title': title,
                        'url': permalink,
                        'thumbnail': thumbnail,
                        'site': 'vegamovies'
                    })
    except Exception as e:
        print(f"Error searching Vegamovies: {e}")
        
    # 2. Search Rogmovies
    rog_search_url = f"https://rogmovies.club/search.php?q={query}&page={page}"
    try:
        resp = requests.get(rog_search_url, impersonate="chrome120", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            hits = data.get('hits', [])
            for hit in hits:
                doc = hit.get('document', {})
                title = doc.get('post_title', '')
                permalink = doc.get('permalink', '')
                thumbnail = doc.get('post_thumbnail', '')
                
                if permalink.startswith('/'):
                    permalink = urljoin("https://rogmovies.club/", permalink)
                if thumbnail.startswith('/'):
                    thumbnail = urljoin("https://rogmovies.club/", thumbnail)
                    
                if permalink not in seen_urls:
                    seen_urls.add(permalink)
                    results.append({
                        'title': title,
                        'url': permalink,
                        'thumbnail': thumbnail,
                        'site': 'rogmovies'
                    })
    except Exception as e:
        print(f"Error searching Rogmovies: {e}")
        
    # Interleave results from both sites to ensure representation of both
    vega_results = [r for r in results if r['site'] == 'vegamovies']
    rog_results = [r for r in results if r['site'] == 'rogmovies']
    
    combined = []
    for v, r in zip(vega_results, rog_results):
        combined.append(v)
        combined.append(r)
        
    min_len = min(len(vega_results), len(rog_results))
    combined.extend(vega_results[min_len:])
    combined.extend(rog_results[min_len:])
    
    # has_more is true if either site returned a full page of results
    has_more = (len(vega_results) >= 10) or (len(rog_results) >= 10)
    
    return combined[:30], has_more


def get_movie_quality(title):
    """
    Extracts quality tag from movie title.
    """
    if not title:
        return 'HD'
    t = title.toLowerCase() if hasattr(title, 'toLowerCase') else title.lower()
    if 'imax' in t: return 'IMAX'
    if any(k in t for k in ['hdcam', 'hdtc', 'hdts', 'pre-hd', 'camprip', 'dvdrip', 'cam']): return 'CAM'
    if '2160p' in t or '4k' in t: return '4K'
    if 'bluray' in t: return 'BluRay'
    if '1080p' in t: return '1080p'
    if '720p' in t: return '720p'
    if '480p' in t: return '480p'
    return 'HD'

def parse_post_details(post_url):
    """
    Fetches the movie/series post page and extracts download packages/resolutions.
    Maps each resolution to its nexdrive.pro URL.
    """
    parsed_uri = urlparse(post_url)
    site_domain = f"{parsed_uri.scheme}://{parsed_uri.netloc}/"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': site_domain
    }
    
    try:
        response = requests.get(post_url, impersonate="chrome120", headers=headers, timeout=15)
        if response.status_code != 200:
            return None
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        post_title = soup.find('h1')
        title_str = post_title.text.strip() if post_title else "Movie/Series Details"
        
        # Find all download links pointing to nexdrive.pro
        nexdrive_links = soup.find_all('a', href=lambda h: h and 'nexdrive.pro' in h)
        
        download_packages = []
        seen_urls = set()
        
        for link in nexdrive_links:
            href = link['href']
            if href in seen_urls:
                continue
            seen_urls.add(href)
            
            button_label = link.text.strip()
            
            context = []
            curr = link
            while curr:
                curr = curr.find_previous(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span'])
                if curr:
                    t = curr.text.strip().replace('\n', ' ')
                    t = re.sub(r'\s+', ' ', t)
                    if t and t not in context and len(t) > 3:
                        context.append(t)
                    if len(context) >= 3:
                        break
                else:
                    break
            
            package_name = "Download Links"
            if len(context) > 0:
                for txt in context:
                    if "Season" in txt or "720p" in txt or "1080p" in txt or "480p" in txt or "4K" in txt or "2160p" in txt or "Batch" in txt or "Zip" in txt:
                        package_name = txt
                        break
                if package_name == "Download Links" and len(context) > 0:
                    package_name = context[-1]
            
            download_packages.append({
                'label': f"{package_name} ({button_label})",
                'nexdrive_url': href
            })
            
        return {
            'title': title_str,
            'packages': download_packages
        }
    except Exception as e:
        print(f"Error parsing post details: {e}")
        return None

def parse_nexdrive_links(nexdrive_url):
    """
    Fetches the nexdrive.pro page and extracts the final download options.
    If it's a series, returns episode-grouped vcloud.zip/fastdl.zip URLs.
    If it's a batch/zip package, returns zip files with 'batch' type.
    If it's a movie, returns a list containing the primary links.
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        response = requests.get(nexdrive_url, impersonate="chrome120", headers=headers, timeout=15)
        if response.status_code != 200:
            return []
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Determine the page main heading to check for batch/zip keywords
        h1 = soup.find('h1')
        h1_text = h1.text.strip().lower() if h1 else ""
        
        # Check if the page lists episodes
        headings = soup.find_all(['h3', 'h4', 'h5', 'h6', 'p'])
        is_series = False
        episode_blocks = []
        
        ep_pattern = r'\b(?:Episode[s]?|Ep[s]?|E)[:\-\.\s]*(\d+)'
        
        for h in headings:
            text = h.text.strip()
            match = re.search(ep_pattern, text, re.IGNORECASE)
            if match:
                ep_num = int(match.group(1))
                is_series = True
                
                vcloud_links = []
                sibling = h.find_next_sibling()
                
                for a in h.find_all('a', href=True):
                    if 'vcloud' in a['href'] or 'fastdl' in a['href']:
                        vcloud_links.append(a)
                        
                limit = 20
                while sibling and limit > 0:
                    if re.search(ep_pattern, sibling.text, re.IGNORECASE):
                        break
                    
                    if sibling.name == 'a' and ('vcloud' in sibling.get('href', '') or 'fastdl' in sibling.get('href', '')):
                        vcloud_links.append(sibling)
                    else:
                        for a in sibling.find_all('a', href=True):
                            if 'vcloud' in a['href'] or 'fastdl' in a['href']:
                                vcloud_links.append(a)
                    sibling = sibling.find_next_sibling()
                    limit -= 1
                
                if vcloud_links:
                    href = vcloud_links[0]['href']
                    episode_blocks.append({
                        'episode': ep_num,
                        'title': f"Episode {ep_num}",
                        'vcloud_url': href
                    })
        
        if is_series and episode_blocks:
            seen_eps = set()
            deduped_episodes = []
            for ep in episode_blocks:
                if ep['episode'] not in seen_eps:
                    seen_eps.add(ep['episode'])
                    deduped_episodes.append(ep)
            deduped_episodes.sort(key=lambda x: x['episode'])
            return {
                'type': 'series',
                'items': deduped_episodes
            }
            
        # Get all V-Cloud/FastDL links
        links = soup.find_all('a', href=lambda h: h and ('vcloud' in h or 'fastdl' in h))
        movie_links = []
        for idx, l in enumerate(links):
            href = l['href']
            label = l.text.strip() or f"Download Mirror {idx+1}"
            movie_links.append({
                'title': label,
                'vcloud_url': href
            })
            
        # Check for Batch/Zip markers in page title or content
        is_batch = False
        if h1_text and any(k in h1_text for k in ['zip', 'pack', 'batch', 'rar', 'complete']):
            is_batch = True
            
        if is_batch and movie_links:
            return {
                'type': 'batch',
                'items': movie_links
            }
            
        if movie_links:
            return {
                'type': 'movie',
                'items': movie_links
            }
            
        return {
            'type': 'unknown',
            'items': []
        }
    except Exception as e:
        print(f"Error parsing nexdrive links: {e}")
        return {
            'type': 'error',
            'items': []
        }

def get_recent_uploads():
    """
    Fetches the home page of Vegamovies and Rogmovies, extracting recent uploads.
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    results = []
    seen_urls = set()
    
    # 1. Get from Vegamovies
    try:
        response = requests.get("https://vegamovies.market/", impersonate="chrome120", headers=headers, timeout=12)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            links = soup.find_all('a', href=lambda h: h and '/download-' in h)
            for l in links:
                href = l['href']
                if href.startswith('/'):
                    href = urljoin("https://vegamovies.market/", href)
                if href in seen_urls:
                    continue
                
                img = l.find('img')
                if not img and l.find_parent():
                    img = l.find_parent().find('img')
                
                if img:
                    title = img.get('title') or img.get('alt') or ''
                    thumbnail = img.get('data-src') or img.get('data-lazy-src') or img.get('src') or ''
                    if thumbnail.startswith('/'):
                        thumbnail = urljoin("https://vegamovies.market/", thumbnail)
                    if title.lower().startswith('download '):
                        title = title[9:]
                    if 'data:image' in thumbnail:
                        thumbnail = ''
                    if title and href not in seen_urls:
                        seen_urls.add(href)
                        results.append({
                            'title': title,
                            'url': href,
                            'thumbnail': thumbnail,
                            'site': 'vegamovies'
                        })
    except Exception as e:
        print(f"Error fetching recent Vegamovies: {e}")
        
    # 2. Get from Rogmovies
    try:
        response = requests.get("https://rogmovies.club/", impersonate="chrome120", headers=headers, timeout=12)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            links = soup.find_all('a', href=lambda h: h and '/download-' in h)
            for l in links:
                href = l['href']
                if href.startswith('/'):
                    href = urljoin("https://rogmovies.club/", href)
                if href in seen_urls:
                    continue
                
                img = l.find('img')
                if not img and l.find_parent():
                    img = l.find_parent().find('img')
                
                if img:
                    title = img.get('title') or img.get('alt') or ''
                    thumbnail = img.get('data-src') or img.get('data-lazy-src') or img.get('src') or ''
                    if thumbnail.startswith('/'):
                        thumbnail = urljoin("https://rogmovies.club/", thumbnail)
                    if title.lower().startswith('download '):
                        title = title[9:]
                    if 'data:image' in thumbnail:
                        thumbnail = ''
                    if title and href not in seen_urls:
                        seen_urls.add(href)
                        results.append({
                            'title': title,
                            'url': href,
                            'thumbnail': thumbnail,
                            'site': 'rogmovies'
                        })
    except Exception as e:
        print(f"Error fetching recent Rogmovies: {e}")
        
    return results[:15]

if __name__ == "__main__":
    # Quick test run
    print("Testing search...")
    res = search_movies("Invasion")
    for r in res[:2]:
        print(r)
