"""Actual browser exports for time-dependent materials; does not run MIDAS."""
import copy
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


def sections(text):
    result={}
    current=None
    for raw in text.splitlines():
        line=raw.strip()
        if not line or line.startswith(';'):continue
        if line.startswith('*'):
            current=line
            result[current]=[]
        else:result[current].append(line)
    return result


def values(line):return [x.strip() for x in line.removeprefix('NAME=').split(',')]


def main():
    errors=[]
    external=[]
    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self,*args):pass
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(HTML.parent)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    url=f'http://127.0.0.1:{server.server_port}/{HTML.name}'
    try:
        with tempfile.TemporaryDirectory(prefix='td-browser-') as temp,sync_playwright() as p:
            directory=Path(temp)
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            context=browser.new_context(accept_downloads=True,viewport={'width':1440,'height':1000})
            page=context.new_page()
            page.on('pageerror',lambda error:errors.append(str(error)))
            page.on('request',lambda request:external.append(request.url) if request.url.startswith(('http:','https:')) and not request.url.startswith('http://127.0.0.1:') else None)
            context.route('http://**',lambda route:route.continue_() if route.request.url.startswith('http://127.0.0.1:') else route.abort())
            context.route('https://**',lambda route:route.abort())
            page.goto(url)
            page.wait_for_function("window.NXWorkspace && document.querySelector('#validation-summary').textContent==='Input dapat diekspor'")

            def pane(name):page.locator('.nx-ribbon-tabs [data-workspace="'+name+'"]').click()
            def field(key):return page.locator('[data-key="'+key+'"]')
            def reveal(key):
                locator=field(key)
                name=locator.evaluate("el=>el.closest('.nx-pane').id")
                pane(name)
                locator.evaluate("el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;}")
                return locator
            def edit(key,value):reveal(key).fill(str(value));page.wait_for_timeout(230)
            def select(key,value):reveal(key).select_option(value);page.wait_for_timeout(230)
            def download(button,filename):
                with page.expect_download() as event:page.locator('#'+button).click()
                item=event.value
                assert item.suggested_filename==filename
                target=directory/filename
                item.save_as(target)
                return target
            def mct():return sections(download('export-mct','PILAR_HEAT_HYDRATION.MCT').read_text())
            def td(key):return 'timeDependent.'+key

            pane('material-waktu')
            assert page.locator('#material-waktu').is_visible()
            assert field(td('enabled')).input_value()=='yes'
            assert field(td('creepModel')).input_value()=='CEB1990'
            assert field(td('notionalSize')).input_value()=='3.75'
            assert 'TD_CS' in page.locator('#td-link-new').inner_text()
            assert page.locator('#td-link-old').inner_text()=='Tidak ada'
            assert page.locator('#td-strength-chart path').count()>0
            assert '38,00 MPa' in page.locator('#td-strength-note').inner_text()
            # Smaller actual mesh keeps repeated download checks inexpensive.
            for key,value in [('sideDiv',4),('radialDiv',2),('layersOld',1),('layersNew',1)]:edit('mesh.'+key,value)
            initial=mct()
            assert values(initial['*TDM-TYPE'][0])[:3]==['TD_CS','CEB','30000000']
            assert values(initial['*TDM-ELAST'][0])==['TD_FC','CODE','CEB-FIP(1990)','38000000','2']
            assert initial['*TDM-LINK']==['2, TD_CS, TD_FC']
            assert values(initial['*HYD-CTRL'][0])[8]=='YES'
            assert initial['*SELFWEIGHT']==['0, 0, -1, LG_SW']
            pane('ekspor')
            preview=page.locator('#mct-preview').input_value()
            assert '*TDM-TYPE' in preview and '2, TD_CS, TD_FC' in preview
            assert 'CODE, CEB-FIP(1990), 38000000, 2' in preview

            # Geometry edits do not silently change material surface assumptions.
            edit('geometry.diameter',5)
            assert field(td('notionalSize')).input_value()=='3.75'
            pane('material-waktu');page.locator('#td-use-geometry').click();page.wait_for_timeout(230)
            assert field(td('notionalSize')).input_value()=='2.5'
            assert field(td('volumeSurface')).input_value()=='1.25'

            select(td('creepModel'),'ACI');select(td('strengthModel'),'ACI')
            assert page.locator('#td-cs-aci').is_visible()
            edit(td('aciA'),3.7);edit(td('aciB'),.91);edit(td('aciSlump'),120)
            edit('mix.cement',450)
            aci=mct();cs=values(aci['*TDM-TYPE'][0])
            assert cs[1]=='ACI' and float(cs[10])==.12 and float(cs[-1])==450
            assert values(aci['*TDM-ELAST'][0])==['TD_FC','CODE','ACI','30000000','3.7','0.91']
            select(td('aciMixSource'),'manual');edit(td('aciCementContent'),390)
            assert float(values(mct()['*TDM-TYPE'][0])[-1])==390

            select(td('creepModel'),'AASHTO2006');select(td('strengthModel'),'AASHTO')
            select(td('aashtoExposed'),'yes')
            assert page.locator('#td-aashto-note').is_visible()
            assert 'ACI 209R-92' in page.locator('#td-strength-label').inner_text()
            aashto=mct()
            assert values(aashto['*TDM-TYPE'][0])[1]=='AASHTO'
            assert values(aashto['*TDM-TYPE'][0])[-1]=='YES'
            assert values(aashto['*TDM-ELAST'][0])[2]=='ACI'

            select(td('creepModel'),'USER');select(td('strengthModel'),'USER')
            select(td('creepModulusSource'),'user');edit(td('creepReferenceModulus'),35000)
            edit(td('strengthScale'),1.4)
            custom_strength='0, 0, 0, 0\n1, 9, 0.7, 12500\n7, 25, 1.9, 25000\n30, 35, 2.6, 32000\n90, 39, 2.9, 35000'
            custom_creep='7, 0, 0\n7, 30, 1.4\n7, 90, 1.9\n3, 0, 0\n3, 30, 1.7\n3, 90, 2.2'
            custom_shrink='0, 0\n7, 220\n30, 400\n90, 600'
            edit(td('customStrength'),custom_strength);edit(td('customCreep'),custom_creep);edit(td('customShrinkage'),custom_shrink)
            user=mct()
            assert 'FUNC=TD_CREEP_1, CREEP, 1, CC, 35000000000, Custom creep' in user['*TDM-FUNC']
            assert '7, 0.00022' in user['*TDM-FUNC']
            assert user['*TDM-TYPE'][1]=='TD_CREEP_1, 3, TD_CREEP_2, 7'
            assert user['*TDM-ELAST'][0]=='NAME=TD_FC, USER, 1.4'
            assert '1, 9000000, 700000, 12500000000' in user['*TDM-ELAST']
            pane('material-waktu')
            assert '35.000,000 MPa' in page.locator('#td-creep-reference').inner_text()
            first_positive=page.locator('#td-strength-table tr').nth(1).locator('td').all_text_contents()
            assert first_positive==['1,000','9,000','0,700','17.500,000']
            select(td('linkOldCreep'),'yes');select(td('linkNewCreep'),'no')
            linked=mct()
            assert [values(line) for line in linked['*TDM-LINK']]==[['1','TD_CS',''],['2','','TD_FC']]
            select(td('linkOldCreep'),'no')
            assert values(mct()['*HYD-CTRL'][0])[8]=='NO'
            select(td('linkNewCreep'),'yes')

            saved=download('export-json','PARAMETER_HEAT_HYDRATION.json')
            snapshot=json.loads(saved.read_text())
            assert snapshot['config']['timeDependent']['customStrength']==custom_strength
            assert snapshot['config']['timeDependent']['creepReferenceModulus']==35000
            assert snapshot['config']['timeDependent']['strengthScale']==1.4
            point=snapshot['time_dependent_calculation']['strengthCurve'][1]
            assert math.isclose(point['elastic'],17500) and point['fc']==9 and point['tensile']==.7
            report=download('download-report','RINGKASAN_INPUT_HIDRASI.txt').read_text()
            assert 'MATERIAL BERGANTUNG WAKTU / TIME DEPENDENT MATERIAL:' in report
            assert 'TIME DEPENDENT MATERIAL LINK:' in report
            assert 'Modulus acuan creep USER=35000 MPa' in report
            assert 'COMPRESSION STRENGTH USER CSV:' in report and custom_strength in report
            assert '1, 9000000, 700000, 12500000000' in report
            pane('ekspor')
            assert 'FUNC=TD_CREEP_1, CREEP, 1, CC, 35000000000' in page.locator('#mct-preview').input_value()
            page.reload();page.wait_for_function("window.NXWorkspace && document.querySelector('#validation-summary').textContent==='Input dapat diekspor'")
            assert field(td('customStrength')).input_value()==custom_strength
            assert field(td('creepReferenceModulus')).input_value()=='35000'

            # Invalid data cannot be exported or replace the working project.
            edit(td('customStrength'),'0, 0, 0, 0\n7, -5, 1, 20000\n90, 35, 2.5, 32000')
            for button in ['export-mct','export-json','download-report']:assert page.locator('#'+button).is_disabled()
            assert field(td('customStrength')).get_attribute('aria-invalid')=='true'
            page.locator('#import-file').set_input_files(saved)
            page.wait_for_function("document.querySelector('#export-status').textContent.includes('berhasil dimuat')")
            assert field(td('customStrength')).input_value()==custom_strength
            invalid=copy.deepcopy(snapshot);del invalid['config']['timeDependent']['humidity']
            invalid_file=directory/'partial-td.json';invalid_file.write_text(json.dumps(invalid))
            page.locator('#import-file').set_input_files(invalid_file)
            page.wait_for_function("document.querySelector('#export-status').textContent.includes('tidak dimuat')")
            assert field(td('customStrength')).input_value()==custom_strength
            legacy=copy.deepcopy(snapshot);del legacy['config']['timeDependent']
            legacy_file=directory/'legacy-no-td.json';legacy_file.write_text(json.dumps(legacy))
            page.locator('#import-file').set_input_files(legacy_file)
            page.wait_for_function("document.querySelector('#export-status').textContent.includes('berhasil dimuat')")
            assert field(td('enabled')).input_value()=='no'
            old=mct();assert '*TDM-LINK' not in old and '*TDM-TYPE' not in old
            assert values(old['*HYD-CTRL'][0])[8]=='NO'
            page.once('dialog',lambda dialog:dialog.accept())
            page.locator('#reset-defaults').click()
            page.wait_for_function("document.querySelector('[data-key=\"timeDependent.enabled\"]').value==='yes'")
            pane('material-waktu')
            assert field(td('creepModel')).input_value()=='CEB1990'
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')

            mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
            mp=mobile.new_page();mp.on('pageerror',lambda error:errors.append(str(error)))
            mp.goto(url);mp.wait_for_function('window.NXWorkspace')
            mp.locator('.nx-ribbon-tabs [data-workspace="material-waktu"]').click()
            assert mp.locator('#material-waktu').is_visible()
            assert mp.evaluate('document.documentElement.scrollWidth<=innerWidth')
            mp.locator('[data-key="timeDependent.creepModel"]').select_option('USER')
            mp.locator('[data-key="timeDependent.strengthModel"]').select_option('USER')
            mp.wait_for_timeout(250)
            assert mp.evaluate('document.documentElement.scrollWidth<=innerWidth')
            assert mp.locator('[data-key="timeDependent.customCreep"]').is_visible()
            mobile.close();context.close();browser.close()
    finally:
        server.shutdown();server.server_close()
    assert not errors,errors
    assert not external,external
    print('PASS: TD code/custom models, material links, AASHTO convention, actual MCT/JSON/report/preview, scale/unit conversions, persistence/migration/validation and responsive workspace; native MIDAS not executed.')


if __name__=='__main__':main()
