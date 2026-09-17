"""Isolated browser QA. Uses an in-memory SDK adapter, never a live database or email service.
Run after `npm run build`. Requires Python Playwright and a Chromium binary.
"""
import asyncio,json,mimetypes,re,os,traceback
from pathlib import Path
from urllib.parse import urlparse,unquote
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]; DIST=ROOT/'dist'; OUT=ROOT/'test-results'/'browser'; OUT.mkdir(parents=True,exist_ok=True)
FIXTURE=(ROOT/'tests/fixtures/mock-browser.js').read_text()
results=[];errors=[]
def uid(n): return f'10000000-0000-4000-8000-{n:012d}'
async def run():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  async def page_new(options=None,width=1440,height=1000):
   options=options or {};context=await browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1)
   await context.add_init_script('window.__fixtureOptions='+json.dumps(options)+';\n'+FIXTURE)
   async def route_handler(route):
    url=urlparse(route.request.url)
    if url.hostname=='127.0.0.1' and not url.path.startswith('/__mock/'):
     name=unquote(url.path).lstrip('/') or 'index.html';file=(DIST/name).resolve()
     if not str(file).startswith(str(DIST.resolve())+os.sep) or not file.is_file(): await route.fulfill(status=404,body='Not found');return
     mime=mimetypes.guess_type(file)[0] or 'application/octet-stream';data=file.read_bytes()
     # Test-only transport changes: loopback is the only browser origin allowed in this sandbox.
     # Product/configuration files in the deliverable remain unchanged.
     if name=='js/supabase-config.js': data=re.sub(rb'https://[a-z]+\.supabase\.co',b'http://127.0.0.1:8787/__mock',data)
     if name=='js/store/config.js' and not options.get('localPreview'): data=re.sub(rb'export const LOCAL_PREVIEW = [^;]+;',b'export const LOCAL_PREVIEW = false;',data)
     await route.fulfill(status=200,content_type=mime,body=data);return
    if url.path.startswith('/__mock/'):
     if '/storage/v1/' in url.path:
      match=re.search(r'category-(\d+)\.webp',url.path);file=ROOT/'tests/fixtures/images'/f'category-{match.group(1)}.webp' if match else DIST/'assets/equipment-placeholder.svg'
      await route.fulfill(status=200,content_type='image/webp' if match else 'image/svg+xml',body=file.read_bytes());return
     if '/functions/v1/bills-enquiries' in url.path:
      if route.request.method=='GET':data={'configured':True,'ready':bool(options.get('enquiries'))};status=200
      else:
       data={'reference':'BE-A12345678901','received':True};status=201
       if options.get('submitFails'):data={'message':'Simulated server failure. Your details were kept.'};status=503
      await route.fulfill(status=status,headers={'Access-Control-Allow-Origin':'http://127.0.0.1:8787','Access-Control-Allow-Headers':'content-type,authorization'},content_type='application/json',body=json.dumps(data));return
    await route.abort()
   await context.route('**/*',route_handler)
   page=await context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   return context,page
  async def check(name,fn):
   try:await fn();results.append({'test':name,'passed':True});print('PASS',name,flush=True)
   except Exception as error:results.append({'test':name,'passed':False,'error':str(error)});print('FAIL',name,str(error)[:200],flush=True)
  async def storefront():
   context,page=await page_new(width=1672,height=1060)
   await page.goto('http://127.0.0.1:8787/');await page.locator('.category-grid .category-card').first.wait_for();assert await page.locator('.category-grid .category-card').count()==12
   assert await page.locator('[data-catalog="equipment"]').get_attribute('aria-current')=='page'
   assert await page.locator('[data-catalog="oem-catalogs"]').count()==0
   assert await page.locator('.brand img').first.evaluate('(img)=>img.naturalWidth')>0
   await page.screenshot(path=str(OUT/'storefront-desktop.png'),full_page=True)
   await page.locator('[data-catalog="equipment"]').click();await page.locator('#departmentPanel').wait_for(state='visible');assert await page.locator('#departmentGrid .category-card').count()==12
   await page.screenshot(path=str(OUT/'department-panel.png'),full_page=False)
   await page.keyboard.press('Escape');await page.locator('#departmentPanel').wait_for(state='hidden')
   assert await page.locator('[data-catalog="equipment"]').evaluate('(n)=>n===document.activeElement')
   await context.close()
  await check('Desktop storefront, real logo, category cards and keyboard department panel',storefront)
  async def listings():
   context,page=await page_new()
   await page.goto('http://127.0.0.1:8787/products.html');await page.locator('.product-card').first.wait_for();assert await page.locator('.product-card').count()==12
   assert 'Draft' not in await page.locator('#productResults').inner_text()
   await page.locator('#filterQuery').fill('DEMO-8');await page.wait_for_timeout(550);assert await page.locator('.product-card').count()==1;assert 'q=DEMO-8' in page.url
   await page.locator('#clearFilters').click();await page.wait_for_timeout(150);assert await page.locator('.product-card').count()==12
   await page.go_back();await page.wait_for_timeout(150);assert await page.locator('#filterQuery').input_value()=='DEMO-8'
   await page.goto('http://127.0.0.1:8787/products.html?category='+uid(107));await page.locator('.product-card').first.wait_for();await page.screenshot(path=str(OUT/'product-list.png'),full_page=True)
   await context.close()
  await check('Product filtering, URL state and browser-back restoration',listings)
  async def cart():
   context,page=await page_new()
   await page.goto('http://127.0.0.1:8787/productDesc.html?id='+uid(8));await page.locator('#detailQuantity').wait_for();await page.screenshot(path=str(OUT/'product-details.png'),full_page=True)
   assert '$799.00' in await page.locator('.detail-price').inner_text()
   await page.locator('#detailQuantity').fill('2');await page.locator('[data-detail-add]').click();await page.locator('#cartDialog').wait_for(state='visible');assert 'Qty 2' in await page.locator('#drawerContent').inner_text()
   await page.locator('#drawerContent a[href="cart.html"]').click();await page.locator('[data-cart-quantity]').wait_for();assert await page.locator('[data-cart-quantity]').input_value()=='2'
   await page.locator('#requestForm [name=name]').fill('Keep this name');await page.locator('[data-cart-quantity]').fill('3');await page.locator('[data-cart-quantity]').press('Tab');await page.wait_for_timeout(200);assert await page.locator('#requestForm [name=name]').input_value()=='Keep this name'
   assert await page.locator('#requestForm [type=submit]').is_disabled();assert 'not currently enabled' in await page.locator('.form-status').inner_text()
   await page.screenshot(path=str(OUT/'request-cart.png'),full_page=True)
   await page.reload();await page.locator('[data-cart-quantity]').wait_for();assert await page.locator('[data-cart-quantity]').input_value()=='3'
   stored=await page.evaluate('JSON.parse(localStorage.getItem("bills.request-cart.v2"))');assert set(stored[0])=={'id','mode','quantity'}
   await page.locator('[data-cart-delete]').click();await page.get_by_text('Your request cart is empty',exact=True).wait_for();await context.close()
  await check('Quote cart, quantities, retained form, reload persistence, disabled submission and removal',cart)
  async def rental_global():
   context,page=await page_new();await page.goto('http://127.0.0.1:8787/');await page.locator('.category-card').first.wait_for()
   link=page.locator('.category-grid .category-card').filter(has_text='Scissor Lifts');assert 'rentals.html' in await link.get_attribute('href')
   await link.click();await page.locator('.product-card').first.wait_for();assert await page.locator('.product-card').count()==1
   assert 'Request rental rate' in await page.locator('.product-price').inner_text()
   await page.locator('#headerSearch').fill('Scissor');await page.locator('#headerSearch').press('Enter');await page.locator('.product-card').first.wait_for();assert 'mode=all' in page.url;assert 'Scissor Lift' in await page.locator('.product-card').inner_text()
   await context.close()
  await check('Rental-only category routing and global search across sales/rentals',rental_global)
  async def pages_mobile():
   context,page=await page_new()
   for width in [320,390,768,1024,1920]:
    await page.set_viewport_size({'width':width,'height':950})
    for file in ['index.html','products.html','contact.html','about.html','brands.html','privacy.html','admin-login.html']:
     await page.goto('http://127.0.0.1:8787/'+file);await page.wait_for_timeout(70)
     overflow=await page.evaluate('document.documentElement.scrollWidth>innerWidth+2')
     if overflow:
      await page.screenshot(path=str(OUT/f'overflow-{width}-{file}.png'),full_page=True)
      elements=await page.evaluate('Array.from(document.querySelectorAll("body *")).filter(e=>e.getBoundingClientRect().right>innerWidth+2).map(e=>[e.tagName,e.className,e.getBoundingClientRect().right]).slice(0,6)')
      raise AssertionError(f'Horizontal overflow {file} at {width}px: {elements}')
   await page.set_viewport_size({'width':390,'height':844});await page.goto('http://127.0.0.1:8787/');await page.locator('.category-card').first.wait_for();await page.screenshot(path=str(OUT/'storefront-mobile.png'),full_page=True)
   await page.locator('#mobileMenuButton').click();await page.locator('[data-catalog="concrete"]').click();await page.locator('#departmentPanel').wait_for(state='visible');await page.screenshot(path=str(OUT/'departments-mobile.png'),full_page=True)
   await context.close()
  await check('Seven public pages at five viewport widths and mobile department interaction',pages_mobile)
  async def error_modes():
   context,page=await page_new({'networkError':True});await page.goto('http://127.0.0.1:8787/');await page.get_by_text('Unable to load this content',exact=True).wait_for();assert await page.locator('.category-card').count()==0;assert '305-591-3933' in await page.locator('.utility-bar').inner_text();await context.close()
   context,page=await page_new({'legacy':True});await page.goto('http://127.0.0.1:8787/');await page.locator('.category-card').first.wait_for();await page.goto('http://127.0.0.1:8787/productDesc.html?id=invalid');await page.get_by_text('Listing not found',exact=True).wait_for();await context.close()
  await check('Honest network error, legacy database fallback and invalid product IDs',error_modes)
  async def admin_auth():
   context,page=await page_new();await page.goto('http://127.0.0.1:8787/admin.html');await page.wait_for_url('**/admin-login.html?reason=unauthorized');assert await page.locator('#loginForm').count()==1;await context.close()
   context,page=await page_new({'staff':True,'legacy':True});await page.goto('http://127.0.0.1:8787/admin.html');await page.locator('#adminApp').wait_for(state='visible');assert 'Read-only compatibility mode' in await page.locator('#adminBanner').inner_text();assert await page.locator('[data-new-product]').is_disabled();await context.close()
  await check('Employee access gate and legacy manager stays read-only',admin_auth)
  async def manager():
   context,page=await page_new({'staff':True,'failAfterCommit':True});await page.goto('http://127.0.0.1:8787/admin.html');await page.locator('#adminApp').wait_for(state='visible');await page.screenshot(path=str(OUT/'employee-products.png'),full_page=True)
   before=await page.evaluate('__fixtureDB.products.length');await page.locator('[data-new-product]').click();await page.locator('#productEditor [name=name]').fill('Test New Equipment');await page.locator('#productEditor [name=category]').first.check();await page.locator('#saveEditor').click();await page.locator('#editorMessage').filter(has_text='could not be confirmed').wait_for();assert await page.locator('#editorDialog').is_visible()
   await page.locator('#saveEditor').click();await page.locator('#editorDialog').wait_for(state='hidden');assert await page.evaluate('__fixtureDB.products.length')==before+1
   calls=await page.evaluate('__fixtureDB.calls.filter(c=>c.name==="bills_save_product")');assert len(calls)==2;assert calls[0]['args']['p_product']['id']==calls[1]['args']['p_product']['id'];assert calls[0]['args']['p_operation_id']==calls[1]['args']['p_operation_id']
   assert await page.evaluate('__fixtureDB.products.at(-1).is_published')==False
   await page.locator('[data-tab=organization]').click();await page.locator('.org-layout').wait_for();await page.screenshot(path=str(OUT/'employee-organization.png'),full_page=True)
   await page.locator('[data-new-category]').first.click();await page.locator('#categoryEditor [name=name]').fill('New Category');await page.locator('#categoryEditor [name=slug]').fill('new-category');await page.locator('#saveEditor').click();await page.locator('#editorDialog').wait_for(state='hidden');assert await page.evaluate('__fixtureDB.categories.some(c=>c.name==="New Category")')
   await page.locator('[data-tab=products]').click();await page.locator('[data-edit-product="'+uid(8)+'"]').click();await page.locator('#productEditor [name=category]').first.check();await page.screenshot(path=str(OUT/'employee-product-editor.png'),full_page=True);await page.locator('#saveEditor').click();await page.locator('#editorDialog').wait_for(state='hidden');assert await page.evaluate('__fixtureDB.products.find(p=>p.id==="'+uid(8)+'").category_ids.length')==2
   await page.locator('[data-tab=settings]').click();await page.locator('#settingsForm').wait_for();await page.locator('[name=hero_title]').fill('Updated hero title');await page.locator('#saveSettings').click();await page.wait_for_timeout(150);assert await page.evaluate('__fixtureDB.settings.hero_title')=='Updated hero title'
   await page.locator('[data-tab=enquiries]').click();await page.wait_for_timeout(100);await page.locator('[data-tab=history]').click();await page.wait_for_timeout(100)
   await context.close()
  await check('Employee create/retry, draft default, category assignment, settings and read views',manager)
  async def draft_preview():
   context,page=await page_new({'staff':True});await page.goto('http://127.0.0.1:8787/preview.html?id='+uid(80));await page.get_by_text('Demo Draft — private',exact=True).wait_for();assert 'unpublished draft' in await page.locator('#privatePreview').inner_text();assert await page.locator('[data-add]').count()==0;await context.close()
   context,page=await page_new();await page.goto('http://127.0.0.1:8787/preview.html?id='+uid(80));await page.get_by_text('Employee login required',exact=True).wait_for();assert 'Demo Draft' not in await page.content();await context.close()
  await check('Draft preview is employee-gated and disables cart actions',draft_preview)
  async def forms():
   for failing in [True,False]:
    context,page=await page_new({'enquiries':True,'submitFails':failing});await page.goto('http://127.0.0.1:8787/contact.html');await page.locator('#requestForm').wait_for();await page.locator('[name=name]').fill('Example Customer');await page.locator('[name=email]').fill('test@example.com');await page.locator('[name=phone]').fill('3055550100');await page.locator('[name=message]').fill('Please contact me about equipment.');await page.locator('[name=consent]').check();await page.locator('#requestForm [type=submit]').click()
    if failing:
     await page.locator('.form-status').filter(has_text='Simulated server failure').wait_for();assert await page.locator('[name=name]').input_value()=='Example Customer';assert await page.get_by_text('Request received',exact=True).count()==0
    else:await page.get_by_text('Request received',exact=True).wait_for();assert 'BE-A12345678901' in await page.locator('#contactFormMount').inner_text()
    await context.close()
  await check('Contact form preserves failed input and only confirms a returned receipt',forms)
  async def pagination():
   context,page=await page_new({'manyProducts':True});await page.goto('http://127.0.0.1:8787/products.html');await page.locator('.product-card').first.wait_for();assert await page.locator('.product-card').count()==24;await page.locator('#pagination button').last.click();await page.wait_for_timeout(100);assert 'page=2' in page.url;await context.close()
  await check('Product pagination uses URL state and 24-item pages',pagination)
  await browser.close()
 results.append({'test':'No unhandled browser JavaScript exceptions','passed':not errors,'errors':errors})
 (OUT/'results.json').write_text(json.dumps({'isolated':True,'live_services_tested':False,'checks':results},indent=2))
 print(json.dumps({'passed':sum(x['passed'] for x in results),'total':len(results),'errors':errors},indent=2),flush=True)
 if any(not x['passed'] for x in results):raise SystemExit(1)
asyncio.run(run())
