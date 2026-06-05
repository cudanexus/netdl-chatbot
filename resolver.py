import re
import datetime
from curl_cffi import requests as cffi_requests
from urllib.parse import urlparse, parse_qs

def get_direct_link(vcloud_url):
    """
    Resolves a vcloud.zip or fastdl.zip URL to its final unthrottled direct download link.
    Handles GPDL Google Stream links, R2 Cloudflare links, FSL minutes-suffix links, and workers.dev.
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        # --- Handle fastdl.zip bypass directly ---
        if 'fastdl.zip' in vcloud_url:
            print(f"[RESOLVER] Requesting FastDL URL: {vcloud_url}")
            response = cffi_requests.get(
                vcloud_url, 
                impersonate="chrome120", 
                headers=headers,
                timeout=15
            )
            if response.status_code != 200:
                print(f"[RESOLVER] Failed FastDL landing page. Status: {response.status_code}")
                return None
                
            html = response.text
            match = re.search(r'var reurl = "([^"]*?)";', html)
            if match:
                reurl = match.group(1)
                if "link=" in reurl:
                    parsed = urlparse(reurl)
                    params = parse_qs(parsed.query)
                    direct_url = params.get("link", [None])[0]
                    if direct_url:
                        print(f"[RESOLVER] Successfully resolved FastDL GDrive Link: {direct_url}")
                        return direct_url
                print(f"[RESOLVER] FastDL redirect URL (no link parameter): {reurl}")
                return reurl
            print("[RESOLVER] Could not find reurl redirection script in FastDL HTML.")
            return None

        print(f"[RESOLVER] Requesting VCloud URL: {vcloud_url}")
        # Fetch the initial vcloud landing page
        response = cffi_requests.get(
            vcloud_url, 
            impersonate="chrome120", 
            headers=headers,
            timeout=15
        )
        if response.status_code != 200:
            print(f"[RESOLVER] Failed landing page. Status: {response.status_code}")
            return None
            
        html = response.text
        
        # Locate the tokenized transition URL
        match = re.search(r"var url = '(https://vcloud\.zip/.*?token=.*?)';", html)
        if not match:
            print("[RESOLVER] Transition token URL not found in landing page.")
            return None
        token_url = match.group(1)
        print(f"[RESOLVER] Transition URL found: {token_url}")
        
        # Fetch the tokenized page where links are generated
        response2 = cffi_requests.get(
            token_url,
            impersonate="chrome120",
            headers=headers,
            timeout=15
        )
        if response2.status_code != 200:
            print(f"[RESOLVER] Failed token page. Status: {response2.status_code}")
            return None
            
        html2 = response2.text
        print(f"[RESOLVER] Token page fetched. Length: {len(html2)}")
        
        # --- 1. GPDL (Google Drive Direct Stream) ---
        match_gpdl = re.search(r'href="(https://gpdl[^"]*?hubcloud\.[^"]*?)"', html2)
        if match_gpdl:
            gpdl_url = match_gpdl.group(1)
            print(f"[RESOLVER] Found GPDL link: {gpdl_url}")
            try:
                # Follow redirect to parse the GDrive parameter
                resp_redirect = cffi_requests.get(
                    gpdl_url,
                    impersonate="chrome120",
                    headers=headers,
                    timeout=15,
                    allow_redirects=True
                )
                final_url = resp_redirect.url
                if "link=" in final_url:
                    parsed = urlparse(final_url)
                    params = parse_qs(parsed.query)
                    direct_url = params.get("link", [None])[0]
                    if direct_url:
                        print(f"[RESOLVER] Successfully resolved GPDL GDrive Link: {direct_url}")
                        return direct_url
                return gpdl_url
            except Exception as gpdl_err:
                print(f"[RESOLVER] GPDL redirect resolution failed: {gpdl_err}")
                return gpdl_url
                
        # --- 2. Cloudflare R2 CDN ---
        match_r2 = re.search(r'href="(https://[^"]*?\.r2\.dev/[^"]*?)"', html2)
        if match_r2:
            r2_url = match_r2.group(1)
            print(f"[RESOLVER] Found Cloudflare R2 CDN Link: {r2_url}")
            return r2_url
            
        # --- 3. FSL (File Stream Link) with dynamic minutes suffix ---
        match_fsl = re.search(r'href="([^"]*?)"[^>]*id="fsl"', html2)
        if not match_fsl:
            match_fsl = re.search(r'id="fsl"[^>]*href="([^"]*?)"', html2)
            
        if match_fsl:
            fsl_url = match_fsl.group(1)
            print(f"[RESOLVER] Found FSL Link: {fsl_url}")
            current_minute = datetime.datetime.now().minute
            suffix = "1" + str(current_minute)
            final_fsl_url = fsl_url + suffix
            print(f"[RESOLVER] FSL Suffix URL: {final_fsl_url}")
            try:
                # Follow redirect to get the R2/Direct link
                resp_fsl = cffi_requests.get(
                    final_fsl_url,
                    impersonate="chrome120",
                    headers=headers,
                    timeout=15,
                    allow_redirects=True
                )
                print(f"[RESOLVER] FSL Redirected to: {resp_fsl.url}")
                return resp_fsl.url
            except Exception as fsl_err:
                print(f"[RESOLVER] FSL redirect request failed: {fsl_err}")
                return final_fsl_url
                
        # --- 4. Workers.dev ---
        match_workers = re.search(r'href="(https://[^"]*?workers\.dev/[^"]*?)"', html2)
        if match_workers:
            workers_url = match_workers.group(1)
            print(f"[RESOLVER] Found workers.dev Link: {workers_url}")
            return workers_url
            
        print("[RESOLVER] No direct link match found in token page HTML.")
        return None
    except Exception as e:
        print(f"[RESOLVER] Exception raised during resolution: {e}")
        return None

if __name__ == "__main__":
    # Test link resolution
    test_url = "https://vcloud.zip/aopoyyuatajxuep"
    print("Testing Resolver with:", test_url)
    res = get_direct_link(test_url)
    print("Resolved Direct Link:", res)
