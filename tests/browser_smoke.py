"""Functional smoke tests through actual Chromium downloads with no external assets.

The managed browser blocks file:// by administrator policy. Serving identical
content on loopback tests the app without changing that policy.

Usage: python3 tests/browser_smoke.py [path/to/standalone.html]
"""
import json
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import tempfile
import threading

from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT/'web/index.html'


def section(text,name):
    lines=text.splitlines();start=lines.index(name)+1;result=[]
    for line in lines[start:]:
        if line.startswith('*'):break
        if line.strip() and not line.startswith(';'):result.append(line)
    return result


def main():
    errors=[];requests=[]
    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self,format,*args):pass
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(HTML.parent)))
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    with tempfile.TemporaryDirectory(prefix='civil-smoke-') as td, sync_playwright() as p:
        folder=Path(td)
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        context=browser.new_context(accept_downloads=True,viewport={'width':1440,'height':1000})
        page=context.new_page()
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda req:requests.append(req.url) if req.url.startswith(('http:','https:')) and not req.url.startswith('http://127.0.0.1:') else None)
        context.route('http://**',lambda route:route.continue_() if route.request.url.startswith('http://127.0.0.1:') else route.abort())
        context.route('https://**',lambda route:route.abort())
        page.goto(f'http://127.0.0.1:{server.server_port}/{HTML.name}')
        page.wait_for_function("document.querySelector('#validation-summary').textContent === 'Input dapat diekspor'")
        assert page.locator('#metrics-nodes').inner_text()=='26.433'
        assert page.locator('#metrics-elements').inner_text()=='24.576'
        assert page.locator('#mix-wc').inner_text()=='0,350'
        assert page.locator('#mix-wb').inner_text()=='0,280'
        for svg in ['mesh-plan','mesh-side','heat-chart']:
            assert page.locator('#'+svg+' path, #'+svg+' polygon').count()>0

        def reveal(locator):
            pane=locator.evaluate("el => el.closest('.nx-pane')?.id || null")
            if pane:
                page.locator('.nx-ribbon-tabs [data-workspace="'+pane+'"]').click()
                assert page.locator('#'+pane).is_visible()
        def field(key):return page.locator('[data-key="'+key+'"]')
        def edit(key,value):
            reveal(field(key));field(key).fill(str(value));page.wait_for_timeout(240)
        def download(button,name):
            with page.expect_download() as event:page.locator('#'+button).click()
            item=event.value
            assert item.suggested_filename==name
            target=folder/name;item.save_as(target)
            return target

        mct=download('export-mct','PILAR_HEAT_HYDRATION.MCT').read_text()
        assert len(mct)>2_000_000 and '<html' not in mct.lower()
        assert len(section(mct,'*NODE'))==26433 and len(section(mct,'*ELEMENT'))==24576
        assert 'N, M, KJ, C' in mct
        assert 'NAME=H2_STRIP_FORM, NO, 0' in mct
        assert '1to12288, OLD_ZERO' in mct

        edit('mix.cement',450)
        assert field('heat.K').input_value()=='45'
        assert field('material.fc').input_value()=='30'
        assert field('material.density').input_value()=='2400'
        edit('temperature.pour',34)
        edited=download('export-mct','PILAR_HEAT_HYDRATION.MCT').read_text()
        assert 'NAME=H1_POUR_FORM, YES, 34' in edited
        page.reload();page.wait_for_function("document.querySelector('#validation-summary').textContent === 'Input dapat diekspor'")
        assert field('temperature.pour').input_value()=='34'
        assert field('mix.cement').input_value()=='450'

        reveal(field('boundary.baseMode'));field('boundary.baseMode').select_option('adiabatic');page.wait_for_timeout(240)
        assert field('temperature.base').is_disabled()
        adiabatic=download('export-mct','PILAR_HEAT_HYDRATION.MCT').read_text()
        assert '*HYD-PRTEMPER' not in adiabatic
        assert 'BASE_TEMP' not in adiabatic

        saved=download('export-json','PARAMETER_HEAT_HYDRATION.json')
        snap=json.loads(saved.read_text());assert snap['config']['temperature']['pour']==34
        assert snap['config']['boundary']['baseMode']=='adiabatic'
        assert snap['reference']['strength']['reportedMean7']==42.4
        edit('temperature.pour',31)
        page.locator('#import-file').set_input_files(saved)
        page.wait_for_function("document.querySelector('#export-status').textContent.includes('berhasil dimuat')")
        assert field('temperature.pour').input_value()=='34'
        bad=folder/'bad.json';bad.write_text('{"schema":"unknown","config":{}}')
        page.locator('#import-file').set_input_files(bad)
        page.wait_for_function("document.querySelector('#export-status').textContent.includes('tidak dimuat')")
        assert field('temperature.pour').input_value()=='34'

        edit('schedule.strip',200)
        assert page.locator('#export-mct').is_disabled()
        assert field('schedule.strip').get_attribute('aria-invalid')=='true'
        page.reload();page.wait_for_function("document.querySelector('#validation-summary').textContent === 'Input dapat diekspor'")
        assert field('schedule.strip').input_value()=='72'

        page.on('dialog',lambda dialog:dialog.accept())
        page.locator('#reset-defaults').click();page.wait_for_timeout(250)
        assert field('mix.cement').input_value()=='432'
        assert field('temperature.pour').input_value()=='30'
        assert field('boundary.baseMode').input_value()=='fixed'
        reveal(page.locator('#use-mix-density'));page.locator('#use-mix-density').click();page.wait_for_timeout(250)
        assert field('material.density').input_value()=='2426.26'
        report=download('download-report','RINGKASAN_INPUT_HIDRASI.txt').read_text()
        assert 'bukan hasil analisis' in report and '2426.26' in report

        assert not requests, requests
        assert not errors, errors
        context.close();browser.close()
    server.shutdown();server.server_close()
    print('PASS: no external assets, actual MCT downloads, editable inputs, JSON round trip/rejection, persistence, reset and report. file:// unavailable under managed browser policy.')


if __name__=='__main__':main()
