"""Verify convection guidance and actual offline exports in Chromium.

Usage: python3 tests/convection_browser.py [path/to/standalone.html]
"""
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


def section(text,name):
    lines=text.splitlines();start=lines.index(name)+1;result=[]
    for line in lines[start:]:
        if line.startswith('*'):break
        if line.strip() and not line.startswith(';'):result.append(line)
    return result


def main():
    errors=[];external=[]
    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self,*args):pass
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(HTML.parent)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        with tempfile.TemporaryDirectory(prefix='convection-browser-') as temp,sync_playwright() as p:
            folder=Path(temp)
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            context=browser.new_context(accept_downloads=True,viewport={'width':1440,'height':1000})
            page=context.new_page()
            page.on('pageerror',lambda error:errors.append(str(error)))
            page.on('request',lambda req:external.append(req.url) if req.url.startswith(('http:','https:')) and not req.url.startswith('http://127.0.0.1:') else None)
            context.route('http://**',lambda route:route.continue_() if route.request.url.startswith('http://127.0.0.1:') else route.abort())
            context.route('https://**',lambda route:route.abort())
            page.goto(f'http://127.0.0.1:{server.server_port}/{HTML.name}')
            page.wait_for_function("document.querySelector('#validation-summary').textContent === 'Input dapat diekspor'")

            def field(key):return page.locator('[data-key="convection.'+key+'"]')
            def thermal():page.locator('.nx-ribbon-tabs [data-workspace="termal"]').click()
            def edit(key,value,status):
                thermal();field(key).fill(str(value))
                page.wait_for_function("([key,status]) => document.querySelector('#convection-help-'+key).dataset.status === status",arg=[key,status])
                page.wait_for_timeout(220)
            def download(button,name):
                with page.expect_download() as event:page.locator('#'+button).click()
                item=event.value;assert item.suggested_filename==name
                target=folder/name;item.save_as(target);return target

            thermal()
            assert page.locator('#convection-guide-table tr').count()==6
            assert '0–200' in page.locator('#convection-range-note').inner_text()
            for key in ['oldSide','oldTop','air','topAir']:
                help=page.locator('#convection-help-'+key)
                assert help.get_attribute('data-status')=='reference'
                assert '2' in help.inner_text() and '25' in help.inner_text()
                assert field(key).get_attribute('aria-describedby')=='convection-help-'+key
            for key in ['form','curing']:
                assert page.locator('#convection-help-'+key).get_attribute('data-status')=='custom'
            guide=page.locator('#convection-guide')
            guide.evaluate('element => element.open = false')
            assert not page.locator('#convection-guide-table').is_visible()
            guide.locator('summary').click()
            assert page.locator('#convection-guide-table').is_visible()
            assert guide.locator('ol li').count()>=4
            assert '3,6' in guide.inner_text()

            for value,status in [(1,'review'),(30,'review'),(200,'review'),(0,'adiabatic')]:
                edit('air',value,status)
                assert field('air').input_value()==str(value)
                assert not page.locator('#export-mct').is_disabled()
                row=page.locator('#convection-guide-table tr[data-key="air"]')
                assert row.get_attribute('data-status')==status
                assert row.locator('td').nth(2).inner_text()=={1:'3,60',30:'108,00',200:'720,00',0:'0,00'}[value]
            edit('air',201,'invalid')
            assert field('air').input_value()=='201'
            assert field('air').get_attribute('aria-invalid')=='true'
            for button in ['export-mct','export-json','download-report']:
                assert page.locator('#'+button).is_disabled()
            field('air').fill('')
            page.wait_for_timeout(240)
            assert page.locator('#convection-help-air').get_attribute('data-status')=='invalid'
            assert page.locator('#export-mct').is_disabled()

            chosen={'oldSide':0,'oldTop':1,'form':3.2,'air':30,'curing':5.4,'topAir':200}
            for key,value in chosen.items():
                status='adiabatic' if value==0 else 'custom' if key in ['form','curing'] else 'review'
                edit(key,value,status)
            mct=download('export-mct','PILAR_HEAT_HYDRATION.MCT').read_text()
            actual={}
            for line in section(mct,'*HYD-CONVCOEF'):
                name,method,value=[part.strip() for part in line.split(',')]
                assert method=='CONST';actual[name.removeprefix('FUNC=')]=float(value)
            assert actual=={'H_OLD_SIDE':0,'H_OLD_TOP':3.6,'H_FORM':11.52,'H_AIR':108,'H_CURING':19.44,'H_TOP_AIR':720}
            saved=download('export-json','PARAMETER_HEAT_HYDRATION.json')
            snapshot=json.loads(saved.read_text())
            assert snapshot['config']['convection']==chosen
            metadata=snapshot['convection_guidance']
            assert metadata['limit']=={'min':0,'max':200}
            entries={item['key']:item for item in metadata['items']}
            assert entries['air']['status']=='review' and entries['air']['value']==30
            assert entries['oldSide']['status']=='adiabatic'
            assert entries['form']['min'] is None and entries['curing']['max'] is None
            assert len(metadata['sources'])>=3
            report=download('download-report','RINGKASAN_INPUT_HIDRASI.txt').read_text()
            assert 'CONVECTION BOUNDARIES / KRITERIA RANGE DAN PETUNJUK:' in report
            assert 'h=30 ' in report and '108 ' in report
            assert 'Petunjuk:' in report and 'Dasar:' in report
            assert 'RUJUKAN KONVEKSI:' in report and 'fhwa.dot.gov' in report
            edit('air',10,'reference')
            page.locator('#import-file').set_input_files(saved)
            page.wait_for_function("document.querySelector('#export-status').textContent.includes('berhasil dimuat')")
            assert field('air').input_value()=='30'
            assert page.locator('#convection-help-air').get_attribute('data-status')=='review'
            page.reload()
            page.wait_for_function("document.querySelector('#validation-summary').textContent === 'Input dapat diekspor'")
            assert field('air').input_value()=='30'
            assert page.locator('#convection-help-air').get_attribute('data-status')=='review'
            thermal()
            page.set_viewport_size({'width':390,'height':844})
            page.wait_for_timeout(180)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile page overflow'
            assert page.locator('#convection-help-air').is_visible()
            assert page.locator('#convection-guide summary').is_visible()
            assert errors==[],errors
            assert external==[],external
            browser.close()
    finally:
        server.shutdown()
    print('PASS: convection criteria, advisory/invalid/zero states, unit conversion, actual MCT/JSON/report, persistence, instructions and responsive offline UI.')


if __name__=='__main__':main()
