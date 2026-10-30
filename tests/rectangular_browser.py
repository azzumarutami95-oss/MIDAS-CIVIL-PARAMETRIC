"""Rectangular workspace through real offline Chromium downloads."""
import functools
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import tempfile
import threading
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT/'web/index.html'

def main():
    errors=[];external=[]
    class Quiet(SimpleHTTPRequestHandler):
        def log_message(self,*args):pass
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(HTML.parent)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    url=f'http://127.0.0.1:{server.server_port}/{HTML.name}'
    try:
        with tempfile.TemporaryDirectory(prefix='rect-browser-') as td,sync_playwright() as p:
            folder=Path(td);browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            context=browser.new_context(accept_downloads=True,viewport={'width':1440,'height':1000})
            page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
            context.on('request',lambda req:external.append(req.url) if req.url.startswith(('http:','https:')) and not req.url.startswith('http://127.0.0.1:') else None)
            context.route('http://**',lambda route:route.continue_() if route.request.url.startswith('http://127.0.0.1:') else route.abort())
            context.route('https://**',lambda route:route.abort())
            page.goto(url);page.wait_for_function('window.NXWorkspace')
            field=lambda key:page.locator('[data-key="'+key+'"]')
            def pane(name):page.locator('.nx-ribbon-tabs [data-workspace="'+name+'"]').click()
            def edit(key,value):
                name=field(key).evaluate("el=>el.closest('.nx-pane').id");pane(name);field(key).fill(str(value));page.wait_for_timeout(230)
            def download(button,name):
                with page.expect_download() as event:page.locator('#'+button).click()
                item=event.value;assert item.suggested_filename==name
                dest=folder/name;item.save_as(dest);return dest
            assert field('geometry.shape').input_value()=='circular'
            assert page.locator('#metrics-nodes').inner_text()=='26.433'
            assert not field('geometry.width').is_visible()
            field('geometry.shape').select_option('rectangular')
            page.wait_for_function("document.querySelector('#mesh-side').dataset.shape==='rectangular'")
            assert field('geometry.width').is_visible() and not field('geometry.diameter').is_visible()
            for key,value in [('geometry.width',8),('geometry.depth',3),('geometry.heightOld',2),('geometry.heightNew',3),('mesh.divX',4),('mesh.divY',3),('mesh.layersOld',2),('mesh.layersNew',3)]:edit(key,value)
            assert page.locator('#metrics-nodes').inner_text()=='120'
            assert page.locator('#metrics-elements').inner_text()=='60'
            assert '120,00' in page.locator('#metrics-volume').inner_text()
            assert 'B 8' in page.locator('#mesh-side').text_content() and 'L 3' in page.locator('#mesh-side').text_content()
            assert 'Ø' not in page.locator('#mesh-side').text_content()
            assert 'B 8,00' in page.locator('#mesh-plan').text_content()
            for view in ['front','top','iso']:
                page.locator('[data-nx-view="'+view+'"]').click()
                assert page.locator('#mesh-side').get_attribute('data-render-view')==view
            mesh=page.locator('#mesh-side');box=mesh.bounding_box();x=box['x']+box['width']*.6;y=box['y']+box['height']*.5
            page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+65,y+20,steps=6);page.mouse.up()
            page.wait_for_function("document.querySelector('#mesh-side').dataset.renderView==='orbit'")
            page.mouse.wheel(0,-200);page.wait_for_timeout(150);assert page.evaluate('HydrationViewport.state.zoom')>1
            page.locator('#nx-fit-view').click();assert page.evaluate('HydrationViewport.state.zoom')==1
            page.locator('#nx-toggle-mesh').click();assert mesh.get_attribute('data-mesh')=='false';page.locator('#nx-toggle-mesh').click()
            for value in ['old','new','all']:
                page.locator('#nx-stage-select').select_option(value);assert mesh.get_attribute('data-stage')==value
            page.locator('#nx-stage-select').select_option('new')
            mct=download('export-mct','PILAR_HEAT_HYDRATION.MCT').read_text()
            lines=mct.splitlines();start=lines.index('*ELEMENT')+1;end=next(i for i in range(start,len(lines)) if lines[i].startswith('*'))
            assert len([s for s in lines[start:end] if s.strip() and not s.startswith(';')])==60
            assert 'Geometry shape=rectangular; X=8m; Y=3m; height=5m.' in mct
            assert '*TDM-LINK' in mct and '0, 0, -1, LG_SW' in mct
            page.locator('#nx-stage-select').select_option('all')
            pane('material-waktu');page.locator('#td-use-geometry').click();page.wait_for_timeout(230)
            assert abs(float(field('timeDependent.notionalSize').input_value())-24/11)<1e-12
            assert abs(float(field('timeDependent.volumeSurface').input_value())-12/11)<1e-12
            assert 'B·L' in page.locator('#td-geometry-formula').inner_text()
            report=download('download-report','RINGKASAN_INPUT_HIDRASI.txt').read_text()
            assert 'rectangular; lebar B(X)=8 m; panjang L(Y)=3 m' in report and 'luas=24m2' in report
            saved=download('export-json','PARAMETER_HEAT_HYDRATION.json');data=json.loads(saved.read_text())
            assert data['config']['geometry']['shape']=='rectangular' and data['config']['mesh']['divY']==3
            pane('model');field('geometry.shape').select_option('circular');edit('geometry.diameter',5)
            field('geometry.shape').select_option('rectangular');assert field('geometry.width').input_value()=='8'
            assert field('mesh.divX').input_value()=='4'
            edit('geometry.width',9);page.locator('#import-file').set_input_files(saved)
            page.wait_for_function("document.querySelector('#export-status').textContent.includes('berhasil dimuat')")
            assert field('geometry.width').input_value()=='8'
            page.reload();page.wait_for_function('window.NXWorkspace');assert field('geometry.shape').input_value()=='rectangular'
            edit('geometry.width',0);assert page.locator('#export-mct').is_disabled();assert field('geometry.width').get_attribute('aria-invalid')=='true';edit('geometry.width',8)
            legacy=json.loads(saved.read_text())
            for k in ['shape','width','depth']:legacy['config']['geometry'].pop(k)
            for k in ['divX','divY']:legacy['config']['mesh'].pop(k)
            old=folder/'legacy.json';old.write_text(json.dumps(legacy));page.locator('#import-file').set_input_files(old)
            page.wait_for_function("document.querySelector('#export-status').textContent.includes('berhasil dimuat')")
            assert field('geometry.shape').input_value()=='circular' and field('geometry.diameter').input_value()=='7.5'
            malformed=json.loads(saved.read_text());malformed['config']['geometry'].pop('width')
            bad=folder/'bad.json';bad.write_text(json.dumps(malformed));page.locator('#import-file').set_input_files(bad)
            page.wait_for_function("document.querySelector('#export-status').textContent.includes('tidak dimuat')")
            assert field('geometry.shape').input_value()=='circular'
            field('geometry.shape').select_option('rectangular');page.wait_for_timeout(230)
            page.screenshot(path=str(ROOT/'work'/'rectangular-desktop.png'))
            page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(230)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            assert field('geometry.width').is_visible()
            assert not errors,errors;assert not external,external
            browser.close()
            print('PASS: rectangular dimensions/mesh/viewport, camera/filter controls, MCT/JSON/report, shape switching, legacy migration, validation, C&S helper and mobile/offline UI.')
    finally:server.shutdown()

if __name__=='__main__':main()
