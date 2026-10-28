"""Browser checks for actual thermal-calculator MCT/JSON exports, not native NX."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import math
from pathlib import Path
import sys
import tempfile
import threading

from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT/'downloads/CIVIL_HEAT_HYDRATION_NX.html'


def cards(text):
    lines=text.splitlines();start=lines.index('*MATERIAL')+1;out=[]
    for line in lines[start:]:
        if line.startswith('*'):break
        if line.strip() and not line.startswith(';'):out.append([x.strip() for x in line.split(',')])
    return out


def main():
    errors=[];external=[]
    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self,fmt,*args):pass
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(HTML.parent)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    url=f'http://127.0.0.1:{server.server_port}/{HTML.name}'
    with tempfile.TemporaryDirectory(prefix='thermal-browser-') as temp,sync_playwright() as p:
        directory=Path(temp)
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        context=browser.new_context(accept_downloads=True,viewport={'width':1440,'height':1000})
        page=context.new_page();page.on('pageerror',lambda err:errors.append(str(err)))
        page.on('request',lambda req:external.append(req.url) if req.url.startswith(('http:','https:')) and not req.url.startswith('http://127.0.0.1:') else None)
        context.route('http://**',lambda route:route.continue_() if route.request.url.startswith('http://127.0.0.1:') else route.abort())
        context.route('https://**',lambda route:route.abort())
        page.goto(url);page.wait_for_function("window.NXWorkspace && document.querySelector('#validation-summary').textContent==='Input dapat diekspor'")
        def field(key):return page.locator('[data-key="'+key+'"]')
        def pane(name):page.locator('.nx-ribbon-tabs [data-workspace="'+name+'"]').click()
        def edit(key,value):field(key).fill(str(value));page.wait_for_timeout(240)
        def select(key,value):field(key).select_option(value);page.wait_for_timeout(220)
        def download(button,filename):
            with page.expect_download() as event:page.locator('#'+button).click()
            item=event.value;assert item.suggested_filename==filename
            target=directory/filename;item.save_as(target);return target
        pane('campuran')
        assert page.locator('.mix-table thead th').first.inner_text()=='Bahan'
        assert page.locator('.mix-table tbody tr td:first-child span').count()==0
        pane('termal')
        assert page.locator('#thermal-cp-active').inner_text()=='0,900000'
        assert page.locator('#thermal-heatco').inner_text()=='8,640000'
        edit('material.cp',1.12);edit('material.conductivity',2.8)
        select('thermal.cpMode','mixture');select('thermal.kMode','geometric')
        assert field('material.cp').is_disabled() and field('material.conductivity').is_disabled()
        assert field('material.cp').input_value()=='1.12' and field('material.conductivity').input_value()=='2.8'
        assert page.locator('#thermal-cp-active').inner_text()=='1,026671'
        assert page.locator('#thermal-k-active').inner_text()=='1,955368'
        assert page.locator('#thermal-heatco').inner_text()=='7,039325'
        select('thermal.oldMode','manual');edit('thermal.oldCp',.95);edit('thermal.oldK',1.7)
        assert page.locator('#thermal-old-properties').is_visible()
        text=download('export-mct','PILAR_HEAT_HYDRATION.MCT').read_text();material=cards(text)
        assert math.isclose(float(material[0][3]),.95) and math.isclose(float(material[0][4]),6.12)
        assert math.isclose(float(material[1][3]),1.0266706783279616,abs_tol=1e-9)
        assert math.isclose(float(material[1][4]),7.039324596302525,abs_tol=1e-9)
        assert '1to12288, OLD_ZERO' in text
        pane('ekspor');preview=page.locator('#mct-preview').input_value()
        assert 'FC_NEW, 1.026670678, 7.039324596' in preview
        assert 'FC_OLD, 0.950000000, 6.120000000' in preview
        saved=download('export-json','PARAMETER_HEAT_HYDRATION.json');snap=json.loads(saved.read_text())
        assert snap['config']['material']['cp']==1.12
        assert snap['config']['thermal']['cpMode']=='mixture'
        assert math.isclose(snap['thermal_calculation']['cp'],1.0266706783279616)
        assert snap['thermal_calculation']['oldK']==1.7
        report=download('download-report','RINGKASAN_INPUT_HIDRASI.txt').read_text()
        assert 'cp=mixture' in report and 'k=geometric' in report and 'Beton lama: cp=0.95' in report
        assert '110880.' in report and 'ConcreteEC2' in report
        pane('termal');select('thermal.cpMode','manual');select('thermal.kMode','manual')
        assert field('material.cp').is_enabled() and field('material.cp').input_value()=='1.12'
        assert page.locator('#thermal-cp-active').inner_text()=='1,120000'
        page.locator('#import-file').set_input_files(saved)
        page.wait_for_function("document.querySelector('#export-status').textContent.includes('berhasil dimuat')")
        assert field('thermal.cpMode').input_value()=='mixture'
        page.reload();page.wait_for_function("window.NXWorkspace && document.querySelector('#validation-summary').textContent==='Input dapat diekspor'")
        pane('termal');assert field('thermal.cpMode').input_value()=='mixture'
        # Legacy JSON uses the same v1 schema with no calculator-specific groups.
        legacy=snap['config'];del legacy['thermal'];del legacy['thermalComponents']
        legacy['material']['cp']=1.17;legacy['material']['conductivity']=2.63
        legacy_file=directory/'legacy.json';legacy_file.write_text(json.dumps({'schema':'civil-heat-studio/v1','config':legacy}))
        page.locator('#import-file').set_input_files(legacy_file)
        page.wait_for_function("document.querySelector('#export-status').textContent.includes('berhasil dimuat')")
        assert field('thermal.cpMode').input_value()=='manual'
        assert page.locator('#thermal-cp-active').inner_text()=='1,170000'
        assert field('material.conductivity').input_value()=='2.63'
        select('thermal.cpMode','ec2_dry');select('thermal.kMode','ec2_lower');edit('thermal.referenceTemperature',20)
        assert page.locator('#thermal-cp-active').inner_text()=='0,900000'
        assert page.locator('#thermal-k-active').inner_text()=='1,333028'
        assert 'kebakaran' in page.locator('#thermal-method-note').inner_text()
        edit('thermal.referenceTemperature',19)
        assert page.locator('#export-mct').is_disabled()
        assert field('thermal.referenceTemperature').get_attribute('aria-invalid')=='true'
        edit('thermal.referenceTemperature',30);select('thermal.cpMode','mixture');select('thermal.kMode','geometric')
        page.locator('.thermal-component-details summary').click()
        edit('thermalComponents.waterK',-.5)
        assert page.locator('#export-mct').is_disabled()
        edit('thermalComponents.waterK',.6)
        assert page.locator('#export-mct').is_enabled()
        before=page.locator('#thermal-cp-active').inner_text();pane('campuran');edit('mix.water',160)
        pane('termal');assert page.locator('#thermal-cp-active').inner_text()!=before
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        # Screenshot shows the live audit card in the actual thermal pane.
        page.locator('.thermal-component-details summary').click()
        page.screenshot(path='/tmp/thermal-desktop.png')
        mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        mp=mobile.new_page();mp.on('pageerror',lambda err:errors.append(str(err)))
        mp.goto(url);mp.wait_for_function('window.NXWorkspace')
        mp.locator('.nx-ribbon-tabs [data-workspace="termal"]').click()
        assert mp.evaluate('document.documentElement.scrollWidth <= innerWidth')
        mp.screenshot(path='/tmp/thermal-mobile.png')
        mp.locator('.thermal-component-details summary').click()
        assert mp.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert mp.locator('.thermal-component-table').evaluate('el=>el.scrollWidth')>=mp.locator('.thermal-component-table').evaluate('el=>el.clientWidth')
        mobile.close();context.close();browser.close()
    server.shutdown();server.server_close()
    assert not errors,errors
    assert not external,external
    print('PASS: calculated/manual material modes, old override, actual MCT/JSON/report values, legacy migration, validation, mix updates and responsive thermal UI; native MIDAS not executed.')


if __name__=='__main__':main()
