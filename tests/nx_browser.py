"""NX workspace integration checks against the actual standalone HTML.

Uses a loopback server because managed Chromium blocks file:// by policy.
Native NX import/solver is outside the scope of this browser test.
"""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import tempfile
import threading

from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT/'downloads/CIVIL_HEAT_HYDRATION_NX.html'


def main():
    errors=[];external=[]
    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self,format,*args):pass
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(HTML.parent)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    url=f'http://127.0.0.1:{server.server_port}/{HTML.name}'
    with tempfile.TemporaryDirectory(prefix='nx-browser-') as temp, sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        context=browser.new_context(accept_downloads=True,viewport={'width':1440,'height':1000})
        page=context.new_page()
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('request',lambda request:external.append(request.url) if request.url.startswith(('http:','https:')) and not request.url.startswith('http://127.0.0.1:') else None)
        context.route('http://**',lambda route:route.continue_() if route.request.url.startswith('http://127.0.0.1:') else route.abort())
        context.route('https://**',lambda route:route.abort())
        page.goto(url)
        page.wait_for_function("window.NXWorkspace && document.querySelector('#mesh-side').dataset.renderView === 'iso'")
        assert page.locator('.nx-pane:visible').count()==1
        assert page.locator('#model').is_visible()
        assert page.locator('#metrics-nodes').inner_text()=='26.433'
        assert page.locator('#nx-model-node-count').inner_text()=='26.433'
        assert page.locator('#nx-model-element-count').inner_text()=='24.576'

        for pane in ['campuran','termal','tahapan','ekspor','model']:
            page.locator('.nx-ribbon-tabs [data-workspace="'+pane+'"]').click()
            assert page.locator('.nx-pane:visible').count()==1
            assert page.locator('#'+pane).is_visible()
            assert page.locator('.nx-ribbon-tabs [data-workspace="'+pane+'"]').get_attribute('aria-selected')=='true'
        page.locator('.nx-model-tree [data-workspace="termal"]').first.click()
        assert page.locator('#termal').is_visible()
        page.locator('.nx-ribbon-tabs [data-workspace="model"]').click()

        for view in ['front','top','iso']:
            page.locator('[data-nx-view="'+view+'"]').click()
            assert page.locator('#mesh-side').get_attribute('data-render-view')==view
            assert page.locator('[data-nx-view="'+view+'"]').get_attribute('aria-pressed')=='true'
            assert page.locator('#mesh-side text').all_text_contents().count('X')==1
            assert page.locator('#mesh-side text').all_text_contents().count('Y')==1
            assert page.locator('#mesh-side text').all_text_contents().count('Z')==1
        mesh=page.locator('#mesh-side')
        before=mesh.inner_html()
        page.locator('#nx-toggle-mesh').click()
        assert mesh.get_attribute('data-mesh')=='false'
        assert page.locator('#nx-toggle-mesh').get_attribute('aria-pressed')=='false'
        assert mesh.inner_html()!=before
        assert mesh.locator('path[stroke="none"]').count()>0
        page.locator('#nx-toggle-mesh').click()
        assert mesh.get_attribute('data-mesh')=='true'

        for group,caption in [('old','BETON LAMA'),('new','BETON BARU'),('all','DUA SEGMEN')]:
            page.locator('#nx-stage-select').select_option(group)
            assert mesh.get_attribute('data-stage')==group
            assert any(caption in text for text in mesh.locator('text').all_text_contents())
        # Visual isolation must not deactivate exported solids.
        page.locator('#nx-stage-select').select_option('old')
        with page.expect_download() as event:page.locator('#export-mct').click()
        item=event.value;assert item.suggested_filename=='PILAR_HEAT_HYDRATION.MCT'
        target=Path(temp)/item.suggested_filename;item.save_as(target)
        text=target.read_text()
        lines=text.splitlines();start=lines.index('*ELEMENT')+1;end=next(i for i in range(start,len(lines)) if lines[i].startswith('*'))
        assert len([s for s in lines[start:end] if s.strip() and not s.startswith(';')])==24576
        page.locator('#nx-stage-select').select_option('all')
        page.locator('[data-nx-view="iso"]').click()
        box=mesh.bounding_box();assert box and box['width']>200 and box['height']>200
        x=box['x']+box['width']*.58;y=box['y']+box['height']*.42
        page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+80,y+30,steps=8);page.mouse.up()
        page.wait_for_function("document.querySelector('#mesh-side').dataset.renderView === 'orbit'")
        assert page.locator('[data-nx-view][aria-pressed="true"]').count()==0
        page.mouse.move(x,y);page.mouse.wheel(0,-300)
        page.wait_for_timeout(160)
        assert page.evaluate('window.HydrationViewport.state.zoom')>1
        page.locator('#nx-fit-view').click()
        assert page.evaluate('window.HydrationViewport.state.zoom')==1
        page.locator('[data-nx-view="iso"]').click()
        assert page.locator('#nx-console').inner_text()
        page.screenshot(path='/tmp/nxdesktop.png')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Desktop page overflow'

        mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        mp=mobile.new_page();mp.on('pageerror',lambda error:errors.append(str(error)))
        mp.goto(url);mp.wait_for_function("window.NXWorkspace && document.querySelector('#mesh-side').dataset.renderView === 'iso'")
        assert mp.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile page overflow'
        assert mp.locator('.nx-pane:visible').count()==1
        mp.screenshot(path='/tmp/nxmobile.png')
        for pane in ['campuran','termal','tahapan','ekspor','model']:
            button=mp.locator('.nx-ribbon-tabs [data-workspace="'+pane+'"]')
            button.click()
            assert mp.locator('#'+pane).is_visible()
            assert mp.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile overflow in '+pane
        mobile.close();context.close();browser.close()
    server.shutdown();server.server_close()
    assert not errors,errors
    assert not external,external
    print('PASS: NX tabs/tree, camera views, orbit/zoom/fit, mesh toggle, group isolation, unchanged MCT counts, desktop/mobile layout and no external assets.')


if __name__=='__main__':main()
